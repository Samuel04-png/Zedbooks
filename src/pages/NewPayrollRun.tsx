import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { calculatePayroll, formatZMW } from "@/utils/zambianTaxCalculations";
import { useQuery } from "@tanstack/react-query";
import { PayrollAdditionsDialog } from "@/components/payroll/PayrollAdditionsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { companyService, payrollService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { firestore } from "@/integrations/firebase/client";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

const payrollSchema = z.object({
  period_start: z.string().min(1, "Start date is required"),
  period_end: z.string().min(1, "End date is required"),
  run_date: z.string().min(1, "Run date is required"),
  notes: z.string().optional(),
});

type PayrollFormData = z.infer<typeof payrollSchema>;

interface PayrollAddition {
  id: string;
  employee_id: string;
  type: "earning" | "bonus" | "overtime" | "advance";
  name: string;
  amount: number;
  total_amount?: number;
  months_to_pay?: number;
  monthly_deduction?: number;
}

interface EmployeeRecord {
  id: string;
  full_name: string;
  employee_number: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
}

interface AdvanceRecord {
  id: string;
  employee_id: string;
  status: string;
  date_to_deduct: string | null;
  monthly_deduction: number | null;
  remaining_balance: number | null;
  amount: number;
}

export default function NewPayrollRun() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [additions, setAdditions] = useState<PayrollAddition[]>([]);

  const handleAddition = (addition: Omit<PayrollAddition, "id">) => {
    setAdditions([...additions, { ...addition, id: crypto.randomUUID() }]);
  };

  const handleRemoveAddition = (id: string) => {
    setAdditions(additions.filter((a) => a.id !== id));
  };

  const form = useForm<PayrollFormData>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      run_date: new Date().toISOString().split("T")[0],
    },
  });

  const { data: companyId } = useQuery({
    queryKey: ["new-payroll-company", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      if (!companyId) return [] as EmployeeRecord[];

      const employeesRef = collection(firestore, COLLECTIONS.EMPLOYEES);
      const snapshot = await getDocs(
        query(employeesRef, where("companyId", "==", companyId), where("employmentStatus", "==", "active")),
      );

      if (snapshot.empty) {
        const legacySnapshot = await getDocs(
          query(employeesRef, where("companyId", "==", companyId), where("employment_status", "==", "active")),
        );

        return legacySnapshot.docs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            full_name: String(row.fullName ?? row.full_name ?? ""),
            employee_number: String(row.employeeNumber ?? row.employee_number ?? ""),
            basic_salary: Number(row.basicSalary ?? row.basic_salary ?? 0),
            housing_allowance: Number(row.housingAllowance ?? row.housing_allowance ?? 0),
            transport_allowance: Number(row.transportAllowance ?? row.transport_allowance ?? 0),
            other_allowances: Number(row.otherAllowances ?? row.other_allowances ?? 0),
          } satisfies EmployeeRecord;
        });
      }

      return snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          full_name: String(row.fullName ?? row.full_name ?? ""),
          employee_number: String(row.employeeNumber ?? row.employee_number ?? ""),
          basic_salary: Number(row.basicSalary ?? row.basic_salary ?? 0),
          housing_allowance: Number(row.housingAllowance ?? row.housing_allowance ?? 0),
          transport_allowance: Number(row.transportAllowance ?? row.transport_allowance ?? 0),
          other_allowances: Number(row.otherAllowances ?? row.other_allowances ?? 0),
        } satisfies EmployeeRecord;
      });
    },
    enabled: Boolean(companyId),
  });

  // Check for open financial period
  const { data: openPeriod } = useQuery({
    queryKey: ["open-payroll-period", companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const periodsRef = collection(firestore, COLLECTIONS.FINANCIAL_PERIODS);
      const snapshot = await getDocs(
        query(periodsRef, where("companyId", "==", companyId), where("status", "==", "open")),
      );

      if (snapshot.empty) return null;

      const periods = snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          startDate: String(row.startDate ?? row.start_date ?? ""),
          endDate: String(row.endDate ?? row.end_date ?? ""),
          periodName: String(row.periodName ?? row.period_name ?? ""),
        };
      });

      periods.sort((a, b) => b.startDate.localeCompare(a.startDate));
      return periods[0];
    },
    enabled: Boolean(companyId),
  });

  const onSubmit = async (data: PayrollFormData) => {
    if (!employees || employees.length === 0) {
      toast.error("No active employees found");
      return;
    }

    setIsProcessing(true);

    try {
      if (!user) throw new Error("Not authenticated");
      if (!companyId) throw new Error("Company not found");

      const advanceSnapshot = await getDocs(
        query(
          collection(firestore, COLLECTIONS.ADVANCES),
          where("companyId", "==", companyId),
          where("status", "in", ["pending", "partial"]),
        ),
      );

      const advances = advanceSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            employee_id: String(row.employeeId ?? row.employee_id ?? ""),
            status: String(row.status ?? ""),
            date_to_deduct: (row.dateToDeduct as string | null) ?? (row.date_to_deduct as string | null) ?? null,
            monthly_deduction: Number(row.monthlyDeduction ?? row.monthly_deduction ?? 0) || null,
            remaining_balance: Number(row.remainingBalance ?? row.remaining_balance ?? 0) || null,
            amount: Number(row.amount ?? 0),
          } satisfies AdvanceRecord;
        })
        .filter((advance) => {
          if (!advance.employee_id) return false;
          if (!employees.some((employee) => employee.id === advance.employee_id)) return false;
          if (!advance.date_to_deduct) return true;
          return advance.date_to_deduct <= data.period_end;
        });

      const payrollEmployees = employees.map((employee) => {
        const employeeAdvances = advances.filter((advance) => advance.employee_id === employee.id);
        let totalAdvanceDeduction = 0;

        employeeAdvances.forEach((adv) => {
          const deductionAmount = adv.monthly_deduction 
            ? Math.min(Number(adv.monthly_deduction), Number(adv.remaining_balance || adv.amount))
            : Number(adv.remaining_balance || adv.amount);
          totalAdvanceDeduction += deductionAmount;
        });

        const calculation = calculatePayroll(
          Number(employee.basic_salary),
          Number(employee.housing_allowance || 0),
          Number(employee.transport_allowance || 0),
          Number(employee.other_allowances || 0),
          totalAdvanceDeduction
        );

        return {
          employeeId: employee.id,
          employeeName: employee.full_name,
          grossSalary: calculation.grossSalary,
          payeDeduction: calculation.paye,
          napsaDeduction: calculation.napsaEmployee,
          nhimaDeduction: calculation.nhimaEmployee,
          otherDeductions: totalAdvanceDeduction,
          netSalary: calculation.netSalary,
          basicSalary: calculation.basicSalary,
          housingAllowance: calculation.housingAllowance,
          transportAllowance: calculation.transportAllowance,
          otherAllowances: calculation.otherAllowances,
          advancesDeducted: totalAdvanceDeduction,
        };
      });

      const additionsPayload = additions.map((addition) => ({
        employeeId: addition.employee_id,
        type: addition.type,
        name: addition.name,
        amount: addition.amount,
        totalAmount: addition.total_amount,
        monthsToPay: addition.months_to_pay,
        monthlyDeduction: addition.monthly_deduction,
      }));

      const result = await payrollService.createPayrollDraft({
        companyId,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        runDate: data.run_date,
        notes: data.notes || undefined,
        employees: payrollEmployees.map((employee) => ({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          grossSalary: employee.grossSalary,
          payeDeduction: employee.payeDeduction,
          napsaDeduction: employee.napsaDeduction,
          nhimaDeduction: employee.nhimaDeduction,
          otherDeductions: employee.otherDeductions,
          netSalary: employee.netSalary,
          basicSalary: employee.basicSalary,
          housingAllowance: employee.housingAllowance,
          transportAllowance: employee.transportAllowance,
          otherAllowances: employee.otherAllowances,
          advancesDeducted: employee.advancesDeducted,
        })),
        additions: additionsPayload,
      });

      toast.success("Payroll draft created successfully");
      navigate(`/payroll/${result.payrollRunId}`);
    } catch {
      toast.error("Failed to create payroll run");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">New Payroll Run</h1>
          <p className="text-muted-foreground">
            Create a new payroll run for {employees?.length || 0} active employees
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          DRAFT
        </Badge>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Payroll Workflow</AlertTitle>
        <AlertDescription>
          Payroll follows a strict workflow: <strong>Draft -&gt; Processed -&gt; Paid</strong>.
          Draft payrolls can be edited and saved without posting journals.
          Processing creates the payroll journal entry, and payment creates the settlement journal.
        </AlertDescription>
      </Alert>

      {openPeriod && (
        <p className="text-sm text-muted-foreground">
          Open financial period: {openPeriod.periodName || `${openPeriod.startDate} to ${openPeriod.endDate}`}
        </p>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Period</CardTitle>
              <CardDescription>Define the period for this payroll run</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="period_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="period_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="run_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Run Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payroll Additions */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Additions</CardTitle>
              <CardDescription>Add earnings, bonuses, overtime, or advances for this payroll run</CardDescription>
            </CardHeader>
            <CardContent>
              <PayrollAdditionsDialog
                employees={employees?.map(e => ({ id: e.id, full_name: e.full_name, employee_number: e.employee_number })) || []}
                additions={additions}
                onAddition={handleAddition}
                onRemove={handleRemoveAddition}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Add any notes for this payroll run..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Employee Preview */}
          {employees && employees.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Employees to Process</CardTitle>
                <CardDescription>{employees.length} active employees will be included</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Basic Salary</p>
                    <p className="text-xl font-bold">{formatZMW(employees.reduce((sum, e) => sum + Number(e.basic_salary || 0), 0))}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Housing</p>
                    <p className="text-xl font-bold">{formatZMW(employees.reduce((sum, e) => sum + Number(e.housing_allowance || 0), 0))}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Transport</p>
                    <p className="text-xl font-bold">{formatZMW(employees.reduce((sum, e) => sum + Number(e.transport_allowance || 0), 0))}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Other Allowances</p>
                    <p className="text-xl font-bold">{formatZMW(employees.reduce((sum, e) => sum + Number(e.other_allowances || 0), 0))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/payroll")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing}>
              <Save className="h-4 w-4 mr-2" />
              {isProcessing ? "Creating..." : "Save as Draft"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
