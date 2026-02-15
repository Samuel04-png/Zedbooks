import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Building2, Mail, Loader2, Settings } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";
import { payrollService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";

interface PayrollRunRecord {
  id: string;
  period_start: string;
  period_end: string;
  run_date: string;
}

interface EmployeeRecord {
  full_name: string;
  employee_number: string;
  position: string | null;
  department: string | null;
  tpin: string | null;
  napsa_number: string | null;
  nhima_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  email: string | null;
}

interface PayrollItemRecord {
  id: string;
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  gross_salary: number;
  napsa_employee: number;
  napsa_employer: number;
  nhima_employee: number;
  nhima_employer: number;
  paye: number;
  advances_deducted: number;
  total_deductions: number;
  net_salary: number;
  employees: EmployeeRecord | null;
}

interface PayrollAdditionRecord {
  id: string;
  type: string;
  name: string;
  amount: number;
}

const asNumber = (value: unknown): number => Number(value ?? 0);
const asString = (value: unknown): string => String(value ?? "");

export default function Payslip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { runId, employeeId } = useParams();
  const [isSending, setIsSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: companySettings } = useCompanySettings();

  const { data: payrollRun } = useQuery({
    queryKey: ["payrollRun", runId],
    queryFn: async () => {
      if (!runId) return null;
      const snap = await getDoc(doc(firestore, COLLECTIONS.PAYROLL_RUNS, runId));
      if (!snap.exists()) return null;

      const row = snap.data() as Record<string, unknown>;
      return {
        id: snap.id,
        period_start: asString(row.periodStart ?? row.period_start),
        period_end: asString(row.periodEnd ?? row.period_end),
        run_date: asString(row.runDate ?? row.run_date),
      } satisfies PayrollRunRecord;
    },
    enabled: Boolean(user && runId),
  });

  const { data: payrollItem, isLoading } = useQuery({
    queryKey: ["payrollItem", runId, employeeId],
    queryFn: async () => {
      if (!runId || !employeeId) return null;

      const payrollItemsRef = collection(firestore, COLLECTIONS.PAYROLL_ITEMS);

      const findPayrollItem = async (runField: string, employeeField: string) => {
        const snap = await getDocs(
          query(
            payrollItemsRef,
            where(runField, "==", runId),
            where(employeeField, "==", employeeId),
            limit(1),
          ),
        );
        return snap.empty ? null : snap.docs[0];
      };

      const itemDoc =
        (await findPayrollItem("payrollRunId", "employeeId")) ??
        (await findPayrollItem("payroll_run_id", "employee_id"));

      if (!itemDoc) return null;

      const row = itemDoc.data() as Record<string, unknown>;
      const resolvedEmployeeId = asString(row.employeeId ?? row.employee_id ?? employeeId);

      let employee: EmployeeRecord | null = null;
      if (resolvedEmployeeId) {
        const employeeSnap = await getDoc(doc(firestore, COLLECTIONS.EMPLOYEES, resolvedEmployeeId));
        if (employeeSnap.exists()) {
          const emp = employeeSnap.data() as Record<string, unknown>;
          employee = {
            full_name: asString(emp.fullName ?? emp.full_name),
            employee_number: asString(emp.employeeNumber ?? emp.employee_number),
            position: (emp.position as string | null) ?? null,
            department: (emp.department as string | null) ?? null,
            tpin: (emp.tpin as string | null) ?? null,
            napsa_number: (emp.napsaNumber as string | null) ?? (emp.napsa_number as string | null) ?? null,
            nhima_number: (emp.nhimaNumber as string | null) ?? (emp.nhima_number as string | null) ?? null,
            bank_name: (emp.bankName as string | null) ?? (emp.bank_name as string | null) ?? null,
            bank_account_number: (emp.bankAccountNumber as string | null) ?? (emp.bank_account_number as string | null) ?? null,
            email: (emp.email as string | null) ?? null,
          };
        }
      }

      return {
        id: itemDoc.id,
        employee_id: resolvedEmployeeId,
        basic_salary: asNumber(row.basicSalary ?? row.basic_salary),
        housing_allowance: asNumber(row.housingAllowance ?? row.housing_allowance),
        transport_allowance: asNumber(row.transportAllowance ?? row.transport_allowance),
        other_allowances: asNumber(row.otherAllowances ?? row.other_allowances),
        gross_salary: asNumber(row.grossSalary ?? row.gross_salary),
        napsa_employee: asNumber(row.napsaEmployee ?? row.napsa_employee),
        napsa_employer: asNumber(row.napsaEmployer ?? row.napsa_employer),
        nhima_employee: asNumber(row.nhimaEmployee ?? row.nhima_employee),
        nhima_employer: asNumber(row.nhimaEmployer ?? row.nhima_employer),
        paye: asNumber(row.paye),
        advances_deducted: asNumber(row.advancesDeducted ?? row.advances_deducted),
        total_deductions: asNumber(row.totalDeductions ?? row.total_deductions),
        net_salary: asNumber(row.netSalary ?? row.net_salary),
        employees: employee,
      } satisfies PayrollItemRecord;
    },
    enabled: Boolean(user && runId && employeeId),
  });

  const { data: additions } = useQuery({
    queryKey: ["payroll-additions", runId, employeeId],
    queryFn: async () => {
      if (!runId || !employeeId) return [] as PayrollAdditionRecord[];

      const additionsRef = collection(firestore, COLLECTIONS.PAYROLL_ADDITIONS);

      let snap = await getDocs(
        query(additionsRef, where("payrollRunId", "==", runId), where("employeeId", "==", employeeId)),
      );
      if (snap.empty) {
        snap = await getDocs(
          query(additionsRef, where("payroll_run_id", "==", runId), where("employee_id", "==", employeeId)),
        );
      }

      return snap.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          type: asString(row.type),
          name: asString(row.name),
          amount: asNumber(row.amount),
        } satisfies PayrollAdditionRecord;
      });
    },
    enabled: Boolean(user && runId && employeeId),
  });

  const printPayslip = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  const sendPayslipEmail = async () => {
    if (!employee?.email) {
      toast.error("Employee email not found");
      return;
    }

    setIsSending(true);

    try {
      if (!runId || !employeeId) throw new Error("Invalid payroll context");
      await payrollService.sendPayslipEmail({
        payrollRunId: runId,
        employeeId,
      });

      toast.success(`Payslip queued for ${employee.email}`);
    } catch {
      toast.error("Failed to send payslip email");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const employee = payrollItem?.employees;
  const earningsAdditions = additions?.filter(a => a.type !== "advance") || [];
  const advanceAdditions = additions?.filter(a => a.type === "advance") || [];
  const additionalEarningsTotal = earningsAdditions.reduce((sum, a) => sum + Number(a.amount), 0);
  const advanceDeductionsTotal = advanceAdditions.reduce((sum, a) => sum + Number(a.amount), 0);
  const adjustedGross = Number(payrollItem?.gross_salary) + additionalEarningsTotal;
  const adjustedTotalDeductions = Number(payrollItem?.total_deductions) + advanceDeductionsTotal;
  const adjustedNetPay = Number(payrollItem?.net_salary) - advanceDeductionsTotal;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Action buttons - hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/payroll/${runId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payroll Run
        </Button>
        <div className="flex gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Company Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Company Settings</DialogTitle>
                <DialogDescription>
                  Upload your company logo and set your company name
                </DialogDescription>
              </DialogHeader>
              <CompanyLogoUpload />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={sendPayslipEmail} disabled={isSending || !employee?.email}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Email Payslip
              </>
            )}
          </Button>
          <Button onClick={printPayslip}>
            <Download className="mr-2 h-4 w-4" />
            Print / Download
          </Button>
        </div>
      </div>

      {/* Payslip Document */}
      <div id="payslip-content" className="bg-card border rounded-lg shadow-lg print:border-0 print:shadow-none">
        
        {/* Header with Company Logo and Name */}
        <div className="bg-primary text-primary-foreground p-6 rounded-t-lg print:rounded-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary-foreground/20 p-3 rounded-lg h-16 w-16 flex items-center justify-center overflow-hidden">
                {companySettings?.logoUrl ? (
                  <img src={companySettings.logoUrl} alt="Company Logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-10 w-10" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{companySettings?.companyName || "ZedBooks NGO"}</h1>
                <p className="text-primary-foreground/80 text-sm">Accounting Suite</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">PAYSLIP</h2>
              <p className="text-primary-foreground/80 text-sm">
                {payrollRun && format(new Date(payrollRun.period_start), "MMMM yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Pay Period */}
        <div className="bg-muted/50 px-6 py-3 border-b text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Pay Period:</span>
            <span className="font-medium">
              {payrollRun && format(new Date(payrollRun.period_start), "dd MMM yyyy")} - {payrollRun && format(new Date(payrollRun.period_end), "dd MMM yyyy")}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Employee Details */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Employee Details</h3>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-semibold">{employee?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee No:</span>
                  <span className="font-semibold">{employee?.employee_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-semibold">{employee?.position || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-semibold">{employee?.department || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TPIN:</span>
                  <span className="font-semibold">{employee?.tpin || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NAPSA No:</span>
                  <span className="font-semibold">{employee?.napsa_number || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings and Deductions Side by Side */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Earnings</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">Basic Salary</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.basic_salary))}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">Housing Allowance</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.housing_allowance))}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">Transport Allowance</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.transport_allowance))}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">Other Allowances</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.other_allowances))}</td>
                    </tr>
                    {earningsAdditions.map((addition) => (
                      <tr key={addition.id} className="border-b">
                        <td className="px-4 py-2.5 text-muted-foreground">{addition.name}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(addition.amount))}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5">
                      <td className="px-4 py-3 font-semibold">Gross Pay</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatZMW(adjustedGross)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deductions</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">NAPSA (5%)</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.napsa_employee))}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">NHIMA (1%)</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.nhima_employee))}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">PAYE</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.paye))}</td>
                    </tr>
                    {Number(payrollItem?.advances_deducted) > 0 && (
                      <tr className="border-b">
                        <td className="px-4 py-2.5 text-muted-foreground">Advances (Previous)</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.advances_deducted))}</td>
                      </tr>
                    )}
                    {advanceAdditions.map((addition) => (
                      <tr key={addition.id} className="border-b">
                        <td className="px-4 py-2.5 text-muted-foreground">{addition.name}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(addition.amount))}</td>
                      </tr>
                    ))}
                    <tr className="bg-destructive/5">
                      <td className="px-4 py-3 font-semibold">Total Deductions</td>
                      <td className="px-4 py-3 text-right font-bold text-destructive">{formatZMW(adjustedTotalDeductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-primary rounded-lg p-5 text-primary-foreground">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-primary-foreground/80 text-sm">Net Pay</p>
                <p className="text-xs text-primary-foreground/60">Amount payable to employee</p>
              </div>
              <p className="text-3xl font-bold">{formatZMW(adjustedNetPay)}</p>
            </div>
          </div>

          {/* Payment Details */}
          {employee?.bank_name && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Details</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank:</span>
                    <span className="font-semibold">{employee.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Number:</span>
                    <span className="font-semibold">{employee.bank_account_number}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Employer Contributions Reference */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">Employer Contributions (for reference only):</p>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>NAPSA: {formatZMW(Number(payrollItem?.napsa_employer))}</span>
              <span>NHIMA: {formatZMW(Number(payrollItem?.nhima_employer))}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/30 px-6 py-4 rounded-b-lg border-t text-center">
          <p className="text-xs text-muted-foreground">
            This is a computer-generated payslip. Please keep it confidential.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated on {format(new Date(), "dd MMMM yyyy 'at' HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
}
