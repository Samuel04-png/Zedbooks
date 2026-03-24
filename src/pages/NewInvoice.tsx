import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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

interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  tpin: string | null;
}

interface SourceDocumentSummary {
  salesOrderId: string;
  quotationId: string | null;
  orderNumber: string;
  orderType: string;
}

const mapSourceLineToInvoiceLine = (line: Record<string, unknown>, index: number): InvoiceLine => {
  const quantity = Number(line.quantity ?? 1);
  const rate = Number(line.rate ?? line.unitPrice ?? line.unit_price ?? 0);

  return {
    id: String(line.id ?? index + 1),
    description: String(line.description ?? ""),
    quantity,
    rate,
    amount: quantity * rate,
  };
};

export default function NewInvoice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: routeInvoiceId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("customer");
  const orderId = searchParams.get("order");
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
  const [sourceDocument, setSourceDocument] = useState<SourceDocumentSummary | null>(null);
  const encodedLines = searchParams.get("lines");
  const editingInvoiceId = String(routeInvoiceId || "").trim();
  const isEditMode = editingInvoiceId.length > 0;

  const { data: customers } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      if (!user) return [] as CustomerOption[];
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as CustomerOption[];
      const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.CUSTOMERS), where("companyId", "==", membership.companyId)));
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
            email: (row.email as string | null) ?? null,
            address: (row.address as string | null) ?? null,
            tpin: (row.tpin as string | null) ?? null,
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
  const selectedCustomerData = customers?.find((customer) => customer.id === selectedCustomer) || null;

  useEffect(() => {
    if (!encodedLines) return;

    try {
      const parsedLines = JSON.parse(decodeURIComponent(encodedLines));
      if (!Array.isArray(parsedLines) || parsedLines.length === 0) return;

      setLines(parsedLines.map((line, index) => mapSourceLineToInvoiceLine(line as Record<string, unknown>, index)));
    } catch {
      toast.error("Failed to load the selected quotation lines.");
    }
  }, [encodedLines]);

  useEffect(() => {
    setCustomerTPIN(selectedCustomerData?.tpin ?? "");
  }, [selectedCustomerData?.tpin]);

  useEffect(() => {
    if (!isEditMode || !companyId) return;

    let isMounted = true;

    const loadExistingInvoice = async () => {
      try {
        const invoiceSnap = await getDoc(doc(firestore, COLLECTIONS.INVOICES, editingInvoiceId));
        if (!invoiceSnap.exists()) {
          throw new Error("The selected invoice could not be found.");
        }

        const row = invoiceSnap.data() as Record<string, unknown>;
        const owner = String(row.companyId ?? row.company_id ?? row.organizationId ?? row.organization_id ?? "");
        if (owner && owner !== companyId) {
          throw new Error("The selected invoice does not belong to this company.");
        }

        if (row.journalEntryId || row.journal_entry_id) {
          throw new Error("Reverse the posted invoice before editing it.");
        }

        const amountPaid = Number(row.amountPaid ?? row.amount_paid ?? 0);
        if (amountPaid > 0.001) {
          throw new Error("Invoices with payments cannot be edited.");
        }

        const status = String(row.status ?? "draft").trim().toLowerCase();
        if (status !== "draft") {
          throw new Error("Only draft invoices can be edited.");
        }

        const itemsSnapshot = await getDocs(
          query(collection(firestore, COLLECTIONS.INVOICE_ITEMS), where("invoiceId", "==", editingInvoiceId)),
        );

        if (!isMounted) return;

        setSelectedCustomer(String(row.customerId ?? row.customer_id ?? ""));
        setInvoiceNumber(String(row.invoiceNumber ?? row.invoice_number ?? ""));
        setInvoiceDate(String(row.invoiceDate ?? row.invoice_date ?? new Date().toISOString().split("T")[0]).slice(0, 10));
        setDueDate(String(row.dueDate ?? row.due_date ?? "").slice(0, 10));
        setNotes(String(row.notes ?? ""));
        setTerms("");

        setLines(
          itemsSnapshot.docs.length > 0
            ? itemsSnapshot.docs.map((docSnap, index) =>
              mapSourceLineToInvoiceLine(docSnap.data() as Record<string, unknown>, index))
            : [{ id: "1", description: "", quantity: 1, rate: 0, amount: 0 }],
        );

        const salesOrderId = String(row.salesOrderId ?? row.sales_order_id ?? "").trim();
        const quotationId = String(row.quotationId ?? row.quotation_id ?? "").trim();
        if (salesOrderId || quotationId) {
          setSourceDocument({
            salesOrderId,
            quotationId: quotationId || null,
            orderNumber: salesOrderId || quotationId || editingInvoiceId,
            orderType: "source document",
          });
        }
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Failed to load the selected invoice.";
        toast.error(message);
        navigate("/invoices");
      }
    };

    loadExistingInvoice();

    return () => {
      isMounted = false;
    };
  }, [companyId, editingInvoiceId, isEditMode, navigate]);

  useEffect(() => {
    if (isEditMode || !orderId || !companyId) return;

    let isMounted = true;

    const loadSourceOrder = async () => {
      try {
        const orderSnap = await getDoc(doc(firestore, COLLECTIONS.SALES_ORDERS, orderId));
        if (!orderSnap.exists()) {
          throw new Error("The selected sales document could not be found.");
        }

        const row = orderSnap.data() as Record<string, unknown>;
        const owner = String(row.companyId ?? row.company_id ?? row.organizationId ?? row.organization_id ?? "");
        if (owner && owner !== companyId) {
          throw new Error("The selected sales document does not belong to this company.");
        }

        const sourceLineItems = Array.isArray(row.lineItems)
          ? row.lineItems
          : Array.isArray(row.line_items)
            ? row.line_items
            : [];

        if (!isMounted) return;

        const customerFromOrder = String(row.customerId ?? row.customer_id ?? "").trim();
        const sourceDueDate = String(row.validUntil ?? row.valid_until ?? row.dueDate ?? row.due_date ?? "").trim();
        const sourceNotes = String(row.notes ?? "").trim();
        const quotationIdFromOrder = String(row.quotationId ?? row.quotation_id ?? "").trim() || null;

        setSourceDocument({
          salesOrderId: orderSnap.id,
          quotationId: quotationIdFromOrder,
          orderNumber: String(row.orderNumber ?? row.order_number ?? orderSnap.id),
          orderType: String(row.orderType ?? row.order_type ?? "sale"),
        });

        if (customerFromOrder) {
          setSelectedCustomer(customerFromOrder);
        }

        if (sourceLineItems.length > 0) {
          setLines(
            sourceLineItems.map((line, index) => mapSourceLineToInvoiceLine(line as Record<string, unknown>, index)),
          );
        }

        if (sourceDueDate) {
          setDueDate((current) => current || sourceDueDate);
        }

        if (sourceNotes) {
          setNotes((current) => current.trim().length > 0 ? current : sourceNotes);
        }
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Failed to load the source sales document.";
        toast.error(message);
      }
    };

    loadSourceOrder();

    return () => {
      isMounted = false;
    };
  }, [companyId, isEditMode, orderId]);

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

      const lineItems = lines
        .filter((line) => line.description.trim().length > 0)
        .map((line) => ({
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.rate,
        }));

      if (lineItems.length === 0) {
        throw new Error("At least one invoice line item is required.");
      }

      if (isEditMode) {
        const result = await accountingService.updateInvoiceDraft({
          companyId,
          invoiceId: editingInvoiceId,
          customerId: selectedCustomer || undefined,
          customerName: selectedCustomerData?.name || undefined,
          invoiceNumber,
          invoiceDate,
          dueDate: dueDate || invoiceDate,
          notes: [notes, terms].filter(Boolean).join("\n\n") || undefined,
          quotationId: sourceDocument?.quotationId || undefined,
          salesOrderId: sourceDocument?.salesOrderId || undefined,
          taxAmount: vatAmount,
          totalAmount: total,
          lineItems,
        });

        if (status === "sent") {
          await accountingService.updateInvoiceStatus({
            companyId,
            invoiceId: editingInvoiceId,
            status: "Unpaid",
          });
        }

        return {
          invoiceId: result.invoiceId,
          journalEntryId: null,
          invoiceNumber: result.invoiceNumber,
        };
      }

      return accountingService.createInvoice({
        companyId,
        customerId: selectedCustomer || undefined,
        customerName: selectedCustomerData?.name || undefined,
        invoiceNumber,
        invoiceDate,
        dueDate: dueDate || invoiceDate,
        status: status === "sent" ? "Unpaid" : "Draft",
        notes: [notes, terms].filter(Boolean).join("\n\n") || undefined,
        quotationId: sourceDocument?.quotationId || undefined,
        salesOrderId: sourceDocument?.salesOrderId || undefined,
        taxAmount: vatAmount,
        totalAmount: total,
        lineItems,
      });
    },
    onSuccess: async (invoice, status) => {
      // If VAT registered and sending, submit to ZRA
      if (isVatRegistered && submitToZRAOnSend && status === "sent") {
        try {
          await submitToZRA.mutateAsync(invoice.invoiceId);
        } catch (e) {
          // Invoice saved but ZRA submission queued
          console.log("ZRA submission queued for retry");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        status === "sent"
          ? isEditMode ? "Invoice updated and sent" : "Invoice sent successfully"
          : isEditMode ? "Draft invoice updated" : "Invoice saved as draft",
      );
      navigate("/invoices");
    },
    onError: (error) => {
      toast.error("Failed to save invoice: " + error.message);
    },
  });

  const handleSave = (send: boolean = false) => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    saveMutation.mutate(send ? "sent" : "draft");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isEditMode ? "Edit Invoice" : "New Invoice"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update and issue a saved draft invoice" : "Create a new invoice for a customer"}
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
            {isEditMode ? "Update Draft" : "Save Draft"}
          </Button>
          <Button className="gap-2" onClick={() => handleSave(true)} disabled={saveMutation.isPending}>
            <Send className="h-4 w-4" />
            {isEditMode ? "Update & Send" : "Save & Send"}
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-number">Invoice Number *</Label>
                  <Input
                    id="invoice-number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Enter invoice number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-date">Invoice Date *</Label>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedCustomerData && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{selectedCustomerData.name}</p>
                  {selectedCustomerData.email && (
                    <p className="text-muted-foreground">{selectedCustomerData.email}</p>
                  )}
                  {selectedCustomerData.address && (
                    <p className="text-muted-foreground">{selectedCustomerData.address}</p>
                  )}
                  {selectedCustomerData.tpin && (
                    <p className="text-muted-foreground">TPIN: {selectedCustomerData.tpin}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {sourceDocument && (
            <Card className="border-dashed bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Converted from {sourceDocument.orderType}</p>
                    <p className="text-muted-foreground">
                      Saving this invoice will update the linked sales document automatically.
                    </p>
                  </div>
                  <Badge variant="outline">{sourceDocument.orderNumber}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

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
