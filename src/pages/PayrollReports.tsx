import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

export default function PayrollReports() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ["payroll-runs-report", selectedMonth],
    queryFn: async () => {
      const startOfMonth = `${selectedMonth}-01`;
      const endOfMonth = new Date(
        parseInt(selectedMonth.split("-")[0]),
        parseInt(selectedMonth.split("-")[1]),
        0
      ).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .gte("run_date", startOfMonth)
        .lte("run_date", endOfMonth)
        .order("run_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payroll-items-report", selectedMonth],
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
            nhima_number,
            position,
            department
          )
        `)
        .in("payroll_run_id", runIds);

      if (error) throw error;
      return data;
    },
    enabled: !!payrollRuns && payrollRuns.length > 0,
  });

  const exportMasterPayroll = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "Employee Number",
      "Employee Name",
      "Position",
      "Department",
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
        employee?.position || "",
        employee?.department || "",
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
    a.download = `master-payroll-${selectedMonth}.csv`;
    a.click();
  };

  const exportNAPSAReport = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "Employee Number",
      "Employee Name",
      "NAPSA Number",
      "Gross Salary",
      "Employee Contribution (5%)",
      "Employer Contribution (5%)",
      "Total Contribution",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      const employeeContrib = Number(item.napsa_employee);
      const employerContrib = Number(item.napsa_employer);
      return [
        employee?.employee_number,
        employee?.full_name,
        employee?.napsa_number || "",
        Number(item.gross_salary),
        employeeContrib,
        employerContrib,
        employeeContrib + employerContrib,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `napsa-report-${selectedMonth}.csv`;
    a.click();
  };

  const exportNHIMAReport = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "Employee Number",
      "Employee Name",
      "NHIMA Number",
      "Basic Salary",
      "Employee Contribution (1%)",
      "Employer Contribution (1%)",
      "Total Contribution",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      const employeeContrib = Number(item.nhima_employee);
      const employerContrib = Number(item.nhima_employer);
      return [
        employee?.employee_number,
        employee?.full_name,
        employee?.nhima_number || "",
        Number(item.basic_salary),
        employeeContrib,
        employerContrib,
        employeeContrib + employerContrib,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nhima-report-${selectedMonth}.csv`;
    a.click();
  };

  const exportPAYEReport = () => {
    if (!payrollItems || payrollItems.length === 0) return;

    const headers = [
      "Employee Number",
      "Employee Name",
      "TPIN",
      "Gross Salary",
      "PAYE Amount",
    ];

    const rows = payrollItems.map((item) => {
      const employee = item.employees as any;
      return [
        employee?.employee_number,
        employee?.full_name,
        employee?.tpin || "",
        Number(item.gross_salary),
        Number(item.paye),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paye-report-${selectedMonth}.csv`;
    a.click();
  };

  const totalGross = payrollItems?.reduce((sum, item) => sum + Number(item.gross_salary), 0) || 0;
  const totalNet = payrollItems?.reduce((sum, item) => sum + Number(item.net_salary), 0) || 0;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Reports</h1>
          <p className="text-muted-foreground">Comprehensive payroll analysis and statutory reports</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-48">
          <Label>Select Month</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Gross</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalGross)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total PAYE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalPAYE)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total NAPSA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalNAPSAEmployee + totalNAPSAEmployer)}</div>
            <p className="text-xs text-muted-foreground">Employee + Employer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalNet)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="master" className="space-y-4">
        <TabsList>
          <TabsTrigger value="master">Master Payroll</TabsTrigger>
          <TabsTrigger value="payslips">Individual Payslips</TabsTrigger>
          <TabsTrigger value="napsa">NAPSA Report</TabsTrigger>
          <TabsTrigger value="nhima">NHIMA Report</TabsTrigger>
          <TabsTrigger value="paye">PAYE Report</TabsTrigger>
        </TabsList>

        <TabsContent value="master">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Master Payroll - {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</CardTitle>
              <Button onClick={exportMasterPayroll} disabled={!payrollItems?.length}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emp #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollItems?.map((item) => {
                    const employee = item.employees as any;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{employee?.employee_number}</TableCell>
                        <TableCell>{employee?.full_name}</TableCell>
                        <TableCell>{employee?.position || "-"}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.basic_salary))}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.gross_salary))}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.total_deductions))}</TableCell>
                        <TableCell className="text-right font-semibold">{formatZMW(Number(item.net_salary))}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(!payrollItems || payrollItems.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No payroll data for selected month
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card>
            <CardHeader>
              <CardTitle>Individual Payslips - {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payrollItems?.map((item) => {
                  const employee = item.employees as any;
                  return (
                    <Card key={item.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/payroll/${item.payroll_run_id}/payslip/${item.employee_id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{employee?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{employee?.employee_number}</p>
                          </div>
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-sm text-muted-foreground">Net Pay</p>
                          <p className="text-lg font-bold">{formatZMW(Number(item.net_salary))}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(!payrollItems || payrollItems.length === 0) && (
                  <p className="text-muted-foreground col-span-full text-center py-8">
                    No payroll data for selected month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="napsa">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>NAPSA Contributions Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total: {formatZMW(totalNAPSAEmployee + totalNAPSAEmployer)} (Employee: {formatZMW(totalNAPSAEmployee)} + Employer: {formatZMW(totalNAPSAEmployer)})
                </p>
              </div>
              <Button onClick={exportNAPSAReport} disabled={!payrollItems?.length}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emp #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>NAPSA Number</TableHead>
                    <TableHead className="text-right">Gross Salary</TableHead>
                    <TableHead className="text-right">Employee (5%)</TableHead>
                    <TableHead className="text-right">Employer (5%)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollItems?.map((item) => {
                    const employee = item.employees as any;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{employee?.employee_number}</TableCell>
                        <TableCell>{employee?.full_name}</TableCell>
                        <TableCell>{employee?.napsa_number || "-"}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.gross_salary))}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.napsa_employee))}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.napsa_employer))}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatZMW(Number(item.napsa_employee) + Number(item.napsa_employer))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nhima">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>NHIMA Contributions Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total: {formatZMW(totalNHIMAEmployee + totalNHIMAEmployer)} (Employee: {formatZMW(totalNHIMAEmployee)} + Employer: {formatZMW(totalNHIMAEmployer)})
                </p>
              </div>
              <Button onClick={exportNHIMAReport} disabled={!payrollItems?.length}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emp #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>NHIMA Number</TableHead>
                    <TableHead className="text-right">Basic Salary</TableHead>
                    <TableHead className="text-right">Employee (1%)</TableHead>
                    <TableHead className="text-right">Employer (1%)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollItems?.map((item) => {
                    const employee = item.employees as any;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{employee?.employee_number}</TableCell>
                        <TableCell>{employee?.full_name}</TableCell>
                        <TableCell>{employee?.nhima_number || "-"}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.basic_salary))}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.nhima_employee))}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.nhima_employer))}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatZMW(Number(item.nhima_employee) + Number(item.nhima_employer))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paye">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>PAYE Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total PAYE: {formatZMW(totalPAYE)}
                </p>
              </div>
              <Button onClick={exportPAYEReport} disabled={!payrollItems?.length}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emp #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>TPIN</TableHead>
                    <TableHead className="text-right">Gross Salary</TableHead>
                    <TableHead className="text-right">PAYE Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollItems?.map((item) => {
                    const employee = item.employees as any;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{employee?.employee_number}</TableCell>
                        <TableCell>{employee?.full_name}</TableCell>
                        <TableCell>{employee?.tpin || "-"}</TableCell>
                        <TableCell className="text-right">{formatZMW(Number(item.gross_salary))}</TableCell>
                        <TableCell className="text-right font-semibold">{formatZMW(Number(item.paye))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
