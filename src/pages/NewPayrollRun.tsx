import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, Save, Play, AlertCircle } from "lucide-react";
import { calculatePayroll, formatZMW } from "@/utils/zambianTaxCalculations";
import { useQuery } from "@tanstack/react-query";
import { PayrollAdditionsDialog } from "@/components/payroll/PayrollAdditionsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

export default function NewPayrollRun() {
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

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("employment_status", "active");

      if (error) throw error;
      return data;
    },
  });

  // Check for open financial period
  const { data: openPeriod } = useQuery({
    queryKey: ["open-payroll-period"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return null;

      const { data, error } = await supabase
        .from("financial_periods")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("status", "open")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  const onSubmit = async (data: PayrollFormData) => {
    if (!employees || employees.length === 0) {
      toast.error("No active employees found");
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      // Generate payroll number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("payroll_runs")
        .select("*", { count: "exact", head: true })
        .eq("company_id", profile?.company_id);

      const payrollNumber = `PAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

      // Create payroll run in DRAFT status
      const { data: payrollRun, error: runError } = await supabase
        .from("payroll_runs")
        .insert([{
          period_start: data.period_start,
          period_end: data.period_end,
          run_date: data.run_date,
          notes: data.notes || null,
          user_id: user.id,
          company_id: profile?.company_id,
          status: "draft",
          payroll_status: "draft",
          payroll_number: payrollNumber,
        }])
        .select()
        .single();

      if (runError) throw runError;

      // Calculate and create payroll items for each employee (preview only, no GL posting)
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      // Get pending/partial advances for each employee
      const { data: advances } = await supabase
        .from("advances")
        .select("*")
        .in("status", ["pending", "partial"])
        .lte("date_to_deduct", data.period_end)
        .in("employee_id", employees.map(e => e.id));

      const payrollItems = employees.map((employee) => {
        const employeeAdvances = advances?.filter(a => a.employee_id === employee.id) || [];
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

        totalGross += calculation.grossSalary;
        totalDeductions += calculation.totalDeductions;
        totalNet += calculation.netSalary;

        return {
          payroll_run_id: payrollRun.id,
          employee_id: employee.id,
          basic_salary: calculation.basicSalary,
          housing_allowance: calculation.housingAllowance,
          transport_allowance: calculation.transportAllowance,
          other_allowances: calculation.otherAllowances,
          gross_salary: calculation.grossSalary,
          paye: calculation.paye,
          napsa_employee: calculation.napsaEmployee,
          napsa_employer: calculation.napsaEmployer,
          nhima_employee: calculation.nhimaEmployee,
          nhima_employer: calculation.nhimaEmployer,
          advances_deducted: totalAdvanceDeduction,
          total_deductions: calculation.totalDeductions,
          net_salary: calculation.netSalary,
        };
      });

      const { error: itemsError } = await supabase
        .from("payroll_items")
        .insert(payrollItems);

      if (itemsError) throw itemsError;

      // Save payroll additions (not yet applied)
      if (additions.length > 0) {
        const additionsData = additions.map((a) => ({
          payroll_run_id: payrollRun.id,
          employee_id: a.employee_id,
          type: a.type,
          name: a.name,
          amount: a.amount,
          total_amount: a.total_amount,
          months_to_pay: a.months_to_pay,
          monthly_deduction: a.monthly_deduction,
        }));

        await supabase.from("payroll_additions").insert(additionsData);
      }

      // Update payroll run totals
      await supabase
        .from("payroll_runs")
        .update({
          total_gross: totalGross,
          total_deductions: totalDeductions,
          total_net: totalNet,
        })
        .eq("id", payrollRun.id);

      toast.success("Payroll draft created successfully");
      navigate(`/payroll/${payrollRun.id}`);
    } catch (error) {
      console.error(error);
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
          Payroll follows a strict workflow: <strong>Draft → Trial → Final</strong>. 
          Draft payrolls can be edited. Trial payrolls generate a preview with no GL impact. 
          Final payrolls are locked and post journals to the General Ledger.
        </AlertDescription>
      </Alert>

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
