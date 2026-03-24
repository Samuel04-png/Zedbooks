import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  amount_paid: number;
  outstanding_amount: number;
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

interface BankAccountOption {
  id: string;
  account_name: string;
  currency: string;
  is_active: boolean;
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
  const [isReceivePaymentOpen, setIsReceivePaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_account_id: "",
    notes: "",
  });
  const canReversePostedEntries = [
    "super_admin",
    "admin",
    "financial_manager",
    "accountant",
    "assistant_accountant",
  ].includes(userRole || "");

  const invalidateReceivableQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-receivable-payments"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const resetPaymentForm = () => {
    setSelectedInvoiceForPayment(null);
    setPaymentForm({
      amount: "",
      payment_date: new Date().toISOString().split("T")[0],
      payment_account_id: "",
      notes: "",
    });
  };

  const closeReceivePaymentDialog = (open: boolean) => {
    setIsReceivePaymentOpen(open);
    if (!open) {
      resetPaymentForm();
    }
  };

  const { data: companyId } = useQuery({
    queryKey: ["accounts-receivable-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: invoices = [], isLoading } = useQuery({
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
            total: Number(row.totalAmount ?? row.total_amount ?? row.total ?? 0),
            amount_paid: Number(row.amountPaid ?? row.amount_paid ?? 0),
            outstanding_amount: Math.max(
              Number(row.totalAmount ?? row.total_amount ?? row.total ?? 0)
              - Number(row.amountPaid ?? row.amount_paid ?? 0),
              0,
            ),
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

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["invoice-payment-bank-accounts", companyId],
    queryFn: async () => {
      if (!companyId) return [] as BankAccountOption[];

      const snapshot = await getDocs(
        query(collection(firestore, COLLECTIONS.BANK_ACCOUNTS), where("companyId", "==", companyId)),
      );

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            account_name: String(row.accountName ?? row.account_name ?? ""),
            currency: String(row.currency ?? "ZMW"),
            is_active: Boolean(row.isActive ?? row.is_active ?? true),
          } satisfies BankAccountOption;
        })
        .filter((account) => account.is_active)
        .sort((a, b) => a.account_name.localeCompare(b.account_name));
    },
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (!isReceivePaymentOpen || paymentForm.payment_account_id || bankAccounts.length === 0) return;
    setPaymentForm((current) => ({
      ...current,
      payment_account_id: bankAccounts[0].id,
    }));
  }, [bankAccounts, isReceivePaymentOpen, paymentForm.payment_account_id]);

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
      invalidateReceivableQueries();
      toast.success("Invoice payment journal entry reversed");
    },
    onError: (error) => {
      toast.error(`Failed to reverse payment: ${error.message}`);
    },
  });

  const receivePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company profile found for your account");
      if (!selectedInvoiceForPayment) throw new Error("No invoice selected");

      const amount = Number(paymentForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid payment amount.");
      }
      if (amount - selectedInvoiceForPayment.outstanding_amount > 0.001) {
        throw new Error("Payment cannot exceed the outstanding balance.");
      }
      if (!paymentForm.payment_account_id) {
        throw new Error("Select the bank or cash account receiving the payment.");
      }

      return accountingService.recordInvoicePayment({
        companyId,
        invoiceId: selectedInvoiceForPayment.id,
        amount,
        paymentDate: paymentForm.payment_date,
        paymentAccountId: paymentForm.payment_account_id,
        notes: paymentForm.notes || undefined,
      });
    },
    onSuccess: () => {
      invalidateReceivableQueries();
      toast.success("Invoice payment recorded successfully");
      closeReceivePaymentDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to receive payment: ${error.message}`);
    },
  });

  const openReceivePaymentDialog = (invoice: InvoiceRecord) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentForm({
      amount: invoice.outstanding_amount.toFixed(2),
      payment_date: new Date().toISOString().split("T")[0],
      payment_account_id: bankAccounts[0]?.id || "",
      notes: "",
    });
    setIsReceivePaymentOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const receivableInvoices = invoices.filter((invoice) => !["draft", "cancelled", "canceled"].includes(invoice.status.toLowerCase()));
  const openInvoices = receivableInvoices.filter((invoice) => invoice.outstanding_amount > 0.001);
  const overdueInvoices = openInvoices.filter((invoice) => invoice.due_date && isPast(new Date(invoice.due_date)));
  const dueSoon = openInvoices.filter((i) => {
    if (!i.due_date) return false;
    const days = differenceInDays(new Date(i.due_date), new Date());
    return days >= 0 && days <= 7;
  });

  const totalReceivable = openInvoices.reduce((sum, invoice) => sum + invoice.outstanding_amount, 0);
  const totalOverdue = overdueInvoices.reduce((sum, invoice) => sum + invoice.outstanding_amount, 0);
  const totalCollected = invoicePayments
    .filter((payment) => !payment.is_reversed)
    .reduce((sum, payment) => sum + payment.amount, 0);

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

    invalidateReceivableQueries();
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
            <p className="text-xs text-muted-foreground">{openInvoices.length} open invoices</p>
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
            <p className="text-xs text-muted-foreground">{invoicePayments.filter((payment) => !payment.is_reversed).length} payments</p>
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
                  {openInvoices.filter((i) => !i.due_date || differenceInDays(new Date(i.due_date), new Date()) > 7).length}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    openInvoices
                      .filter((i) => !i.due_date || differenceInDays(new Date(i.due_date), new Date()) > 7)
                      .reduce((sum, i) => sum + i.outstanding_amount, 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Due within 7 days</TableCell>
                <TableCell className="text-right">{dueSoon.length}</TableCell>
                <TableCell className="text-right text-warning">
                  {formatCurrency(dueSoon.reduce((sum, i) => sum + i.outstanding_amount, 0))}
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
                      .reduce((sum, i) => sum + i.outstanding_amount, 0),
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
                      .reduce((sum, i) => sum + i.outstanding_amount, 0),
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
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const daysOverdue =
                  invoice.due_date && invoice.outstanding_amount > 0.001
                    ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
                    : 0;
                const canReceivePayment = invoice.outstanding_amount > 0.001
                  && !["draft", "cancelled", "canceled"].includes(invoice.status.toLowerCase());

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.customers?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.amount_paid)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(invoice.outstanding_amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.outstanding_amount <= 0.001
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
                      {invoice.outstanding_amount <= 0.001 ? "-" : daysOverdue > 0 ? `${daysOverdue} days` : "Current"}
                    </TableCell>
                    <TableCell className="text-right">
                      {canReceivePayment ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReceivePaymentDialog(invoice)}
                        >
                          Receive Payment
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
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

      <Dialog open={isReceivePaymentOpen} onOpenChange={closeReceivePaymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Invoice Payment</DialogTitle>
          </DialogHeader>

          {selectedInvoiceForPayment && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{selectedInvoiceForPayment.invoice_number}</p>
                <p className="text-muted-foreground">{selectedInvoiceForPayment.customers?.name || "Customer"}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-muted-foreground">Outstanding balance</span>
                  <span className="font-semibold">{formatCurrency(selectedInvoiceForPayment.outstanding_amount)}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">Amount Received</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-date">Payment Date</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-account">Deposit To</Label>
                <Select
                  value={paymentForm.payment_account_id}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_account_id: value })}
                >
                  <SelectTrigger id="payment-account">
                    <SelectValue placeholder="Select bank or cash account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_name} ({account.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notes</Label>
                <Input
                  id="payment-notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Receipt number or payment reference"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => closeReceivePaymentDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => receivePaymentMutation.mutate()}
                  disabled={receivePaymentMutation.isPending || bankAccounts.length === 0}
                >
                  {receivePaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
