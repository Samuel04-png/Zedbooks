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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ZRACompliance() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ["payroll-runs-zra", month],
    queryFn: async () => {
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .gte("run_date", startDate)
        .lte("run_date", endDate)
        .order("run_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payroll-items-zra", month],
    queryFn: async () => {
      if (!payrollRuns || payrollRuns.length === 0) return [];

      const runIds = payrollRuns.map((run) => run.id);
      const { data, error } = await supabase
        .from("payroll_items")
        .select(`
          *,
          employees (
            full_name,
            employee_number,
            tpin,
            napsa_number,
            nhima_number
          )
        `)
        .in("payroll_run_id", runIds);

      if (error) throw error;
      return data;
    },
    enabled: !!payrollRuns && payrollRuns.length > 0,
  });

  const exportPAYEReport = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "TPIN",
      "Employee Number",
      "Employee Name",
      "Gross Salary",
      "PAYE",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      return [
        employee?.tpin || "N/A",
        employee?.employee_number,
        employee?.full_name,
        Number(item.gross_salary),
        Number(item.paye),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PAYE-Report-${month}.csv`;
    a.click();
  };

  const exportNAPSAReport = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "NAPSA Number",
      "Employee Number",
      "Employee Name",
      "Gross Salary",
      "NAPSA Employee (5%)",
      "NAPSA Employer (5%)",
      "Total NAPSA",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      return [
        employee?.napsa_number || "N/A",
        employee?.employee_number,
        employee?.full_name,
        Number(item.gross_salary),
        Number(item.napsa_employee),
        Number(item.napsa_employer),
        Number(item.napsa_employee) + Number(item.napsa_employer),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NAPSA-Report-${month}.csv`;
    a.click();
  };

  const exportNHIMAReport = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "NHIMA Number",
      "Employee Number",
      "Employee Name",
      "Gross Salary",
      "NHIMA Employee (1%)",
      "NHIMA Employer (1%)",
      "Total NHIMA",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      return [
        employee?.nhima_number || "N/A",
        employee?.employee_number,
        employee?.full_name,
        Number(item.gross_salary),
        Number(item.nhima_employee),
        Number(item.nhima_employer),
        Number(item.nhima_employee) + Number(item.nhima_employer),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NHIMA-Report-${month}.csv`;
    a.click();
  };

  const totalPAYE = payrollItems?.reduce((sum, item) => sum + Number(item.paye), 0) || 0;
  const totalNAPSAEmployee = payrollItems?.reduce((sum, item) => sum + Number(item.napsa_employee), 0) || 0;
  const totalNAPSAEmployer = payrollItems?.reduce((sum, item) => sum + Number(item.napsa_employer), 0) || 0;
  const totalNHIMAEmployee = payrollItems?.reduce((sum, item) => sum + Number(item.nhima_employee), 0) || 0;
  const totalNHIMAEmployer = payrollItems?.reduce((sum, item) => sum + Number(item.nhima_employer), 0) || 0;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ZRA Compliance Reports</h1>
        <p className="text-muted-foreground">Generate statutory compliance reports for ZRA, NAPSA, and NHIMA</p>
      </div>

      <div className="max-w-xs">
        <Label>Select Month</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total PAYE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalPAYE)}</div>
            <Button className="mt-4 w-full" variant="outline" onClick={exportPAYEReport} disabled={!payrollItems || payrollItems.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export PAYE Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total NAPSA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalNAPSAEmployee + totalNAPSAEmployer)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Employee: {formatZMW(totalNAPSAEmployee)} | Employer: {formatZMW(totalNAPSAEmployer)}
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={exportNAPSAReport} disabled={!payrollItems || payrollItems.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export NAPSA Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total NHIMA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalNHIMAEmployee + totalNHIMAEmployer)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Employee: {formatZMW(totalNHIMAEmployee)} | Employer: {formatZMW(totalNHIMAEmployer)}
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={exportNHIMAReport} disabled={!payrollItems || payrollItems.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export NHIMA Report
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>TPIN</TableHead>
                <TableHead>NAPSA No.</TableHead>
                <TableHead>NHIMA No.</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>PAYE</TableHead>
                <TableHead>NAPSA</TableHead>
                <TableHead>NHIMA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollItems?.map((item) => {
                const employee = item.employees as any;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{employee?.full_name}</div>
                        <div className="text-sm text-muted-foreground">{employee?.employee_number}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{employee?.tpin || "N/A"}</TableCell>
                    <TableCell className="text-sm">{employee?.napsa_number || "N/A"}</TableCell>
                    <TableCell className="text-sm">{employee?.nhima_number || "N/A"}</TableCell>
                    <TableCell>{formatZMW(Number(item.gross_salary))}</TableCell>
                    <TableCell>{formatZMW(Number(item.paye))}</TableCell>
                    <TableCell>{formatZMW(Number(item.napsa_employee))}</TableCell>
                    <TableCell>{formatZMW(Number(item.nhima_employee))}</TableCell>
                  </TableRow>
                );
              })}
              {payrollItems?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No payroll data found for the selected month
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
