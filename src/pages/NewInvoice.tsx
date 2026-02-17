import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Send, FileCheck, AlertCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useZRAInvoice } from "@/hooks/useZRAInvoice";

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function NewInvoice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("customer");
  const { data: settings } = useCompanySettings();
  const { submitToZRA, isSubmitting } = useZRAInvoice();

  const [selectedCustomer, setSelectedCustomer] = useState(customerId || "");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now()}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [submitToZRAOnSend, setSubmitToZRAOnSend] = useState(true);

  // ZRA Specific State
  const [isB2B, setIsB2B] = useState(false);
  const [customerTPIN, setCustomerTPIN] = useState("");
  const [vatType, setVatType] = useState("A"); // Default standard rate

  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: "1", description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  const { data: customers } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [];
      const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.CUSTOMERS), where("companyId", "==", membership.companyId)));
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(user),
  });

  const { data: companyId } = useQuery({
    queryKey: ["new-invoice-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const isVatRegistered = settings?.isVatRegistered || false;
  const vatRate = settings?.vatRate || 16;

  const addLine = () => {
    setLines([
      ...lines,
      { id: Date.now().toString(), description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof InvoiceLine, value: string | number) => {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updated = { ...line, [field]: value };
          if (field === "quantity" || field === "rate") {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return line;
      })
    );
  };

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = isVatRegistered ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!companyId || !user) throw new Error("No company context found");

      const invoiceRef = await addDoc(collection(firestore, COLLECTIONS.INVOICES), {
        companyId,
        customerId: selectedCustomer || null,
        invoiceNumber: invoiceNumber,
        invoiceDate: invoiceDate,
        dueDate: dueDate || null,
        subtotal,
        vatAmount: vatAmount,
        total,
        status,
        notes,
        terms,
        zraStatus: isVatRegistered && submitToZRAOnSend && status === "sent" ? "pending" : null,
        // ZRA specific fields
        isB2B,
        customerTPIN: isB2B ? customerTPIN : null,
        vatType: isB2B ? vatType : "A",
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const invoiceItems = lines
        .filter((line) => line.description)
        .map((line) => ({
          companyId,
          invoiceId: invoiceRef.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.rate,
          amount: line.amount,
          createdAt: serverTimestamp(),
        }));

      if (invoiceItems.length > 0) {
        await Promise.all(invoiceItems.map((item) => addDoc(collection(firestore, COLLECTIONS.INVOICE_ITEMS), item)));
      }

      return { id: invoiceRef.id, status };
    },
    onSuccess: async (invoice, status) => {
      // If VAT registered and sending, submit to ZRA
      if (isVatRegistered && submitToZRAOnSend && status === "sent") {
        try {
          await submitToZRA.mutateAsync(invoice.id);
        } catch (e) {
          // Invoice saved but ZRA submission queued
          console.log("ZRA submission queued for retry");
        }
      }

      if (status === "sent") {
        try {
          await accountingService.postInvoiceToGL(invoice.id);
          toast.success("Posted to General Ledger");
        } catch (error) {
          console.error("GL Posting Error:", error);
          toast.warning("Invoice sent, but failed to post to Ledger. Please check Audit Logs.");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(status === "sent" ? "Invoice sent successfully" : "Invoice saved as draft");
      navigate("/invoices");
    },
    onError: (error) => {
      toast.error("Failed to save invoice: " + error.message);
    },
  });

  const handleSave = (send: boolean = false) => {
    saveMutation.mutate(send ? "sent" : "draft");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Invoice</h1>
          <p className="text-muted-foreground">
            Create a new invoice for a customer
            {isVatRegistered && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                VAT {vatRate}%
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/invoices")}>
            Cancel
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleSave(false)} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button className="gap-2" onClick={() => handleSave(true)} disabled={saveMutation.isPending}>
            <Send className="h-4 w-4" />
            Save & Send
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-12 text-sm font-medium text-muted-foreground">
                  <div className="md:col-span-5">Description</div>
                  <div className="md:col-span-2">Qty</div>
                  <div className="md:col-span-2">Rate (ZMW)</div>
                  <div className="md:col-span-2">Amount</div>
                  <div className="md:col-span-1"></div>
                </div>
                {lines.map((line) => (
                  <div key={line.id} className="grid gap-4 md:grid-cols-12 items-start">
                    <div className="md:col-span-5">
                      <Textarea
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={line.rate}
                        onChange={(e) => updateLine(line.id, "rate", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        value={`ZMW ${line.amount.toFixed(2)}`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="gap-2" onClick={addLine}>
                  <Plus className="h-4 w-4" />
                  Add Line
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes & Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (visible to customer)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes or special instructions"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  placeholder="Payment terms and conditions"
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div >

    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">ZMW {subtotal.toFixed(2)}</span>
          </div>
          {isVatRegistered && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT ({vatRate}%)</span>
              <span className="font-medium">ZMW {vatAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-3 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">ZMW {total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {isVatRegistered && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">ZRA Smart Invoice</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Submit to ZRA on send</p>
                <p className="text-xs text-muted-foreground">
                  Invoice will be submitted for ZRA approval
                </p>
              </div>
              <Switch
                checked={submitToZRAOnSend}
                onCheckedChange={setSubmitToZRAOnSend}
              />
            </div>
            {isSubmitting && (
              <Badge variant="outline" className="animate-pulse">
                <AlertCircle className="h-3 w-3 mr-1" />
                Submitting to ZRA...
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {!isVatRegistered && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              VAT is not applied. To enable VAT, go to{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/settings")}>
                Settings
              </Button>{" "}
              and enable VAT registration.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
      </div >
    </div >
  );
}
