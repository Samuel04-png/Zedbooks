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
import { ArrowLeft } from "lucide-react";
import { calculatePayroll } from "@/utils/zambianTaxCalculations";
import { useQuery } from "@tanstack/react-query";
import { PayrollAdditionsDialog } from "@/components/payroll/PayrollAdditionsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

  const onSubmit = async (data: PayrollFormData) => {
    if (!employees || employees.length === 0) {
      toast.error("No active employees found");
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create payroll run with pending_approval status
      const { data: payrollRun, error: runError } = await supabase
        .from("payroll_runs")
        .insert([{
          period_start: data.period_start,
          period_end: data.period_end,
          run_date: data.run_date,
          notes: data.notes || null,
          user_id: user.id,
          status: "pending_approval",
        }])
        .select()
        .single();

      if (runError) throw runError;

      // Calculate and create payroll items for each employee
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      // Get pending advances for each employee
      const { data: advances } = await supabase
        .from("advances")
        .select("*")
        .eq("status", "pending")
        .lte("date_to_deduct", data.period_end)
        .in("employee_id", employees.map(e => e.id));

      const payrollItems = employees.map((employee) => {
        // Calculate total advances to deduct for this employee
        const employeeAdvances = advances?.filter(a => a.employee_id === employee.id) || [];
        const totalAdvances = employeeAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);

        const calculation = calculatePayroll(
          Number(employee.basic_salary),
          Number(employee.housing_allowance || 0),
          Number(employee.transport_allowance || 0),
          Number(employee.other_allowances || 0),
          totalAdvances
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
          advances_deducted: calculation.advancesDeducted,
          total_deductions: calculation.totalDeductions,
          net_salary: calculation.netSalary,
        };
      });

      const { error: itemsError } = await supabase
        .from("payroll_items")
        .insert(payrollItems);

      if (itemsError) throw itemsError;

      // Save payroll additions
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

      // Mark advances as deducted
      if (advances && advances.length > 0) {
        await supabase
          .from("advances")
          .update({ status: "deducted" })
          .in("id", advances.map(a => a.id));
      }

      // Update payroll run totals
      const { error: updateError } = await supabase
        .from("payroll_runs")
        .update({
          total_gross: totalGross,
          total_deductions: totalDeductions,
          total_net: totalNet,
        })
        .eq("id", payrollRun.id);

      if (updateError) throw updateError;

      toast.success("Payroll run created and submitted for approval");
      navigate(`/payroll/${payrollRun.id}/approve`);
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
        <div>
          <h1 className="text-3xl font-bold">New Payroll Run</h1>
          <p className="text-muted-foreground">
            Process payroll for {employees?.length || 0} active employees
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="border rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Payroll Period</h2>
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
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/payroll")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Create Payroll Run"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
