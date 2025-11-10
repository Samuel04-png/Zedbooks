import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Payslip() {
  const navigate = useNavigate();
  const { runId, employeeId } = useParams();

  const { data: payrollRun } = useQuery({
    queryKey: ["payrollRun", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("id", runId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: payrollItem, isLoading } = useQuery({
    queryKey: ["payrollItem", runId, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_items")
        .select(`
          *,
          employees (
            full_name,
            employee_number,
            position,
            department,
            tpin,
            napsa_number,
            nhima_number,
            bank_name,
            bank_account_number
          )
        `)
        .eq("payroll_run_id", runId)
        .eq("employee_id", employeeId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const printPayslip = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const employee = payrollItem?.employees as any;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/payroll/${runId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payroll Run
          </Button>
        </div>
        <Button onClick={printPayslip}>
          <Download className="mr-2 h-4 w-4" />
          Print / Download
        </Button>
      </div>

      <div id="payslip-content" className="border-2 rounded-lg p-8 bg-card shadow-lg print:border-0 print:shadow-none">
        <div className="text-center mb-8 pb-4 border-b-2 border-primary/20">
          <h2 className="text-3xl font-bold text-primary mb-2">PAYSLIP</h2>
          <p className="text-base font-medium text-muted-foreground">
            Pay Period: {payrollRun && format(new Date(payrollRun.period_start), "dd MMM yyyy")} - {payrollRun && format(new Date(payrollRun.period_end), "dd MMM yyyy")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Generated on {format(new Date(), "dd MMM yyyy 'at' HH:mm")}
          </p>
        </div>

        <div className="bg-muted/30 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4 text-primary">Employee Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Name</p>
              <p className="font-semibold text-base">{employee?.full_name}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Employee No</p>
              <p className="font-semibold text-base">{employee?.employee_number}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Position</p>
              <p className="font-semibold text-base">{employee?.position || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Department</p>
              <p className="font-semibold text-base">{employee?.department || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">TPIN</p>
              <p className="font-semibold text-base">{employee?.tpin || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">NAPSA No</p>
              <p className="font-semibold text-base">{employee?.napsa_number || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">NHIMA No</p>
              <p className="font-semibold text-base">{employee?.nhima_number || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-primary">Earnings</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Basic Salary</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.basic_salary))}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Housing Allowance</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.housing_allowance))}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Transport Allowance</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.transport_allowance))}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Other Allowances</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.other_allowances))}</span>
            </div>
            <div className="flex justify-between pt-3 font-bold text-lg bg-primary/5 p-3 rounded-md">
              <span>Gross Salary</span>
              <span className="text-primary">{formatZMW(Number(payrollItem?.gross_salary))}</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-primary">Deductions</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">NAPSA (5%)</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.napsa_employee))}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">NHIMA (1%)</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.nhima_employee))}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">PAYE</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.paye))}</span>
            </div>
            {Number(payrollItem?.advances_deducted) > 0 && (
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Advances Deducted</span>
                <span className="font-semibold">{formatZMW(Number(payrollItem?.advances_deducted))}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 font-bold text-lg bg-destructive/5 p-3 rounded-md">
              <span>Total Deductions</span>
              <span className="text-destructive">{formatZMW(Number(payrollItem?.total_deductions))}</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-primary/30 mb-6">
          <div className="flex justify-between text-2xl font-bold bg-primary/10 p-4 rounded-lg">
            <span>Net Pay</span>
            <span className="text-primary">{formatZMW(Number(payrollItem?.net_salary))}</span>
          </div>
        </div>

        {employee?.bank_name && (
          <div className="bg-muted/30 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4 text-primary">Payment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Bank</span>
                <span className="font-semibold">{employee.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Account Number</span>
                <span className="font-semibold">{employee.bank_account_number}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-muted/20 p-4 rounded-lg border border-border/50 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-primary">Employer Contributions</h3>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3 italic">For reference only - not deducted from employee salary</p>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">NAPSA (Employer 5%)</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.napsa_employer))}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">NHIMA (Employer 1%)</span>
              <span className="font-semibold">{formatZMW(Number(payrollItem?.nhima_employer))}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p className="font-semibold">This document is confidential. Please keep it secure.</p>
          <p className="mt-1">Generated on {format(new Date(), "dd MMM yyyy 'at' HH:mm")}</p>
        </div>
      </div>
    </div>
  );
}
