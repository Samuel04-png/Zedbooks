import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Download, Upload, FileText, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { exportToCSV } from "@/utils/exportToExcel";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, documentId, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  status: string;
  customer_id: string | null;
  customers: { name: string } | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const toDateString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString().slice(0, 10);
    }
  }
  return "";
};

export default function AccountsReceivable() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["accounts-receivable", startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) return [] as InvoiceRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as InvoiceRecord[];

      const invoicesRef = collection(firestore, COLLECTIONS.INVOICES);
      const invoiceSnapshot = await getDocs(
        query(invoicesRef, where("companyId", "==", membership.companyId)),
      );

      const mappedInvoices = invoiceSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            invoice_number: String(row.invoiceNumber ?? row.invoice_number ?? ""),
            invoice_date: toDateString(row.invoiceDate ?? row.invoice_date),
            due_date: toDateString(row.dueDate ?? row.due_date) || null,
            total: Number(row.total ?? 0),
            status: String(row.status ?? "draft"),
            customer_id: (row.customerId ?? row.customer_id ?? null) as string | null,
            customers: null,
          } satisfies InvoiceRecord;
        })
        .filter(
          (invoice) =>
            invoice.invoice_date >= startDate && invoice.invoice_date <= endDate,
        );

      const customerIds = Array.from(
        new Set(mappedInvoices.map((invoice) => invoice.customer_id).filter(Boolean)),
      ) as string[];

      const customerNameById = new Map<string, string>();
      if (customerIds.length > 0) {
        const customersRef = collection(firestore, COLLECTIONS.CUSTOMERS);
        const customerChunks = chunk(customerIds, 30);
        const snapshots = await Promise.all(
          customerChunks.map((ids) => getDocs(query(customersRef, where(documentId(), "in", ids)))),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            customerNameById.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return mappedInvoices
        .map((invoice) => ({
          ...invoice,
          customers: invoice.customer_id
            ? { name: customerNameById.get(invoice.customer_id) || "-" }
            : null,
        }))
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
    },
    enabled: Boolean(user),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const unpaidInvoices = invoices.filter((i) => i.status !== "paid");
  const overdueInvoices = unpaidInvoices.filter((i) => i.due_date && isPast(new Date(i.due_date)));
  const dueSoon = unpaidInvoices.filter((i) => {
    if (!i.due_date) return false;
    const days = differenceInDays(new Date(i.due_date), new Date());
    return days >= 0 && days <= 7;
  });
  const paidInvoices = invoices.filter((i) => i.status === "paid");

  const totalReceivable = unpaidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalCollected = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);

  const exportReport = () => {
    const columns = [
      { header: "Invoice Number", key: "invoice_number" },
      { header: "Invoice Date", key: "invoice_date" },
      { header: "Due Date", key: "due_date" },
      { header: "Amount", key: "total" },
      { header: "Status", key: "status" },
    ];
    exportToCSV(invoices as Record<string, unknown>[], columns, `accounts-receivable-${startDate}-to-${endDate}`);
  };

  const importColumns = [
    { key: "invoice_number", header: "Invoice Number", required: true },
    { key: "customer_name", header: "Customer Name", required: false },
    { key: "invoice_date", header: "Invoice Date (YYYY-MM-DD)", required: true },
    { key: "due_date", header: "Due Date (YYYY-MM-DD)", required: false },
    { key: "amount", header: "Amount", required: true },
    { key: "notes", header: "Notes", required: false },
  ];

  const handleImport = async (data: Record<string, unknown>[]) => {
    if (!user) throw new Error("You must be logged in");

    const membership = await companyService.getPrimaryMembershipByUser(user.id);
    if (!membership?.companyId) throw new Error("No company profile found for your account");

    for (const row of data) {
      await addDoc(collection(firestore, COLLECTIONS.INVOICES), {
        companyId: membership.companyId,
        userId: user.id,
        invoiceNumber: String(row.invoice_number || ""),
        invoiceDate: String(row.invoice_date || ""),
        dueDate: (row.due_date as string) || null,
        subtotal: Number(row.amount) || 0,
        total: Number(row.amount) || 0,
        notes: (row.notes as string) || null,
        status: "sent",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
                  {unpaidInvoices.filter((i) => !i.due_date || differenceInDays(new Date(i.due_date), new Date()) > 7).length}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    unpaidInvoices
                      .filter((i) => !i.due_date || differenceInDays(new Date(i.due_date), new Date()) > 7)
                      .reduce((sum, i) => sum + (i.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Due within 7 days</TableCell>
                <TableCell className="text-right">{dueSoon.length}</TableCell>
                <TableCell className="text-right text-warning">
                  {formatCurrency(dueSoon.reduce((sum, i) => sum + (i.total || 0), 0))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>1-30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueInvoices.filter((i) => differenceInDays(new Date(), new Date(i.due_date || "")) <= 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {formatCurrency(
                    overdueInvoices
                      .filter((i) => differenceInDays(new Date(), new Date(i.due_date || "")) <= 30)
                      .reduce((sum, i) => sum + (i.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Over 30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueInvoices.filter((i) => differenceInDays(new Date(), new Date(i.due_date || "")) > 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive font-bold">
                  {formatCurrency(
                    overdueInvoices
                      .filter((i) => differenceInDays(new Date(), new Date(i.due_date || "")) > 30)
                      .reduce((sum, i) => sum + (i.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
              {invoices.map((invoice) => {
                const daysOverdue =
                  invoice.due_date && invoice.status !== "paid"
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
                      {invoice.status === "paid" ? "-" : daysOverdue > 0 ? `${daysOverdue} days` : "Current"}
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
