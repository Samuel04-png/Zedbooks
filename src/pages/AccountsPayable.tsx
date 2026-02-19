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
import { Download, Upload, FileText, AlertCircle, Clock, CheckCircle, RotateCcw } from "lucide-react";
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

interface BillRecord {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  total: number;
  status: string;
  vendor_id: string | null;
  vendors: { name: string } | null;
}

interface BillPaymentRecord {
  id: string;
  bill_id: string | null;
  bill_number: string;
  vendor_name: string;
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

export default function AccountsPayable() {
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

  const { data: bills = [], isLoading, refetch } = useQuery({
    queryKey: ["accounts-payable", startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) return [] as BillRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as BillRecord[];

      const billsRef = collection(firestore, COLLECTIONS.BILLS);
      const billSnapshot = await getDocs(
        query(billsRef, where("companyId", "==", membership.companyId)),
      );

      const mappedBills = billSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            bill_number: String(row.billNumber ?? row.bill_number ?? `BILL-${docSnap.id.slice(0, 8).toUpperCase()}`),
            bill_date: toDateString(row.billDate ?? row.bill_date),
            due_date: toDateString(row.dueDate ?? row.due_date) || null,
            total: Number(row.total ?? 0),
            status: String(row.status ?? "pending"),
            vendor_id: (row.vendorId ?? row.vendor_id ?? null) as string | null,
            vendors: null,
          } satisfies BillRecord;
        })
        .filter((bill) => bill.bill_date >= startDate && bill.bill_date <= endDate);

      const vendorIds = Array.from(new Set(mappedBills.map((bill) => bill.vendor_id).filter(Boolean))) as string[];
      const vendorNameById = new Map<string, string>();

      if (vendorIds.length > 0) {
        const vendorsRef = collection(firestore, COLLECTIONS.VENDORS);
        const vendorChunks = chunk(vendorIds, 30);
        const snapshots = await Promise.all(
          vendorChunks.map((ids) => getDocs(query(vendorsRef, where(documentId(), "in", ids)))),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            vendorNameById.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return mappedBills
        .map((bill) => ({
          ...bill,
          vendors: bill.vendor_id ? { name: vendorNameById.get(bill.vendor_id) || "-" } : null,
        }))
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
    },
    enabled: Boolean(user),
  });

  const { data: billPayments = [] } = useQuery({
    queryKey: ["accounts-payable-payments", startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) return [] as BillPaymentRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as BillPaymentRecord[];

      const paymentsRef = collection(firestore, COLLECTIONS.BILL_PAYMENTS);
      const paymentSnapshot = await getDocs(
        query(paymentsRef, where("companyId", "==", membership.companyId)),
      );

      const payments = paymentSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            bill_id: (row.billId ?? row.bill_id ?? null) as string | null,
            amount: Number(row.amount ?? 0),
            payment_date: toDateString(row.paymentDate ?? row.payment_date),
            notes: (row.notes ?? null) as string | null,
            journal_entry_id: (row.journalEntryId ?? row.journal_entry_id ?? null) as string | null,
            is_reversed: Boolean(row.isReversed ?? row.is_reversed ?? false),
          };
        })
        .filter((payment) => payment.payment_date >= startDate && payment.payment_date <= endDate);

      const billIds = Array.from(
        new Set(payments.map((payment) => payment.bill_id).filter(Boolean)),
      ) as string[];

      const billById = new Map<string, { billNumber: string; vendorId: string | null }>();
      if (billIds.length > 0) {
        const billChunks = chunk(billIds, 30);
        const snapshots = await Promise.all(
          billChunks.map((ids) =>
            getDocs(query(collection(firestore, COLLECTIONS.BILLS), where(documentId(), "in", ids))),
          ),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            billById.set(docSnap.id, {
              billNumber: String(row.billNumber ?? row.bill_number ?? `BILL-${docSnap.id.slice(0, 8).toUpperCase()}`),
              vendorId: (row.vendorId ?? row.vendor_id ?? null) as string | null,
            });
          });
        });
      }

      const vendorIds = Array.from(
        new Set(
          Array.from(billById.values())
            .map((bill) => bill.vendorId)
            .filter(Boolean),
        ),
      ) as string[];

      const vendorNameById = new Map<string, string>();
      if (vendorIds.length > 0) {
        const vendorChunks = chunk(vendorIds, 30);
        const snapshots = await Promise.all(
          vendorChunks.map((ids) =>
            getDocs(query(collection(firestore, COLLECTIONS.VENDORS), where(documentId(), "in", ids))),
          ),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            vendorNameById.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return payments
        .map((payment) => {
          const bill = payment.bill_id ? billById.get(payment.bill_id) : null;
          const vendorName = (bill?.vendorId && vendorNameById.get(bill.vendorId)) || "-";
          return {
            id: payment.id,
            bill_id: payment.bill_id,
            bill_number: bill?.billNumber || "-",
            vendor_name: vendorName,
            amount: payment.amount,
            payment_date: payment.payment_date,
            notes: payment.notes,
            journal_entry_id: payment.journal_entry_id,
            is_reversed: payment.is_reversed,
          } satisfies BillPaymentRecord;
        })
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    },
    enabled: Boolean(user),
  });

  const reverseBillPaymentMutation = useMutation({
    mutationFn: async (payment: BillPaymentRecord) => {
      if (!user) throw new Error("Not authenticated");
      if (!payment.journal_entry_id) {
        throw new Error("Payment has no posted journal entry to reverse.");
      }
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("No company profile found for your account");
      const reason = prompt(`Reason for reversing payment for ${payment.bill_number} (optional):`) || undefined;
      return accountingService.reverseJournalEntry({
        companyId: membership.companyId,
        journalEntryId: payment.journal_entry_id,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Bill payment journal entry reversed");
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

  const unpaidBills = bills.filter((b) => b.status.toLowerCase() !== "paid");
  const overdueBills = unpaidBills.filter((b) => b.due_date && isPast(new Date(b.due_date)));
  const dueSoon = unpaidBills.filter((b) => {
    if (!b.due_date) return false;
    const days = differenceInDays(new Date(b.due_date), new Date());
    return days >= 0 && days <= 7;
  });
  const paidBills = bills.filter((b) => b.status.toLowerCase() === "paid");

  const totalOutstanding = unpaidBills.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalOverdue = overdueBills.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalPaid = paidBills.reduce((sum, b) => sum + (b.total || 0), 0);

  const exportReport = () => {
    const columns = [
      { header: "Bill Number", key: "bill_number" },
      { header: "Bill Date", key: "bill_date" },
      { header: "Due Date", key: "due_date" },
      { header: "Amount", key: "total" },
      { header: "Status", key: "status" },
    ];
    exportToCSV(bills as Record<string, unknown>[], columns, `accounts-payable-${startDate}-to-${endDate}`);
  };

  const importColumns = [
    { key: "bill_number", header: "Bill Number", required: true },
    { key: "vendor_name", header: "Vendor Name", required: false },
    { key: "bill_date", header: "Bill Date (YYYY-MM-DD)", required: true },
    { key: "due_date", header: "Due Date (YYYY-MM-DD)", required: false },
    { key: "amount", header: "Amount", required: true },
    { key: "description", header: "Description", required: false },
  ];

  const handleImport = async (data: Record<string, unknown>[]) => {
    if (!user) throw new Error("You must be logged in");

    const membership = await companyService.getPrimaryMembershipByUser(user.id);
    if (!membership?.companyId) throw new Error("No company profile found for your account");

    for (const row of data) {
      const billDate = String(row.bill_date || new Date().toISOString().slice(0, 10));
      const dueDate = (row.due_date as string) || billDate;
      const amount = Number(row.amount) || 0;

      await accountingService.createBill({
        companyId: membership.companyId,
        amount,
        billDate,
        dueDate,
        categoryName: "Miscellaneous",
        description: (row.description as string) || "Imported bill",
      });
    }

    refetch();
    toast.success("Bills imported successfully");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts Payable</h1>
          <p className="text-muted-foreground">Track and manage vendor bills and payments</p>
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
              Total Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">{unpaidBills.length} bills</p>
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
            <p className="text-xs text-muted-foreground">{overdueBills.length} bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{paidBills.length} bills</p>
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
                <TableHead className="text-right">Bills</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Current (not due)</TableCell>
                <TableCell className="text-right">
                  {unpaidBills.filter((b) => !b.due_date || differenceInDays(new Date(b.due_date), new Date()) > 7).length}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    unpaidBills
                      .filter((b) => !b.due_date || differenceInDays(new Date(b.due_date), new Date()) > 7)
                      .reduce((sum, b) => sum + (b.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Due within 7 days</TableCell>
                <TableCell className="text-right">{dueSoon.length}</TableCell>
                <TableCell className="text-right text-warning">
                  {formatCurrency(dueSoon.reduce((sum, b) => sum + (b.total || 0), 0))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>1-30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueBills.filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) <= 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {formatCurrency(
                    overdueBills
                      .filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) <= 30)
                      .reduce((sum, b) => sum + (b.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Over 30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueBills.filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) > 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive font-bold">
                  {formatCurrency(
                    overdueBills
                      .filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) > 30)
                      .reduce((sum, b) => sum + (b.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Bill Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => {
                const daysOverdue =
                  bill.due_date && bill.status.toLowerCase() !== "paid"
                    ? Math.max(0, differenceInDays(new Date(), new Date(bill.due_date)))
                    : 0;
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.bill_number}</TableCell>
                    <TableCell>{bill.vendors?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(bill.bill_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{bill.due_date ? format(new Date(bill.due_date), "dd MMM yyyy") : "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(bill.total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          bill.status.toLowerCase() === "paid"
                            ? "default"
                            : daysOverdue > 0
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{bill.status.toLowerCase() === "paid" ? "-" : daysOverdue > 0 ? `${daysOverdue} days` : "Current"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bill Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.payment_date ? format(new Date(payment.payment_date), "dd MMM yyyy") : "-"}</TableCell>
                  <TableCell className="font-medium">{payment.bill_number}</TableCell>
                  <TableCell>{payment.vendor_name}</TableCell>
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
                        disabled={reverseBillPaymentMutation.isPending}
                        onClick={() => {
                          if (!confirm("Reverse this bill payment entry?")) {
                            return;
                          }
                          reverseBillPaymentMutation.mutate(payment);
                        }}
                        title="Reverse payment entry"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {billPayments.length === 0 && (
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
        title="Import Bills"
      />
    </div>
  );
}
