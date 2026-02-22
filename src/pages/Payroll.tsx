import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

type PayrollStatus =
  | "draft"
  | "trial"
  | "processed"
  | "paid"
  | "payment_reversed"
  | "reversed"
  | "pending_approval";
type PayrollStatusFilter = "all" | "draft" | "processed" | "paid" | "payment_reversed" | "reversed";

interface PayrollRun {
  id: string;
  runDate: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: PayrollStatus;
  payrollNumber: string | null;
  journalEntryId: string | null;
  paymentJournalEntryId: string | null;
  reversalReferenceId: string | null;
}

const normalizePayrollStatus = (raw: unknown): PayrollStatus => {
  const value = String(raw || "").toLowerCase().trim();
  if (value === "final") return "processed";
  if (value === "approved") return "processed";
  if (value === "completed") return "paid";
  if (value === "pending_approval") return "pending_approval";
  if (["draft", "trial", "processed", "paid", "payment_reversed", "reversed"].includes(value)) {
    return value as PayrollStatus;
  }
  return "draft";
};

const mapStatusLabel = (status: PayrollStatus): string => {
  if (status === "pending_approval") return "Pending Approval";
  if (status === "trial") return "Trial";
  if (status === "processed") return "Posted";
  if (status === "paid") return "Paid";
  if (status === "payment_reversed") return "Payment Reversed";
  if (status === "reversed") return "Reversed";
  return "Draft";
};

const statusBadgeVariant = (status: PayrollStatus): string => {
  if (status === "paid") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (status === "payment_reversed") return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200";
  if (status === "processed") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (status === "reversed") return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  if (status === "pending_approval") return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  if (status === "trial") return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
};

export default function Payroll() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<PayrollStatusFilter>("all");

  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ["payrollRuns", user?.id],
    queryFn: async () => {
      if (!user) return [] as PayrollRun[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as PayrollRun[];

      const payrollRunsRef = collection(firestore, COLLECTIONS.PAYROLL_RUNS);
      const snapshot = await getDocs(
        query(
          payrollRunsRef,
          where("companyId", "==", membership.companyId),
          orderBy("runDate", "desc"),
        ),
      );

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            runDate: String(row.runDate ?? row.run_date ?? ""),
            periodStart: String(row.periodStart ?? row.period_start ?? ""),
            periodEnd: String(row.periodEnd ?? row.period_end ?? ""),
            totalGross: Number(row.totalGross ?? row.total_gross ?? 0),
            totalDeductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
            totalNet: Number(row.totalNet ?? row.total_net ?? 0),
            status: normalizePayrollStatus(row.payrollStatus ?? row.payroll_status ?? row.status),
            payrollNumber: (row.payrollNumber ?? row.payroll_number ?? null) as string | null,
            journalEntryId: (row.journalEntryId ?? row.journal_entry_id ?? row.glJournalId ?? row.gl_journal_id ?? null) as string | null,
            paymentJournalEntryId: (row.paymentJournalEntryId ?? row.payment_journal_entry_id ?? null) as string | null,
            reversalReferenceId: (row.reversalReferenceId ?? row.reversal_reference_id ?? row.reversalJournalEntryId ?? row.reversal_journal_entry_id ?? null) as string | null,
          } satisfies PayrollRun;
        })
        .sort((a, b) => String(b.runDate).localeCompare(String(a.runDate)));
    },
    enabled: Boolean(user),
  });

  const filteredRuns = useMemo(() => {
    if (!payrollRuns) return [] as PayrollRun[];
    if (statusFilter === "all") return payrollRuns;
    return payrollRuns.filter((run) => run.status === statusFilter);
  }, [payrollRuns, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Manage payroll runs, posting, payments, and reversals</p>
        </div>
        <Button onClick={() => navigate("/payroll/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Payroll Run
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Status</span>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PayrollStatusFilter)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="processed">Posted</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="payment_reversed">Payment Reversed</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Gross</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Total Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reversal Reference</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">
                    {run.runDate ? format(new Date(run.runDate), "dd MMM yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    {run.periodStart ? format(new Date(run.periodStart), "dd MMM") : "-"} -{" "}
                    {run.periodEnd ? format(new Date(run.periodEnd), "dd MMM yyyy") : "-"}
                  </TableCell>
                  <TableCell>{formatZMW(run.totalGross)}</TableCell>
                  <TableCell>{formatZMW(run.totalDeductions)}</TableCell>
                  <TableCell>{formatZMW(run.totalNet)}</TableCell>
                  <TableCell>
                    <Badge className={statusBadgeVariant(run.status)}>
                      {mapStatusLabel(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {run.reversalReferenceId || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {run.status === "pending_approval" ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/payroll/${run.id}/approve`)}
                      >
                        Review & Approve
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/payroll/${run.id}`)}>
                        View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRuns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No payroll runs found for the selected status.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
