import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Building2 } from "lucide-react";
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const employee = payrollItem?.employees as any;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Action buttons - hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/payroll/${runId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payroll Run
        </Button>
        <Button onClick={printPayslip}>
          <Download className="mr-2 h-4 w-4" />
          Print / Download
        </Button>
      </div>

      {/* Payslip Document */}
      <div id="payslip-content" className="bg-card border rounded-lg shadow-lg print:border-0 print:shadow-none">
        
        {/* Header with Company Logo and Name */}
        <div className="bg-primary text-primary-foreground p-6 rounded-t-lg print:rounded-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary-foreground/20 p-3 rounded-lg">
                <Building2 className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">ZedBooks NGO</h1>
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
                    <tr className="bg-primary/5">
                      <td className="px-4 py-3 font-semibold">Gross Pay</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatZMW(Number(payrollItem?.gross_salary))}</td>
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
                        <td className="px-4 py-2.5 text-muted-foreground">Advances Deducted</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatZMW(Number(payrollItem?.advances_deducted))}</td>
                      </tr>
                    )}
                    <tr className="bg-destructive/5">
                      <td className="px-4 py-3 font-semibold">Total Deductions</td>
                      <td className="px-4 py-3 text-right font-bold text-destructive">{formatZMW(Number(payrollItem?.total_deductions))}</td>
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
              <p className="text-3xl font-bold">{formatZMW(Number(payrollItem?.net_salary))}</p>
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
