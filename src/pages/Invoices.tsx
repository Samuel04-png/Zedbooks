import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FilePenLine, MoreHorizontal, Plus, Search, Send, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { accountingService, companyService } from "@/services/firebase";

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  customerId: string | null;
  customerName: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  journal_entry_id: string | null;
}

interface InvoiceLineItemRecord {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

const MANUAL_STATUS_OPTIONS = [
  { value: "Draft", label: "Mark as Draft" },
  { value: "Unpaid", label: "Mark as Unpaid" },
  { value: "Overdue", label: "Mark as Overdue" },
  { value: "Cancelled", label: "Cancel invoice" },
] as const;

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
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString();
    }
  }
  return "";
};

const normalizeStatus = (status: string) => status.trim().toLowerCase();

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: userRole } = useUserRole();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const canReversePostedEntries = [
    "super_admin",
    "admin",
    "financial_manager",
    "accountant",
    "assistant_accountant",
  ].includes(userRole || "");
  const canManageInvoices = [
    "super_admin",
    "admin",
    "financial_manager",
    "accountant",
    "assistant_accountant",
    "finance_officer",
    "bookkeeper",
    "cashier",
  ].includes(userRole || "");

  const invalidateInvoiceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const { data: companyId } = useQuery({
    queryKey: ["invoice-actions-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      if (!user) return [] as InvoiceRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as InvoiceRecord[];

      const invoicesRef = collection(firestore, COLLECTIONS.INVOICES);
      const invoiceSnapshot = await getDocs(
        query(invoicesRef, where("companyId", "==", membership.companyId)),
      );

      const invoicesWithoutCustomer = invoiceSnapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;

        return {
          id: docSnap.id,
          invoiceNumber: String(row.invoiceNumber ?? row.invoice_number ?? ""),
          invoiceDate: toDateString(row.invoiceDate ?? row.invoice_date),
          dueDate: toDateString(row.dueDate ?? row.due_date) || null,
          customerId: (row.customerId ?? row.customer_id ?? null) as string | null,
          customerName: "-",
          total: Number(row.totalAmount ?? row.total_amount ?? row.total ?? 0),
          amountPaid: Number(row.amountPaid ?? row.amount_paid ?? 0),
          balanceDue: Math.max(
            Number(row.totalAmount ?? row.total_amount ?? row.total ?? 0)
            - Number(row.amountPaid ?? row.amount_paid ?? 0),
            0,
          ),
          status: String(row.status ?? "draft"),
          journal_entry_id: (row.journalEntryId ?? row.journal_entry_id ?? null) as string | null,
        } satisfies InvoiceRecord;
      });

      const customerIds = Array.from(
        new Set(invoicesWithoutCustomer.map((invoice) => invoice.customerId).filter(Boolean)),
      ) as string[];

      const customerMap = new Map<string, string>();
      if (customerIds.length > 0) {
        const customersRef = collection(firestore, COLLECTIONS.CUSTOMERS);
        const customerChunks = chunk(customerIds, 30);

        const customerSnapshots = await Promise.all(
          customerChunks.map((ids) => getDocs(query(customersRef, where(documentId(), "in", ids)))),
        );

        customerSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            customerMap.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return invoicesWithoutCustomer
        .map((invoice) => ({
          ...invoice,
          customerName: (invoice.customerId && customerMap.get(invoice.customerId)) || "-",
        }))
        .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
    },
    enabled: Boolean(user),
  });

  const reverseInvoiceMutation = useMutation({
    mutationFn: async (invoice: InvoiceRecord) => {
      if (!user) throw new Error("Not authenticated");
      if (!invoice.journal_entry_id) {
        throw new Error("Invoice has no posted journal entry to reverse.");
      }
      if (Number(invoice.amountPaid || 0) > 0.001) {
        throw new Error("Reverse invoice payment entries first before reversing this invoice.");
      }
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("Company context not found");

      const reason = prompt(`Reason for reversing invoice ${invoice.invoiceNumber} (optional):`) || undefined;
      return accountingService.reverseJournalEntry({
        companyId: membership.companyId,
        journalEntryId: invoice.journal_entry_id,
        reason,
      });
    },
    onSuccess: () => {
      invalidateInvoiceQueries();
      toast.success("Invoice journal entry reversed");
    },
    onError: (error) => {
      toast.error(`Failed to reverse invoice: ${error.message}`);
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ invoice, status }: { invoice: InvoiceRecord; status: string }) => {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("Company context not found");

      return accountingService.updateInvoiceStatus({
        companyId: membership.companyId,
        invoiceId: invoice.id,
        status,
      });
    },
    onSuccess: (_, variables) => {
      invalidateInvoiceQueries();
      toast.success(`Invoice ${variables.invoice.invoiceNumber} updated to ${variables.status}`);
    },
    onError: (error) => {
      toast.error(`Failed to update invoice status: ${error.message}`);
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoice: InvoiceRecord) => {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("Company context not found");

      return accountingService.deleteInvoice({
        companyId: membership.companyId,
        invoiceId: invoice.id,
      });
    },
    onSuccess: (_, invoice) => {
      invalidateInvoiceQueries();
      toast.success(`Invoice ${invoice.invoiceNumber} deleted`);
    },
    onError: (error) => {
      toast.error(`Failed to delete invoice: ${error.message}`);
    },
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(amount);

  const buildInvoiceDownloadMarkup = (
    invoice: InvoiceRecord,
    lineItems: InvoiceLineItemRecord[],
    company: Awaited<ReturnType<typeof companyService.getCompanyById>>,
  ) => {
    const subtotal = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
    const taxAmount = Math.max(invoice.total - subtotal, 0);
    const notesHtml = "";

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(invoice.invoiceNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
      .page { max-width: 960px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }
      .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 32px; }
      .title { font-size: 34px; font-weight: 700; margin: 0 0 8px; }
      .muted { color: #475569; font-size: 14px; line-height: 1.6; }
      .pill { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #e2e8f0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
      .section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-bottom: 28px; }
      .card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; }
      .card h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { padding: 14px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .right { text-align: right; }
      .summary { margin-top: 24px; margin-left: auto; width: 320px; }
      .summary-row { display: flex; justify-content: space-between; padding: 8px 0; }
      .summary-total { font-size: 18px; font-weight: 700; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 14px; }
      .footer { margin-top: 36px; font-size: 13px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div>
          <p class="title">Invoice</p>
          <div class="muted">
            <div><strong>${escapeHtml(company?.name || "Your Company")}</strong></div>
            <div>${escapeHtml(company?.email || "-")}</div>
            <div>${escapeHtml(company?.phone || "-")}</div>
            <div>${escapeHtml(company?.address || "-")}</div>
            <div>TPIN: ${escapeHtml(company?.tpin || "-")}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span class="pill">${escapeHtml(invoice.status)}</span>
          <div class="muted" style="margin-top:12px;">
            <div><strong>Invoice #</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
            <div><strong>Invoice Date</strong> ${escapeHtml(invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM yyyy") : "-")}</div>
            <div><strong>Due Date</strong> ${escapeHtml(invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "-")}</div>
          </div>
        </div>
      </div>

      <div class="section-grid">
        <div class="card">
          <h3>Bill To</h3>
          <div><strong>${escapeHtml(invoice.customerName || "Customer")}</strong></div>
        </div>
        <div class="card">
          <h3>Account Summary</h3>
          <div class="summary-row"><span>Total</span><strong>${escapeHtml(formatCurrency(invoice.total))}</strong></div>
          <div class="summary-row"><span>Paid</span><strong>${escapeHtml(formatCurrency(invoice.amountPaid))}</strong></div>
          <div class="summary-row"><span>Balance Due</span><strong>${escapeHtml(formatCurrency(invoice.balanceDue))}</strong></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map((line) => `
            <tr>
              <td>${escapeHtml(line.description || "-")}</td>
              <td class="right">${escapeHtml(line.quantity.toFixed(2))}</td>
              <td class="right">${escapeHtml(formatCurrency(line.unitPrice))}</td>
              <td class="right">${escapeHtml(formatCurrency(line.lineTotal))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(subtotal))}</span></div>
        <div class="summary-row"><span>Tax</span><span>${escapeHtml(formatCurrency(taxAmount))}</span></div>
        <div class="summary-row summary-total"><span>Total</span><span>${escapeHtml(formatCurrency(invoice.total))}</span></div>
      </div>

      ${notesHtml}

      <div class="footer">
        Generated from ZedBooks on ${escapeHtml(format(new Date(), "dd MMM yyyy HH:mm"))}
      </div>
    </div>
  </body>
</html>`;
  };

  const downloadInvoiceDocument = async (invoice: InvoiceRecord) => {
    if (!user || !companyId) {
      throw new Error("Company context not found");
    }

    const downloadWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=900");
    if (!downloadWindow) {
      throw new Error("Allow pop-ups to download invoices.");
    }

    downloadWindow.document.write("<p style=\"font-family: Arial, sans-serif; padding: 24px;\">Preparing invoice...</p>");
    downloadWindow.document.close();

    try {
      const [company, invoiceItemsSnapshot] = await Promise.all([
        companyService.getCompanyById(companyId),
        getDocs(query(collection(firestore, COLLECTIONS.INVOICE_ITEMS), where("invoiceId", "==", invoice.id))),
      ]);

      const lineItems = invoiceItemsSnapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        const quantity = Number(row.quantity ?? 1);
        const unitPrice = Number(row.unitPrice ?? row.unit_price ?? 0);
        return {
          description: String(row.description ?? ""),
          quantity,
          unitPrice,
          lineTotal: Number(row.lineTotal ?? row.line_total ?? quantity * unitPrice),
        } satisfies InvoiceLineItemRecord;
      });

      const markup = buildInvoiceDownloadMarkup(invoice, lineItems, company);
      downloadWindow.document.open();
      downloadWindow.document.write(markup);
      downloadWindow.document.close();
      window.setTimeout(() => {
        downloadWindow.focus();
        downloadWindow.print();
      }, 350);
    } catch (error) {
      downloadWindow.close();
      throw error;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (normalizeStatus(status)) {
      case "paid":
        return "default" as const;
      case "overdue":
        return "destructive" as const;
      case "draft":
      case "cancelled":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  const getStatusOptions = (invoice: InvoiceRecord) => {
    if (!canManageInvoices || Number(invoice.amountPaid || 0) > 0.001) return [];

    const currentStatus = normalizeStatus(invoice.status || "draft");
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = invoice.dueDate?.slice(0, 10) || "";

    return MANUAL_STATUS_OPTIONS.filter((option) => {
      const nextStatus = normalizeStatus(option.value);
      if (nextStatus === currentStatus) return false;
      if ((nextStatus === "draft" || nextStatus === "cancelled") && invoice.journal_entry_id) return false;
      if (nextStatus === "overdue" && (!dueDate || dueDate >= today)) return false;
      return true;
    });
  };

  const handleReverseInvoice = (invoice: InvoiceRecord) => {
    if (Number(invoice.amountPaid || 0) > 0.001) {
      toast.error("Reverse invoice payments first before reversing this invoice.");
      return;
    }
    if (!confirm("Reverse this invoice posting? This creates an opposite journal entry.")) {
      return;
    }
    reverseInvoiceMutation.mutate(invoice);
  };

  const canEditInvoice = (invoice: InvoiceRecord) => (
    canManageInvoices
    && normalizeStatus(invoice.status || "draft") === "draft"
    && !invoice.journal_entry_id
    && Number(invoice.amountPaid || 0) <= 0.001
  );

  const canDeleteInvoice = (invoice: InvoiceRecord) => canEditInvoice(invoice);

  const canSendInvoice = (invoice: InvoiceRecord) => (
    canManageInvoices
    && normalizeStatus(invoice.status || "draft") === "draft"
    && Number(invoice.amountPaid || 0) <= 0.001
  );

  const handleDeleteInvoice = (invoice: InvoiceRecord) => {
    if (!canDeleteInvoice(invoice)) {
      toast.error("Only unpaid draft invoices can be deleted.");
      return;
    }
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`)) {
      return;
    }
    deleteInvoiceMutation.mutate(invoice);
  };

  const handleDownloadInvoice = async (invoice: InvoiceRecord) => {
    try {
      await downloadInvoiceDocument(invoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download invoice.";
      toast.error(message);
    }
  };

  const renderActions = (invoice: InvoiceRecord, fullWidth = false) => {
    const statusOptions = getStatusOptions(invoice);
    const showReverseAction = Boolean(invoice.journal_entry_id) && canReversePostedEntries;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={fullWidth ? "w-full justify-between" : "gap-2"}
          >
            Actions
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Invoice actions</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!canEditInvoice(invoice)}
            onSelect={() => navigate(`/invoices/${invoice.id}/edit`)}
          >
            <FilePenLine className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canSendInvoice(invoice) || updateInvoiceStatusMutation.isPending}
            onSelect={() => updateInvoiceStatusMutation.mutate({ invoice, status: "Unpaid" })}
          >
            <Send className="mr-2 h-4 w-4" />
            Send
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleDownloadInvoice(invoice)}>
            <Download className="mr-2 h-4 w-4" />
            Save & Download
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canDeleteInvoice(invoice) || deleteInvoiceMutation.isPending}
            onSelect={() => handleDeleteInvoice(invoice)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>

          {statusOptions.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Change status</DropdownMenuLabel>
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={`${invoice.id}-${option.value}`}
                  disabled={updateInvoiceStatusMutation.isPending}
                  onSelect={() => updateInvoiceStatusMutation.mutate({ invoice, status: option.value })}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {showReverseAction && (
            <>
              {statusOptions.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={reverseInvoiceMutation.isPending || Number(invoice.amountPaid || 0) > 0.001}
                onSelect={() => handleReverseInvoice(invoice)}
              >
                Reverse posting
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const filteredInvoices = invoices?.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
        </div>
        <Link to="/invoices/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Invoices</CardTitle>
            {!isMobile && (
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            )}
          </div>
          {isMobile && (
            <div className="relative mt-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="space-y-4">
              {filteredInvoices?.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 space-y-3 bg-card shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
                      <p className="text-sm text-muted-foreground">{invoice.customerName || "-"}</p>
                    </div>
                    <Badge variant={getStatusVariant(invoice.status || "draft")}>{invoice.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p>{invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM yyyy") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p>{invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "-"}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                    <span className="text-lg font-bold text-primary">ZMW {invoice.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p>ZMW {invoice.amountPaid.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium">ZMW {invoice.balanceDue.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    {renderActions(invoice, true)}
                  </div>
                </div>
              ))}
              {filteredInvoices?.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  No invoices found
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>
                      {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell>{invoice.customerName || "-"}</TableCell>
                    <TableCell>
                      {invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">ZMW {invoice.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">ZMW {invoice.amountPaid.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">ZMW {invoice.balanceDue.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invoice.status || "draft")}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        {renderActions(invoice)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredInvoices?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
