import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Send, FileText } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function NewQuotation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("customer");
  const { data: settings } = useCompanySettings();
  
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || "");
  const [quoteNumber, setQuoteNumber] = useState(`QT-${Date.now()}`);
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("This quotation is valid for 30 days from the date of issue.");
  
  const [lines, setLines] = useState<QuoteLine[]>([
    { id: "1", description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, address")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const isVatRegistered = settings?.is_vat_registered || false;
  const vatRate = settings?.vat_rate || 16;

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

  const updateLine = (id: string, field: keyof QuoteLine, value: string | number) => {
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

  const selectedCustomerData = customers?.find(c => c.id === selectedCustomer);

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          user_id: user?.id,
          customer_id: selectedCustomer || null,
          order_number: quoteNumber,
          order_date: quoteDate,
          order_type: "quote",
          subtotal,
          vat_amount: vatAmount,
          total,
          status,
          notes: `${notes}\n\nTerms: ${terms}\nValid Until: ${validUntil}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;
      return order;
    },
    onSuccess: (_, status) => {
      toast.success(status === "sent" ? "Quotation sent successfully" : "Quotation saved as draft");
      navigate("/sales-orders");
    },
    onError: (error) => {
      toast.error("Failed to save quotation: " + error.message);
    },
  });

  const convertToInvoice = () => {
    const lineData = encodeURIComponent(JSON.stringify(lines));
    navigate(`/invoices/new?customer=${selectedCustomer}&lines=${lineData}`);
  };

  const handleSave = (send: boolean = false) => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    saveMutation.mutate(send ? "sent" : "draft");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Quotation</h1>
          <p className="text-muted-foreground">
            Create a quotation for a customer
            {isVatRegistered && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                VAT {vatRate}%
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/sales-orders")}>
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
              <CardTitle>Quotation Details</CardTitle>
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
                  <Label htmlFor="quoteNumber">Quotation Number *</Label>
                  <Input
                    id="quoteNumber"
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quoteDate">Quotation Date *</Label>
                  <Input
                    id="quoteDate"
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedCustomerData && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-sm">
                  <p className="font-medium">{selectedCustomerData.name}</p>
                  {selectedCustomerData.email && <p className="text-muted-foreground">{selectedCustomerData.email}</p>}
                  {selectedCustomerData.address && <p className="text-muted-foreground">{selectedCustomerData.address}</p>}
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
                        placeholder="Item description"
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
                        value={formatCurrency(line.amount)}
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
                  Add Line Item
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
                  placeholder="Add any notes or special conditions"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  placeholder="Quotation terms and conditions"
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {isVatRegistered && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({vatRate}%)</span>
                  <span className="font-medium">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full gap-2" 
                onClick={convertToInvoice}
                disabled={!selectedCustomer || lines.every(l => !l.description)}
              >
                <FileText className="h-4 w-4" />
                Convert to Invoice
              </Button>
            </CardContent>
          </Card>

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
      </div>
    </div>
  );
}
