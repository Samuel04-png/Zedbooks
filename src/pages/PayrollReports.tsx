import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PayrollReports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ["payroll-runs-report", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("payroll_runs")
        .select("*")
        .order("run_date", { ascending: false });

      if (startDate) {
        query = query.gte("run_date", startDate);
      }
      if (endDate) {
        query = query.lte("run_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payroll-items-report", startDate, endDate],
    queryFn: async () => {
      if (!payrollRuns || payrollRuns.length === 0) return [];

      const runIds = payrollRuns.map((run) => run.id);
      const { data, error } = await supabase
        .from("payroll_items")
        .select(`
          *,
          employees (
            full_name,
            employee_number
          )
        `)
        .in("payroll_run_id", runIds);

      if (error) throw error;
      return data;
    },
    enabled: !!payrollRuns && payrollRuns.length > 0,
  });

  const exportToCSV = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "Employee Number",
      "Employee Name",
      "Basic Salary",
      "Housing Allowance",
      "Transport Allowance",
      "Other Allowances",
      "Gross Salary",
      "PAYE",
      "NAPSA Employee",
      "NHIMA Employee",
      "Advances Deducted",
      "Total Deductions",
      "Net Salary",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      return [
        employee?.employee_number,
        employee?.full_name,
        Number(item.basic_salary),
        Number(item.housing_allowance),
        Number(item.transport_allowance),
        Number(item.other_allowances),
        Number(item.gross_salary),
        Number(item.paye),
        Number(item.napsa_employee),
        Number(item.nhima_employee),
        Number(item.advances_deducted),
        Number(item.total_deductions),
        Number(item.net_salary),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const totalGross = payrollRuns?.reduce((sum, run) => sum + Number(run.total_gross), 0) || 0;
  const totalDeductions = payrollRuns?.reduce((sum, run) => sum + Number(run.total_deductions), 0) || 0;
  const totalNet = payrollRuns?.reduce((sum, run) => sum + Number(run.total_net), 0) || 0;
  const totalPAYE = payrollItems?.reduce((sum, item) => sum + Number(item.paye), 0) || 0;
  const totalNAPSA = payrollItems?.reduce((sum, item) => sum + Number(item.napsa_employee), 0) || 0;
  const totalNHIMA = payrollItems?.reduce((sum, item) => sum + Number(item.nhima_employee), 0) || 0;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Reports</h1>
          <p className="text-muted-foreground">Comprehensive payroll analysis and summaries</p>
        </div>
        <Button onClick={exportToCSV} disabled={!payrollItems || payrollItems.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Gross Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalGross)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalDeductions)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Net Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalNet)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statutory Contributions Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total PAYE</span>
              <span className="text-lg font-semibold">{formatZMW(totalPAYE)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total NAPSA (Employee 5%)</span>
              <span className="text-lg font-semibold">{formatZMW(totalNAPSA)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total NHIMA (Employee 1%)</span>
              <span className="text-lg font-semibold">{formatZMW(totalNHIMA)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payrollRuns?.map((run) => (
              <div key={run.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <div className="font-medium">
                    {format(new Date(run.period_start), "dd MMM")} - {format(new Date(run.period_end), "dd MMM yyyy")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Run Date: {format(new Date(run.run_date), "dd MMM yyyy")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatZMW(Number(run.total_net))}</div>
                  <div className="text-sm text-muted-foreground">Net Pay</div>
                </div>
              </div>
            ))}
            {payrollRuns?.length === 0 && (
              <div className="text-center text-muted-foreground py-4">No payroll runs found for the selected period</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
