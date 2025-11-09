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
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/payroll/${runId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payslip</h1>
          </div>
        </div>
        <Button onClick={printPayslip}>
          <Download className="mr-2 h-4 w-4" />
          Print / Download
        </Button>
      </div>

      {/* Payslip Content */}
      <div className="border rounded-lg p-8 bg-white text-black print:border-0">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">PAYSLIP</h2>
          <p className="text-muted-foreground">
            Pay Period: {payrollRun && format(new Date(payrollRun.period_start), "dd MMM yyyy")} - {payrollRun && format(new Date(payrollRun.period_end), "dd MMM yyyy")}
          </p>
        </div>

        {/* Employee Information */}
        <div className="grid grid-cols-2 gap-4 mb-8 pb-4 border-b">
          <div>
            <h3 className="font-semibold mb-2">Employee Information</h3>
            <p><span className="text-muted-foreground">Name:</span> {employee?.full_name}</p>
            <p><span className="text-muted-foreground">Employee No:</span> {employee?.employee_number}</p>
            <p><span className="text-muted-foreground">Position:</span> {employee?.position || "N/A"}</p>
            <p><span className="text-muted-foreground">Department:</span> {employee?.department || "N/A"}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Statutory Information</h3>
            <p><span className="text-muted-foreground">TPIN:</span> {employee?.tpin || "N/A"}</p>
            <p><span className="text-muted-foreground">NAPSA No:</span> {employee?.napsa_number || "N/A"}</p>
            <p><span className="text-muted-foreground">NHIMA No:</span> {employee?.nhima_number || "N/A"}</p>
          </div>
        </div>

        {/* Earnings */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3 text-lg">Earnings</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Basic Salary</span>
              <span className="font-medium">{formatZMW(Number(payrollItem?.basic_salary))}</span>
            </div>
            {Number(payrollItem?.housing_allowance) > 0 && (
              <div className="flex justify-between">
                <span>Housing Allowance</span>
                <span className="font-medium">{formatZMW(Number(payrollItem?.housing_allowance))}</span>
              </div>
            )}
            {Number(payrollItem?.transport_allowance) > 0 && (
              <div className="flex justify-between">
                <span>Transport Allowance</span>
                <span className="font-medium">{formatZMW(Number(payrollItem?.transport_allowance))}</span>
              </div>
            )}
            {Number(payrollItem?.other_allowances) > 0 && (
              <div className="flex justify-between">
                <span>Other Allowances</span>
                <span className="font-medium">{formatZMW(Number(payrollItem?.other_allowances))}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Gross Salary</span>
              <span>{formatZMW(Number(payrollItem?.gross_salary))}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        {Number(payrollItem?.advances_deducted) > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3 text-lg">Deductions</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Advances Deducted</span>
                <span className="font-medium">{formatZMW(Number(payrollItem?.advances_deducted))}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold">
                <span>Total Deductions</span>
                <span>{formatZMW(Number(payrollItem?.total_deductions))}</span>
              </div>
            </div>
          </div>
        )}

        {/* Net Salary */}
        <div className="border-t-2 pt-4">
          <div className="flex justify-between text-xl font-bold">
            <span>Net Salary</span>
            <span>{formatZMW(Number(payrollItem?.net_salary))}</span>
          </div>
        </div>

        {/* Employer Contributions */}
        <div className="mt-8 pt-4 border-t">
          <h3 className="font-semibold mb-3">Employer Statutory Contributions</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>PAYE (Reference)</span>
              <span>{formatZMW(Number(payrollItem?.paye))}</span>
            </div>
            <div className="flex justify-between">
              <span>NAPSA (Employer 5%)</span>
              <span>{formatZMW(Number(payrollItem?.napsa_employer))}</span>
            </div>
            <div className="flex justify-between">
              <span>NAPSA (Employee 5%)</span>
              <span>{formatZMW(Number(payrollItem?.napsa_employee))}</span>
            </div>
            <div className="flex justify-between">
              <span>NHIMA (Employer 1%)</span>
              <span>{formatZMW(Number(payrollItem?.nhima_employer))}</span>
            </div>
            <div className="flex justify-between">
              <span>NHIMA (Employee 1%)</span>
              <span>{formatZMW(Number(payrollItem?.nhima_employee))}</span>
            </div>
          </div>
        </div>

        {/* Bank Information */}
        {employee?.bank_name && (
          <div className="mt-8 pt-4 border-t">
            <h3 className="font-semibold mb-2">Payment Details</h3>
            <p className="text-sm"><span className="text-muted-foreground">Bank:</span> {employee.bank_name}</p>
            <p className="text-sm"><span className="text-muted-foreground">Account:</span> {employee.bank_account_number}</p>
          </div>
        )}
      </div>
    </div>
  );
}
