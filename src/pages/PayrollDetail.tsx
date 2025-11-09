import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PayrollDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: payrollRun, isLoading } = useQuery({
    queryKey: ["payrollRun", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payrollItems", id],
    queryFn: async () => {
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
        .eq("payroll_run_id", id);

      if (error) throw error;
      return data;
    },
  });

  const exportToCSV = () => {
    if (!payrollItems || !payrollRun) return;

    const headers = [
      "Employee Number",
      "Name",
      "Basic Salary",
      "Housing",
      "Transport",
      "Other Allowances",
      "Gross Salary",
      "Advances Deducted",
      "Net Salary",
      "PAYE (Employer)",
      "NAPSA Employee (Employer)",
      "NAPSA Employer",
      "NHIMA Employee (Employer)",
      "NHIMA Employer",
    ];

    const rows = payrollItems.map((item: any) => [
      item.employees.employee_number,
      item.employees.full_name,
      item.basic_salary,
      item.housing_allowance,
      item.transport_allowance,
      item.other_allowances,
      item.gross_salary,
      item.advances_deducted || 0,
      item.net_salary,
      item.paye,
      item.napsa_employee,
      item.napsa_employer,
      item.nhima_employee,
      item.nhima_employer,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${format(new Date(payrollRun.run_date), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Payroll exported successfully");
  };

  const viewPayslip = (employeeId: string) => {
    navigate(`/payroll/${id}/payslip/${employeeId}`);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payroll Details</h1>
            <p className="text-muted-foreground">
              {payrollRun && (
                <>
                  {format(new Date(payrollRun.period_start), "dd MMM")} -{" "}
                  {format(new Date(payrollRun.period_end), "dd MMM yyyy")}
                </>
              )}
            </p>
          </div>
        </div>
        <Button onClick={exportToCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Gross</p>
          <p className="text-2xl font-bold">{formatZMW(Number(payrollRun?.total_gross || 0))}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Deductions</p>
          <p className="text-2xl font-bold">{formatZMW(Number(payrollRun?.total_deductions || 0))}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Net</p>
          <p className="text-2xl font-bold">{formatZMW(Number(payrollRun?.total_net || 0))}</p>
        </div>
      </div>

      {/* Payroll Items Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Salary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollItems?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.employees.full_name}</p>
                    <p className="text-sm text-muted-foreground">{item.employees.employee_number}</p>
                  </div>
                </TableCell>
                <TableCell>{formatZMW(Number(item.gross_salary))}</TableCell>
                <TableCell>{formatZMW(Number(item.total_deductions))}</TableCell>
                <TableCell className="font-medium">{formatZMW(Number(item.net_salary))}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => viewPayslip(item.employee_id)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Payslip
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
