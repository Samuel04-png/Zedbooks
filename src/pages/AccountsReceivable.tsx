import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Download, Upload, FileText, AlertCircle, CheckCircle, TrendingUp, RotateCcw } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { exportToCSV } from "@/utils/exportToExcel";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { useUserRole } from "@/hooks/useUserRole";

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

interface InvoicePaymentRecord {
  id: string;
  invoice_id: string | null;
  invoice_number: string;
  customer_name: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  journal_entry_id: string | null;
  is_reversed: boolean;
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
  const { data: userRole } = useUserRole();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const canReversePostedEntries = [
    "super_admin",
    "admin",
    "financial_manager",
    "accountant",
    "assistant_accountant",
  ].includes(userRole || "");

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
            invoice_number: String(row.invoiceNumber ?? row.invoice_number ?? `INV-${docSnap.id.slice(0, 8).toUpperCase()}`),
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

  const { data: invoicePayments = [] } = useQuery({
    queryKey: ["accounts-receivable-payments", startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) return [] as InvoicePaymentRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as InvoicePaymentRecord[];

      const paymentsRef = collection(firestore, COLLECTIONS.INVOICE_PAYMENTS);
      const paymentSnapshot = await getDocs(
        query(paymentsRef, where("companyId", "==", membership.companyId)),
      );

      const payments = paymentSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            invoice_id: (row.invoiceId ?? row.invoice_id ?? null) as string | null,
            amount: Number(row.amount ?? 0),
            payment_date: toDateString(row.paymentDate ?? row.payment_date),
            notes: (row.notes ?? null) as string | null,
            journal_entry_id: (row.journalEntryId ?? row.journal_entry_id ?? null) as string | null,
            is_reversed: Boolean(row.isReversed ?? row.is_reversed ?? false),
          };
        })
        .filter((payment) => payment.payment_date >= startDate && payment.payment_date <= endDate);

      const invoiceIds = Array.from(
        new Set(payments.map((payment) => payment.invoice_id).filter(Boolean)),
      ) as string[];

      const invoiceById = new Map<string, { invoiceNumber: string; customerId: string | null }>();
      if (invoiceIds.length > 0) {
        const invoiceChunks = chunk(invoiceIds, 30);
        const snapshots = await Promise.all(
          invoiceChunks.map((ids) =>
            getDocs(query(collection(firestore, COLLECTIONS.INVOICES), where(documentId(), "in", ids))),
          ),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            invoiceById.set(docSnap.id, {
              invoiceNumber: String(row.invoiceNumber ?? row.invoice_number ?? `INV-${docSnap.id.slice(0, 8).toUpperCase()}`),
              customerId: (row.customerId ?? row.customer_id ?? null) as string | null,
            });
          });
        });
      }

      const customerIds = Array.from(
        new Set(
          Array.from(invoiceById.values())
            .map((invoice) => invoice.customerId)
            .filter(Boolean),
        ),
      ) as string[];

      const customerNameById = new Map<string, string>();
      if (customerIds.length > 0) {
        const customerChunks = chunk(customerIds, 30);
        const snapshots = await Promise.all(
          customerChunks.map((ids) =>
            getDocs(query(collection(firestore, COLLECTIONS.CUSTOMERS), where(documentId(), "in", ids))),
          ),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            customerNameById.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return payments
        .map((payment) => {
          const invoice = payment.invoice_id ? invoiceById.get(payment.invoice_id) : null;
          const customerName =
            (invoice?.customerId && customerNameById.get(invoice.customerId)) || "-";
          return {
            id: payment.id,
            invoice_id: payment.invoice_id,
            invoice_number: invoice?.invoiceNumber || "-",
            customer_name: customerName,
            amount: payment.amount,
            payment_date: payment.payment_date,
            notes: payment.notes,
            journal_entry_id: payment.journal_entry_id,
            is_reversed: payment.is_reversed,
          } satisfies InvoicePaymentRecord;
        })
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    },
    enabled: Boolean(user),
  });

  const reverseInvoicePaymentMutation = useMutation({
    mutationFn: async (payment: InvoicePaymentRecord) => {
      if (!user) throw new Error("Not authenticated");
      if (!payment.journal_entry_id) {
        throw new Error("Payment has no posted journal entry to reverse.");
      }
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("No company profile found for your account");
      const reason = prompt(`Reason for reversing payment for ${payment.invoice_number} (optional):`) || undefined;
      return accountingService.reverseJournalEntry({
        companyId: membership.companyId,
        journalEntryId: payment.journal_entry_id,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable-payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Invoice payment journal entry reversed");
    },
    onError: (error) => {
      toast.error(`Failed to reverse payment: ${error.message}`);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const unpaidInvoices = invoices.filter((i) => i.status.toLowerCase() !== "paid");
  const overdueInvoices = unpaidInvoices.filter((i) => i.due_date && isPast(new Date(i.due_date)));
  const dueSoon = unpaidInvoices.filter((i) => {
    if (!i.due_date) return false;
    const days = differenceInDays(new Date(i.due_date), new Date());
    return days >= 0 && days <= 7;
  });
  const paidInvoices = invoices.filter((i) => i.status.toLowerCase() === "paid");

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
      const invoiceDate = String(row.invoice_date || new Date().toISOString().slice(0, 10));
      const dueDate = (row.due_date as string) || invoiceDate;
      const amount = Number(row.amount) || 0;

      await accountingService.createInvoice({
        companyId: membership.companyId,
        invoiceNumber: String(row.invoice_number || "").trim() || undefined,
        invoiceDate,
        dueDate,
        status: "Unpaid",
        notes: (row.notes as string) || undefined,
        totalAmount: amount,
        lineItems: [
          {
            description: (row.notes as string) || "Imported invoice",
            quantity: 1,
            unitPrice: amount,
          },
        ],
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
                  invoice.due_date && invoice.status.toLowerCase() !== "paid"
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
                          invoice.status.toLowerCase() === "paid"
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
                      {invoice.status.toLowerCase() === "paid" ? "-" : daysOverdue > 0 ? `${daysOverdue} days` : "Current"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicePayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.payment_date ? format(new Date(payment.payment_date), "dd MMM yyyy") : "-"}</TableCell>
                  <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                  <TableCell>{payment.customer_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{payment.notes || "-"}</TableCell>
                  <TableCell>
                    {payment.is_reversed ? (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">Reversed</Badge>
                    ) : (
                      <Badge variant="secondary">Posted</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {payment.journal_entry_id && canReversePostedEntries && !payment.is_reversed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={reverseInvoicePaymentMutation.isPending}
                        onClick={() => {
                          if (!confirm("Reverse this invoice payment entry?")) {
                            return;
                          }
                          reverseInvoicePaymentMutation.mutate(payment);
                        }}
                        title="Reverse payment entry"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoicePayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No payments in selected period
                  </TableCell>
                </TableRow>
              )}
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
