import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Mail, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { payrollService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { firestore } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PayrollRunRecord {
  id: string;
  status: string | null;
  period_start: string;
  period_end: string;
  approved_at: string | null;
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
  notes: string | null;
}

interface PayrollEmployeeSummary {
  id: string;
  full_name: string;
  employee_number: string;
  position: string | null;
  department: string | null;
  email: string | null;
  bank_account_number: string | null;
}

interface PayrollItemSummary {
  id: string;
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  gross_salary: number;
  napsa_employee: number;
  nhima_employee: number;
  paye: number;
  advances_deducted: number | null;
  total_deductions: number;
  net_salary: number;
  employees: PayrollEmployeeSummary | null;
}

interface PayrollAdditionSummary {
  id: string;
  type: string;
  name: string;
  amount: number;
  employees: {
    full_name: string;
    employee_number: string;
  } | null;
}

export default function PayrollApproval() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  const { data: payrollRun, isLoading } = useQuery({
    queryKey: ["payrollRun", id],
    queryFn: async () => {
      if (!id) return null;
      const runSnap = await getDoc(doc(firestore, COLLECTIONS.PAYROLL_RUNS, id));
      if (!runSnap.exists()) return null;

      const row = runSnap.data() as Record<string, unknown>;
      return {
        id: runSnap.id,
        status: (row.status as string | null) ?? (row.payrollStatus as string | null) ?? "draft",
        period_start: String(row.periodStart ?? row.period_start ?? ""),
        period_end: String(row.periodEnd ?? row.period_end ?? ""),
        approved_at: (row.approvedAt as string | null) ?? (row.approved_at as string | null) ?? null,
        total_gross: Number(row.totalGross ?? row.total_gross ?? 0),
        total_deductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
        total_net: Number(row.totalNet ?? row.total_net ?? 0),
        notes: (row.notes as string | null) ?? null,
      } satisfies PayrollRunRecord;
    },
    enabled: Boolean(user && id),
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payrollItems", id],
    queryFn: async () => {
      if (!id) return [] as PayrollItemSummary[];

      const itemsRef = collection(firestore, COLLECTIONS.PAYROLL_ITEMS);
      let itemSnap = await getDocs(query(itemsRef, where("payrollRunId", "==", id)));
      if (itemSnap.empty) {
        itemSnap = await getDocs(query(itemsRef, where("payroll_run_id", "==", id)));
      }

      const rows = itemSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        row: docSnap.data() as Record<string, unknown>,
      }));

      const employeeIds = Array.from(
        new Set(rows.map(({ row }) => String(row.employeeId ?? row.employee_id ?? "")).filter(Boolean)),
      );

      const employeeDocs = await Promise.all(
        employeeIds.map(async (employeeDocId) => {
          const snap = await getDoc(doc(firestore, COLLECTIONS.EMPLOYEES, employeeDocId));
          return { employeeDocId, snap };
        }),
      );

      const employeeMap = new Map<string, PayrollEmployeeSummary>();
      employeeDocs.forEach(({ employeeDocId, snap }) => {
        if (!snap.exists()) return;
        const row = snap.data() as Record<string, unknown>;
        employeeMap.set(employeeDocId, {
          id: snap.id,
          full_name: String(row.fullName ?? row.full_name ?? ""),
          employee_number: String(row.employeeNumber ?? row.employee_number ?? ""),
          position: (row.position as string | null) ?? null,
          department: (row.department as string | null) ?? null,
          email: (row.email as string | null) ?? null,
          bank_account_number: (row.bankAccountNumber as string | null) ?? (row.bank_account_number as string | null) ?? null,
        });
      });

      return rows.map(({ id: itemId, row }) => {
        const employeeId = String(row.employeeId ?? row.employee_id ?? "");
        return {
          id: itemId,
          employee_id: employeeId,
          basic_salary: Number(row.basicSalary ?? row.basic_salary ?? 0),
          housing_allowance: Number(row.housingAllowance ?? row.housing_allowance ?? 0),
          transport_allowance: Number(row.transportAllowance ?? row.transport_allowance ?? 0),
          other_allowances: Number(row.otherAllowances ?? row.other_allowances ?? 0),
          gross_salary: Number(row.grossSalary ?? row.gross_salary ?? 0),
          napsa_employee: Number(row.napsaEmployee ?? row.napsa_employee ?? 0),
          nhima_employee: Number(row.nhimaEmployee ?? row.nhima_employee ?? 0),
          paye: Number(row.paye ?? 0),
          advances_deducted: Number(row.advancesDeducted ?? row.advances_deducted ?? 0),
          total_deductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
          net_salary: Number(row.netSalary ?? row.net_salary ?? 0),
          employees: employeeMap.get(employeeId) ?? null,
        } satisfies PayrollItemSummary;
      });
    },
    enabled: Boolean(user && id),
  });

  const { data: payrollAdditions } = useQuery({
    queryKey: ["payrollAdditions", id],
    queryFn: async () => {
      if (!id) return [] as PayrollAdditionSummary[];

      const additionsRef = collection(firestore, COLLECTIONS.PAYROLL_ADDITIONS);
      let additionsSnap = await getDocs(query(additionsRef, where("payrollRunId", "==", id)));
      if (additionsSnap.empty) {
        additionsSnap = await getDocs(query(additionsRef, where("payroll_run_id", "==", id)));
      }

      const rows = additionsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        row: docSnap.data() as Record<string, unknown>,
      }));

      const employeeIds = Array.from(
        new Set(rows.map(({ row }) => String(row.employeeId ?? row.employee_id ?? "")).filter(Boolean)),
      );
      const employeeDocs = await Promise.all(
        employeeIds.map(async (employeeDocId) => {
          const snap = await getDoc(doc(firestore, COLLECTIONS.EMPLOYEES, employeeDocId));
          return { employeeDocId, snap };
        }),
      );

      const employeeMap = new Map<string, PayrollAdditionSummary["employees"]>();
      employeeDocs.forEach(({ employeeDocId, snap }) => {
        if (!snap.exists()) return;
        const row = snap.data() as Record<string, unknown>;
        employeeMap.set(employeeDocId, {
          full_name: String(row.fullName ?? row.full_name ?? ""),
          employee_number: String(row.employeeNumber ?? row.employee_number ?? ""),
        });
      });

      return rows.map(({ id: additionId, row }) => {
        const employeeId = String(row.employeeId ?? row.employee_id ?? "");
        return {
          id: additionId,
          type: String(row.type ?? ""),
          name: String(row.name ?? ""),
          amount: Number(row.amount ?? 0),
          employees: employeeMap.get(employeeId) ?? null,
        } satisfies PayrollAdditionSummary;
      });
    },
    enabled: Boolean(user && id),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!id || !user) throw new Error("Not authenticated");
      await updateDoc(doc(firestore, COLLECTIONS.PAYROLL_RUNS, id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: user.id,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Payroll approved successfully!");
    },
    onError: () => {
      toast.error("Failed to approve payroll");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Payroll run not found");
      await updateDoc(doc(firestore, COLLECTIONS.PAYROLL_RUNS, id), {
        status: "draft",
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Payroll rejected and returned to draft");
      navigate("/payroll");
    },
    onError: () => {
      toast.error("Failed to reject payroll");
    },
  });

  const handleBulkEmailPayslips = async () => {
    if (!payrollItems || payrollItems.length === 0) {
      toast.error("No payroll items to email");
      return;
    }

    const employeesWithEmail = payrollItems.filter((item) => Boolean(item.employees?.email));

    if (employeesWithEmail.length === 0) {
      toast.error("No employees have email addresses configured");
      return;
    }

    setIsSendingEmails(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of employeesWithEmail) {
      try {
        if (!id) continue;
        await payrollService.sendPayslipEmail({
          payrollRunId: id,
          employeeId: item.employee_id,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsSendingEmails(false);

    if (successCount > 0) {
      toast.success(`Successfully sent ${successCount} payslip email(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} email(s)`);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!payrollRun) {
    return <div>Payroll run not found</div>;
  }

  const isApproved = payrollRun.status === "approved" || payrollRun.status === "completed";

  // Group additions by type
  const totalAdditions = payrollAdditions?.reduce(
    (sum, addition) => sum + (addition.type !== "advance" ? Number(addition.amount) : 0),
    0
  ) || 0;

  const totalAdvances = payrollAdditions?.reduce(
    (sum, addition) => sum + (addition.type === "advance" ? Number(addition.amount) : 0),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Payroll Approval</h1>
          <p className="text-muted-foreground">
            Review and approve payroll for{" "}
            {format(new Date(payrollRun.period_start), "dd MMM")} -{" "}
            {format(new Date(payrollRun.period_end), "dd MMM yyyy")}
          </p>
        </div>
        {isApproved && (
          <Button onClick={handleBulkEmailPayslips} disabled={isSendingEmails}>
            {isSendingEmails ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {isSendingEmails ? "Sending..." : "Email All Payslips"}
          </Button>
        )}
      </div>

      {/* Status Banner */}
      {isApproved && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              This payroll has been approved
            </p>
            {payrollRun.approved_at && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Approved on {format(new Date(payrollRun.approved_at), "dd MMM yyyy 'at' HH:mm")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employees</CardDescription>
            <CardTitle className="text-2xl">{payrollItems?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gross Pay</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatZMW(Number(payrollRun.total_gross || 0))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deductions</CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {formatZMW(Number(payrollRun.total_deductions || 0))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>Total Net Pay</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatZMW(Number(payrollRun.total_net || 0))}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Payroll Additions Summary */}
      {payrollAdditions && payrollAdditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Additions & Advances</CardTitle>
            <CardDescription>
              Custom earnings, bonuses, overtime, and advance deductions for this payroll run
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Additional Earnings</p>
                <p className="text-xl font-bold text-primary">{formatZMW(totalAdditions)}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Advance Deductions</p>
                <p className="text-xl font-bold text-destructive">{formatZMW(totalAdvances)}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Additions</p>
                <p className="text-xl font-bold">{payrollAdditions.length}</p>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollAdditions.map((addition) => (
                    <TableRow key={addition.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{addition.employees?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {addition.employees?.employee_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={addition.type === "advance" ? "destructive" : "default"}>
                          {addition.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{addition.name}</TableCell>
                      <TableCell className={`text-right font-medium ${addition.type === "advance" ? "text-destructive" : "text-primary"}`}>
                        {addition.type === "advance" ? "-" : ""}{formatZMW(Number(addition.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Breakdown</CardTitle>
          <CardDescription>Review individual payroll calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NAPSA</TableHead>
                  <TableHead className="text-right">NHIMA</TableHead>
                  <TableHead className="text-right">Advances</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.employees?.full_name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.employees?.employee_number || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{item.employees?.department || "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.gross_salary))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.paye))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.napsa_employee))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.nhima_employee))}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatZMW(Number(item.advances_deducted || 0))}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatZMW(Number(item.total_deductions))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatZMW(Number(item.net_salary))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {payrollRun.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{payrollRun.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      {!isApproved && (
        <div className="flex justify-end gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive">
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject Payroll?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will return the payroll to draft status for corrections. The payroll will need to be resubmitted for approval.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => rejectMutation.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Reject Payroll
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Payroll
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve Payroll?</AlertDialogTitle>
                <AlertDialogDescription>
                  By approving this payroll, you confirm that all calculations are correct and payments can proceed.
                  <br /><br />
                  <strong>Total Net Pay: {formatZMW(Number(payrollRun.total_net || 0))}</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => approveMutation.mutate()}>
                  Approve Payroll
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
