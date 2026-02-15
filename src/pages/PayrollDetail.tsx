import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Play, CheckCircle, RotateCcw, AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
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
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { payrollService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { firestore } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

type PayrollStatus = "draft" | "trial" | "final";

interface PayrollRunDetail {
  id: string;
  run_date: string;
  period_start: string;
  period_end: string;
  payroll_status: PayrollStatus | null;
  status: string | null;
  payroll_number: string | null;
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
  gl_journal_id: string | null;
}

interface PayrollEmployeeDetail {
  full_name: string;
  employee_number: string;
  email: string | null;
  position: string | null;
  department: string | null;
  tpin: string | null;
  napsa_number: string | null;
  nhima_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
}

interface PayrollItemDetail {
  id: string;
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  gross_salary: number;
  advances_deducted: number | null;
  net_salary: number;
  paye: number;
  napsa_employee: number;
  napsa_employer: number;
  nhima_employee: number;
  nhima_employer: number;
  total_deductions: number;
  employees: PayrollEmployeeDetail | null;
}

interface PayrollJournalDetail {
  id: string;
  description: string | null;
  journal_entries: {
    id: string;
    reference_number: string | null;
    entry_date: string;
    description: string | null;
    is_posted: boolean | null;
  } | null;
}

export default function PayrollDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: payrollRun, isLoading } = useQuery({
    queryKey: ["payrollRun", id],
    queryFn: async () => {
      if (!id) return null;
      const runSnap = await getDoc(doc(firestore, COLLECTIONS.PAYROLL_RUNS, id));
      if (!runSnap.exists()) return null;

      const row = runSnap.data() as Record<string, unknown>;
      return {
        id: runSnap.id,
        run_date: String(row.runDate ?? row.run_date ?? ""),
        period_start: String(row.periodStart ?? row.period_start ?? ""),
        period_end: String(row.periodEnd ?? row.period_end ?? ""),
        payroll_status: (row.payrollStatus ?? row.payroll_status ?? row.status ?? "draft") as PayrollStatus,
        status: (row.status as string | null) ?? null,
        payroll_number: (row.payrollNumber as string | null) ?? (row.payroll_number as string | null) ?? null,
        total_gross: Number(row.totalGross ?? row.total_gross ?? 0),
        total_deductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
        total_net: Number(row.totalNet ?? row.total_net ?? 0),
        gl_journal_id: (row.glJournalId as string | null) ?? (row.gl_journal_id as string | null) ?? null,
      } satisfies PayrollRunDetail;
    },
    enabled: Boolean(user && id),
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payrollItems", id],
    queryFn: async () => {
      if (!id) return [] as PayrollItemDetail[];

      const itemsRef = collection(firestore, COLLECTIONS.PAYROLL_ITEMS);
      let itemsSnap = await getDocs(query(itemsRef, where("payrollRunId", "==", id)));
      if (itemsSnap.empty) {
        itemsSnap = await getDocs(query(itemsRef, where("payroll_run_id", "==", id)));
      }

      const rows = itemsSnap.docs.map((docSnap) => ({
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

      const employeeMap = new Map<string, PayrollEmployeeDetail>();
      employeeDocs.forEach(({ employeeDocId, snap }) => {
        if (!snap.exists()) return;
        const emp = snap.data() as Record<string, unknown>;
        employeeMap.set(employeeDocId, {
          full_name: String(emp.fullName ?? emp.full_name ?? ""),
          employee_number: String(emp.employeeNumber ?? emp.employee_number ?? ""),
          email: (emp.email as string | null) ?? null,
          position: (emp.position as string | null) ?? null,
          department: (emp.department as string | null) ?? null,
          tpin: (emp.tpin as string | null) ?? null,
          napsa_number: (emp.napsaNumber as string | null) ?? (emp.napsa_number as string | null) ?? null,
          nhima_number: (emp.nhimaNumber as string | null) ?? (emp.nhima_number as string | null) ?? null,
          bank_name: (emp.bankName as string | null) ?? (emp.bank_name as string | null) ?? null,
          bank_account_number: (emp.bankAccountNumber as string | null) ?? (emp.bank_account_number as string | null) ?? null,
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
          advances_deducted: Number(row.advancesDeducted ?? row.advances_deducted ?? 0),
          net_salary: Number(row.netSalary ?? row.net_salary ?? 0),
          paye: Number(row.paye ?? 0),
          napsa_employee: Number(row.napsaEmployee ?? row.napsa_employee ?? 0),
          napsa_employer: Number(row.napsaEmployer ?? row.napsa_employer ?? 0),
          nhima_employee: Number(row.nhimaEmployee ?? row.nhima_employee ?? 0),
          nhima_employer: Number(row.nhimaEmployer ?? row.nhima_employer ?? 0),
          total_deductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
          employees: employeeMap.get(employeeId) ?? null,
        } satisfies PayrollItemDetail;
      });
    },
    enabled: Boolean(user && id),
  });

  const { data: glJournals } = useQuery({
    queryKey: ["payroll-journals", id],
    queryFn: async () => {
      if (!id) return [] as PayrollJournalDetail[];

      const journalsRef = collection(firestore, COLLECTIONS.PAYROLL_JOURNALS);
      let journalSnap = await getDocs(query(journalsRef, where("payrollRunId", "==", id)));
      if (journalSnap.empty) {
        journalSnap = await getDocs(query(journalsRef, where("payroll_run_id", "==", id)));
      }

      const rows = journalSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        row: docSnap.data() as Record<string, unknown>,
      }));

      const journalEntryIds = Array.from(
        new Set(rows.map(({ row }) => String(row.journalEntryId ?? row.journal_entry_id ?? "")).filter(Boolean)),
      );

      const entryDocs = await Promise.all(
        journalEntryIds.map(async (entryId) => {
          const snap = await getDoc(doc(firestore, COLLECTIONS.JOURNAL_ENTRIES, entryId));
          return { entryId, snap };
        }),
      );

      const entryMap = new Map<string, PayrollJournalDetail["journal_entries"]>();
      entryDocs.forEach(({ entryId, snap }) => {
        if (!snap.exists()) {
          entryMap.set(entryId, null);
          return;
        }

        const row = snap.data() as Record<string, unknown>;
        entryMap.set(entryId, {
          id: snap.id,
          reference_number: (row.referenceNumber as string | null) ?? (row.reference_number as string | null) ?? null,
          entry_date: String(row.entryDate ?? row.entry_date ?? ""),
          description: (row.description as string | null) ?? null,
          is_posted: Boolean(row.isPosted ?? row.is_posted),
        });
      });

      return rows.map(({ id: rowId, row }) => {
        const entryId = String(row.journalEntryId ?? row.journal_entry_id ?? "");
        return {
          id: rowId,
          description: (row.description as string | null) ?? null,
          journal_entries: entryMap.get(entryId) ?? null,
        } satisfies PayrollJournalDetail;
      });
    },
    enabled: payrollRun?.payroll_status === "final",
  });

  const runTrialMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Payroll run not found");
      await payrollService.runPayrollTrial({ payrollRunId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Trial payroll run completed. Review the calculations before finalizing.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to run trial payroll");
    },
  });

  const revertToTrialMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Payroll run not found");
      await updateDoc(doc(firestore, COLLECTIONS.PAYROLL_RUNS, id), {
        payrollStatus: "draft" as PayrollStatus,
        trialRunAt: null,
        trialRunBy: null,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Payroll reverted to draft. You can make changes and re-run trial.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revert payroll");
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Payroll run not found");
      await payrollService.finalizePayroll({ payrollRunId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      queryClient.invalidateQueries({ queryKey: ["payrollItems", id] });
      queryClient.invalidateQueries({ queryKey: ["payroll-journals", id] });
      toast.success("Payroll finalized and posted to General Ledger!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to finalize payroll");
    },
  });

  const exportToCSV = () => {
    if (!payrollItems || !payrollRun) return;

    const headers = [
      "Employee Number",
      "Name",
      "Basic Salary",
      "Housing",
      "Transport",
      "Other Allowances",
      "Gross Salary",
      "Advances Deducted",
      "Net Salary",
      "PAYE (Employer)",
      "NAPSA Employee (Employer)",
      "NAPSA Employer",
      "NHIMA Employee (Employer)",
      "NHIMA Employer",
    ];

    const rows = payrollItems.map((item) => [
      item.employees?.employee_number ?? "",
      item.employees?.full_name ?? "",
      item.basic_salary,
      item.housing_allowance,
      item.transport_allowance,
      item.other_allowances,
      item.gross_salary,
      item.advances_deducted ?? 0,
      item.net_salary,
      item.paye,
      item.napsa_employee,
      item.napsa_employer,
      item.nhima_employee,
      item.nhima_employer,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${format(new Date(payrollRun.run_date), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Payroll exported successfully");
  };

  const viewPayslip = (employeeId: string) => {
    navigate(`/payroll/${id}/payslip/${employeeId}`);
  };

  const sendPayslipEmails = async () => {
    if (!payrollItems || !payrollRun) return;
    
    const confirmSend = window.confirm(
      `Queue payslip emails for ${payrollItems.length} employees?`
    );
    
    if (!confirmSend) return;

    toast.promise(
      async () => {
        for (const item of payrollItems) {
          const employee = item.employees;
          if (!employee?.email) continue;
          if (!id) continue;

          await payrollService.sendPayslipEmail({
            payrollRunId: id,
            employeeId: item.employee_id,
          });
        }
      },
      {
        loading: "Queueing payslip emails...",
        success: "Payslip emails queued successfully!",
        error: "Failed to queue some emails.",
      }
    );
  };

  const downloadBatchPayslips = () => {
    if (!payrollItems || !payrollRun) return;
    
    let batchContent = `PAYSLIPS - ${new Date(payrollRun.period_start).toLocaleDateString()} to ${new Date(payrollRun.period_end).toLocaleDateString()}\n`;
    batchContent += '='.repeat(100) + '\n\n';

    payrollItems.forEach((item, index) => {
      const employee = item.employees ?? {
        full_name: "Unknown",
        employee_number: "-",
        position: null,
        department: null,
        tpin: null,
        napsa_number: null,
        nhima_number: null,
        bank_name: null,
        bank_account_number: null,
        email: null,
      };
      batchContent += `PAYSLIP ${index + 1}\n`;
      batchContent += '-'.repeat(100) + '\n';
      batchContent += `Employee: ${employee.full_name} (${employee.employee_number})\n`;
      batchContent += `Position: ${employee.position || 'N/A'}\n`;
      batchContent += `Department: ${employee.department || 'N/A'}\n`;
      batchContent += `TPIN: ${employee.tpin || 'N/A'}\n`;
      batchContent += `NAPSA: ${employee.napsa_number || 'N/A'}\n`;
      batchContent += `NHIMA: ${employee.nhima_number || 'N/A'}\n\n`;
      
      batchContent += `EARNINGS:\n`;
      batchContent += `  Basic Salary:        K${item.basic_salary.toFixed(2)}\n`;
      batchContent += `  Housing Allowance:   K${item.housing_allowance.toFixed(2)}\n`;
      batchContent += `  Transport Allowance: K${item.transport_allowance.toFixed(2)}\n`;
      batchContent += `  Other Allowances:    K${item.other_allowances.toFixed(2)}\n`;
      batchContent += `  Gross Salary:        K${item.gross_salary.toFixed(2)}\n\n`;
      
      batchContent += `DEDUCTIONS:\n`;
      batchContent += `  NAPSA (5%):          K${item.napsa_employee.toFixed(2)}\n`;
      batchContent += `  NHIMA (1%):          K${item.nhima_employee.toFixed(2)}\n`;
      batchContent += `  PAYE:                K${item.paye.toFixed(2)}\n`;
      batchContent += `  Total Deductions:    K${item.total_deductions.toFixed(2)}\n\n`;
      
      batchContent += `NET PAY:               K${item.net_salary.toFixed(2)}\n`;
      batchContent += `\nBank: ${employee.bank_name || 'N/A'}\n`;
      batchContent += `Account: ${employee.bank_account_number || 'N/A'}\n`;
      batchContent += '\n' + '='.repeat(100) + '\n\n';
    });

    const blob = new Blob([batchContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const month = new Date(payrollRun.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    a.download = `Payslips_${month.replace(' ', '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Batch payslips downloaded successfully!');
  };

  const getStatusBadge = (status: PayrollStatus | null) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Draft</Badge>;
      case "trial":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Trial Run</Badge>;
      case "final":
        return <Badge className="bg-green-600">Finalized</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const payrollStatus = payrollRun?.payroll_status as PayrollStatus | null;
  const isDraft = payrollStatus === "draft";
  const isTrial = payrollStatus === "trial";
  const isFinal = payrollStatus === "final";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Payroll Details</h1>
              {getStatusBadge(payrollStatus)}
              {payrollRun?.payroll_number && (
                <span className="text-sm text-muted-foreground font-mono">{payrollRun.payroll_number}</span>
              )}
            </div>
            <p className="text-muted-foreground">
              {payrollRun && (
                <>
                  {format(new Date(payrollRun.period_start), "dd MMM")} -{" "}
                  {format(new Date(payrollRun.period_end), "dd MMM yyyy")}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button 
              onClick={() => runTrialMutation.mutate()}
              disabled={runTrialMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {runTrialMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Trial Payroll
            </Button>
          )}
          {isTrial && (
            <>
              <Button 
                variant="outline"
                onClick={() => revertToTrialMutation.mutate()}
                disabled={revertToTrialMutation.isPending}
              >
                {revertToTrialMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Revert to Draft
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalize Payroll
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Finalize Payroll
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>This action will:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Lock the payroll permanently - no further edits allowed</li>
                        <li>Post journal entries to the General Ledger</li>
                        <li>Create statutory liability accounts (PAYE, NAPSA, NHIMA)</li>
                        <li>Generate payroll number for reference</li>
                      </ul>
                      <p className="font-medium mt-4">Are you sure you want to proceed?</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => finalizeMutation.mutate()}
                      disabled={finalizeMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {finalizeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Finalize & Post to GL
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {isFinal && (
            <>
              <Button onClick={sendPayslipEmails} variant="outline">
                Email Payslips
              </Button>
              <Button onClick={downloadBatchPayslips} variant="outline">
                Download All
              </Button>
            </>
          )}
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Status Warning for Trial */}
      {isTrial && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Trial Payroll Run</p>
                <p className="text-sm text-blue-700">
                  Review the calculations below. No GL entries have been posted. Click "Finalize Payroll" when ready.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GL Posting Info for Final */}
      {isFinal && glJournals && glJournals.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              General Ledger Postings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {glJournals.map((journal) => (
                <div key={journal.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{journal.journal_entries?.reference_number}</p>
                    <p className="text-sm text-muted-foreground">{journal.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {journal.journal_entries?.entry_date && 
                        format(new Date(journal.journal_entries.entry_date), "dd MMM yyyy")
                      }
                    </p>
                    <Badge variant="outline" className="text-green-600 border-green-600">Posted</Badge>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="link" 
              className="mt-2 p-0 h-auto text-green-700"
              onClick={() => navigate("/journal-entries")}
            >
              View all journal entries →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gross</CardDescription>
            <CardTitle className="text-2xl">{formatZMW(Number(payrollRun?.total_gross || 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deductions</CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatZMW(Number(payrollRun?.total_deductions || 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Net</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatZMW(Number(payrollRun?.total_net || 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employees</CardDescription>
            <CardTitle className="text-2xl">{payrollItems?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Payroll Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Items</CardTitle>
          <CardDescription>Individual employee payroll calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NAPSA</TableHead>
                  <TableHead className="text-right">NHIMA</TableHead>
                  <TableHead className="text-right">Total Ded.</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.employees?.full_name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">{item.employees?.employee_number || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatZMW(Number(item.basic_salary))}</TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.housing_allowance || 0) + Number(item.transport_allowance || 0) + Number(item.other_allowances || 0))}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatZMW(Number(item.gross_salary))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.paye))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.napsa_employee))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.nhima_employee))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.total_deductions))}</TableCell>
                    <TableCell className="text-right font-medium text-primary">{formatZMW(Number(item.net_salary))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewPayslip(item.employee_id)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Payslip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
