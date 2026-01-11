import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileText, AlertCircle, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { exportToCSV } from "@/utils/exportToExcel";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { toast } from "sonner";

export default function AccountsReceivable() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["accounts-receivable", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (name)
        `)
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  // Categorize invoices
  const unpaidInvoices = invoices.filter((i: any) => i.status !== "paid");
  const overdueInvoices = unpaidInvoices.filter((i: any) => i.due_date && isPast(new Date(i.due_date)));
  const dueSoon = unpaidInvoices.filter((i: any) => {
    if (!i.due_date) return false;
    const days = differenceInDays(new Date(i.due_date), new Date());
    return days >= 0 && days <= 7;
  });
  const paidInvoices = invoices.filter((i: any) => i.status === "paid");

  const totalReceivable = unpaidInvoices.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
  const totalOverdue = overdueInvoices.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
  const totalCollected = paidInvoices.reduce((sum: number, i: any) => sum + (i.total || 0), 0);

  const exportReport = () => {
    const columns = [
      { header: "Invoice Number", key: "invoice_number" },
      { header: "Invoice Date", key: "invoice_date" },
      { header: "Due Date", key: "due_date" },
      { header: "Amount", key: "total" },
      { header: "Status", key: "status" }
    ];
    exportToCSV(invoices as any, columns, `accounts-receivable-${startDate}-to-${endDate}`);
  };

  const importColumns = [
    { key: "invoice_number", header: "Invoice Number", required: true },
    { key: "customer_name", header: "Customer Name", required: false },
    { key: "invoice_date", header: "Invoice Date (YYYY-MM-DD)", required: true },
    { key: "due_date", header: "Due Date (YYYY-MM-DD)", required: false },
    { key: "amount", header: "Amount", required: true },
    { key: "notes", header: "Notes", required: false }
  ];

  const handleImport = async (data: any[]) => {
    for (const row of data) {
      const { error } = await supabase.from("invoices").insert({
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        due_date: row.due_date || null,
        subtotal: parseFloat(row.amount) || 0,
        total: parseFloat(row.amount) || 0,
        notes: row.notes || null,
        status: "sent",
        user_id: user?.id,
      });
      if (error) throw error;
    }
    refetch();
    toast.success("Invoices imported successfully");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts Receivable</h1>
          <p className="text-muted-foreground">Track customer invoices and collections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Receivable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalReceivable)}</div>
            <p className="text-xs text-muted-foreground">{unpaidInvoices.length} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">{overdueInvoices.length} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalCollected)}</div>
            <p className="text-xs text-muted-foreground">{paidInvoices.length} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Aging Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Current (not due)</TableCell>
                <TableCell className="text-right">
                  {unpaidInvoices.filter((i: any) => !i.due_date || differenceInDays(new Date(i.due_date), new Date()) > 7).length}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    unpaidInvoices
                      .filter((i: any) => !i.due_date || differenceInDays(new Date(i.due_date), new Date()) > 7)
                      .reduce((sum: number, i: any) => sum + (i.total || 0), 0)
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Due within 7 days</TableCell>
                <TableCell className="text-right">{dueSoon.length}</TableCell>
                <TableCell className="text-right text-warning">
                  {formatCurrency(dueSoon.reduce((sum: number, i: any) => sum + (i.total || 0), 0))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>1-30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueInvoices.filter((i: any) => differenceInDays(new Date(), new Date(i.due_date)) <= 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {formatCurrency(
                    overdueInvoices
                      .filter((i: any) => differenceInDays(new Date(), new Date(i.due_date)) <= 30)
                      .reduce((sum: number, i: any) => sum + (i.total || 0), 0)
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Over 30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueInvoices.filter((i: any) => differenceInDays(new Date(), new Date(i.due_date)) > 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive font-bold">
                  {formatCurrency(
                    overdueInvoices
                      .filter((i: any) => differenceInDays(new Date(), new Date(i.due_date)) > 30)
                      .reduce((sum: number, i: any) => sum + (i.total || 0), 0)
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice: any) => {
                const daysOverdue = invoice.due_date && invoice.status !== "paid"
                  ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
                  : 0;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.customers?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "default"
                            : daysOverdue > 0
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {daysOverdue > 0 && (
                        <span className="text-destructive font-medium">{daysOverdue} days</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        columns={importColumns}
        title="Import Invoices"
      />
    </div>
  );
}