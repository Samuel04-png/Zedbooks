import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface PayrollRun {
  id: string;
  runDate: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: string;
}

const mapStatusLabel = (status: string): string => {
  if (status === "pending_approval") return "Pending Approval";
  if (status === "final") return "Final";
  return status;
};

const statusClassName = (status: string): string => {
  if (["completed", "approved", "final"].includes(status)) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }

  if (status === "pending_approval") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  }

  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
};

export default function Payroll() {
  const navigate = useNavigate();
  const { user } = useAuth();

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

      return snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          runDate: String(row.runDate ?? row.run_date ?? ""),
          periodStart: String(row.periodStart ?? row.period_start ?? ""),
          periodEnd: String(row.periodEnd ?? row.period_end ?? ""),
          totalGross: Number(row.totalGross ?? row.total_gross ?? 0),
          totalDeductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
          totalNet: Number(row.totalNet ?? row.total_net ?? 0),
          status: String(row.status ?? row.payrollStatus ?? row.payroll_status ?? "draft"),
        } satisfies PayrollRun;
      });
    },
    enabled: Boolean(user),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Manage payroll runs and employee payments</p>
        </div>
        <Button onClick={() => navigate("/payroll/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Payroll Run
        </Button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Gross</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Total Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns?.map((run) => (
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
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClassName(run.status)}`}
                    >
                      {mapStatusLabel(run.status)}
                    </span>
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
              {payrollRuns?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No payroll runs found. Create your first payroll run to get started.
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
