import { useQuery } from "@tanstack/react-query";
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface PayrollRun {
  id: string;
  runDate: string;
}

interface EmployeeSummary {
  fullName: string;
  employeeNumber: string;
  tpin: string;
  napsaNumber: string;
  nhimaNumber: string;
  position: string;
  department: string;
}

interface PayrollItemReport {
  id: string;
  payrollRunId: string;
  employeeId: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  paye: number;
  napsaEmployee: number;
  napsaEmployer: number;
  nhimaEmployee: number;
  nhimaEmployer: number;
  advancesDeducted: number;
  totalDeductions: number;
  netSalary: number;
  employees: EmployeeSummary | null;
}

const toDateString = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  if (!arr.length) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export default function PayrollReports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const startOfMonth = `${selectedMonth}-01`;
  const endOfMonth = new Date(
    parseInt(selectedMonth.split("-")[0], 10),
    parseInt(selectedMonth.split("-")[1], 10),
    0,
  )
    .toISOString()
    .split("T")[0];

  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ["payroll-runs-report", selectedMonth, user?.id],
    queryFn: async () => {
      if (!user) return [] as PayrollRun[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as PayrollRun[];

      const payrollRunsRef = collection(firestore, COLLECTIONS.PAYROLL_RUNS);
      const snapshot = await getDocs(
        query(payrollRunsRef, where("companyId", "==", membership.companyId)),
      );

      const rows = snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        const runDateRaw = row.runDate ?? row.run_date;
        return {
          id: docSnap.id,
          runDate: runDateRaw ? String(runDateRaw) : "",
        } satisfies PayrollRun;
      });

      return rows
        .filter((row) => {
          const normalizedDate = toDateString(row.runDate);
          return Boolean(normalizedDate && normalizedDate >= startOfMonth && normalizedDate <= endOfMonth);
        })
        .sort((a, b) => String(b.runDate).localeCompare(String(a.runDate)));
    },
    enabled: Boolean(user),
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payroll-items-report", selectedMonth, user?.id, (payrollRuns || []).map((run) => run.id).join("|")],
    queryFn: async () => {
      if (!user || !payrollRuns || payrollRuns.length === 0) return [] as PayrollItemReport[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as PayrollItemReport[];

      const runIds = new Set(payrollRuns.map((run) => run.id));

      const payrollItemsRef = collection(firestore, COLLECTIONS.PAYROLL_ITEMS);
      const itemSnapshot = await getDocs(
        query(payrollItemsRef, where("companyId", "==", membership.companyId)),
      );

      const mappedItems = itemSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            payrollRunId: String(row.payrollRunId ?? row.payroll_run_id ?? ""),
            employeeId: String(row.employeeId ?? row.employee_id ?? ""),
            basicSalary: Number(row.basicSalary ?? row.basic_salary ?? 0),
            housingAllowance: Number(row.housingAllowance ?? row.housing_allowance ?? 0),
            transportAllowance: Number(row.transportAllowance ?? row.transport_allowance ?? 0),
            otherAllowances: Number(row.otherAllowances ?? row.other_allowances ?? 0),
            grossSalary: Number(row.grossSalary ?? row.gross_salary ?? 0),
            paye: Number(row.paye ?? 0),
            napsaEmployee: Number(row.napsaEmployee ?? row.napsa_employee ?? 0),
            napsaEmployer: Number(row.napsaEmployer ?? row.napsa_employer ?? 0),
            nhimaEmployee: Number(row.nhimaEmployee ?? row.nhima_employee ?? 0),
            nhimaEmployer: Number(row.nhimaEmployer ?? row.nhima_employer ?? 0),
            advancesDeducted: Number(row.advancesDeducted ?? row.advances_deducted ?? 0),
            totalDeductions: Number(row.totalDeductions ?? row.total_deductions ?? 0),
            netSalary: Number(row.netSalary ?? row.net_salary ?? 0),
          };
        })
        .filter((row) => row.payrollRunId && runIds.has(row.payrollRunId));

      const employeeIds = Array.from(new Set(mappedItems.map((item) => item.employeeId).filter(Boolean)));
      const employeeMap = new Map<string, EmployeeSummary>();

      const employeeChunks = chunk(employeeIds, 30);
      if (employeeChunks.length > 0) {
        const employeesRef = collection(firestore, COLLECTIONS.EMPLOYEES);

        const employeeSnapshots = await Promise.all(
          employeeChunks.map((idChunk) =>
            getDocs(query(employeesRef, where(documentId(), "in", idChunk))),
          ),
        );

        employeeSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            employeeMap.set(docSnap.id, {
              fullName: String(row.fullName ?? row.full_name ?? ""),
              employeeNumber: String(row.employeeNumber ?? row.employee_number ?? ""),
              tpin: String(row.tpin ?? ""),
              napsaNumber: String(row.napsaNumber ?? row.napsa_number ?? ""),
              nhimaNumber: String(row.nhimaNumber ?? row.nhima_number ?? ""),
              position: String(row.position ?? ""),
              department: String(row.department ?? ""),
            });
          });
        });
      }

      return mappedItems.map((item) => ({
        ...item,
        employees: employeeMap.get(item.employeeId) ?? null,
      }));
    },
    enabled: Boolean(user && payrollRuns && payrollRuns.length > 0),
  });

  const exportCsv = (headers: string[], rows: Array<Array<string | number>>, filename: string) => {
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
      const employee = item.employees;
      return [
        employee?.employeeNumber ?? "",
        employee?.fullName ?? "",
        employee?.position || "",
        employee?.department || "",
        item.basicSalary,
        item.housingAllowance,
        item.transportAllowance,
        item.otherAllowances,
        item.grossSalary,
        item.paye,
        item.napsaEmployee,
        item.nhimaEmployee,
        item.advancesDeducted,
        item.totalDeductions,
        item.netSalary,
      ];
    });

    exportCsv(headers, rows, `master-payroll-${selectedMonth}.csv`);
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
      const employee = item.employees;
      const employeeContrib = item.napsaEmployee;
      const employerContrib = item.napsaEmployer;
      return [
        employee?.employeeNumber ?? "",
        employee?.fullName ?? "",
        employee?.napsaNumber || "",
        item.grossSalary,
        employeeContrib,
        employerContrib,
        employeeContrib + employerContrib,
      ];
    });

    exportCsv(headers, rows, `napsa-report-${selectedMonth}.csv`);
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
      const employee = item.employees;
      const employeeContrib = item.nhimaEmployee;
      const employerContrib = item.nhimaEmployer;
      return [
        employee?.employeeNumber ?? "",
        employee?.fullName ?? "",
        employee?.nhimaNumber || "",
        item.basicSalary,
        employeeContrib,
        employerContrib,
        employeeContrib + employerContrib,
      ];
    });

    exportCsv(headers, rows, `nhima-report-${selectedMonth}.csv`);
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
      const employee = item.employees;
      return [
        employee?.employeeNumber ?? "",
        employee?.fullName ?? "",
        employee?.tpin || "",
        item.grossSalary,
        item.paye,
      ];
    });

    exportCsv(headers, rows, `paye-report-${selectedMonth}.csv`);
  };

  const totalGross = payrollItems?.reduce((sum, item) => sum + item.grossSalary, 0) || 0;
  const totalNet = payrollItems?.reduce((sum, item) => sum + item.netSalary, 0) || 0;
  const totalPAYE = payrollItems?.reduce((sum, item) => sum + item.paye, 0) || 0;
  const totalNAPSAEmployee = payrollItems?.reduce((sum, item) => sum + item.napsaEmployee, 0) || 0;
  const totalNAPSAEmployer = payrollItems?.reduce((sum, item) => sum + item.napsaEmployer, 0) || 0;
  const totalNHIMAEmployee = payrollItems?.reduce((sum, item) => sum + item.nhimaEmployee, 0) || 0;
  const totalNHIMAEmployer = payrollItems?.reduce((sum, item) => sum + item.nhimaEmployer, 0) || 0;

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
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
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
                  {payrollItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.employees?.employeeNumber}</TableCell>
                      <TableCell>{item.employees?.fullName}</TableCell>
                      <TableCell>{item.employees?.position || "-"}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.basicSalary)}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.grossSalary)}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.totalDeductions)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatZMW(item.netSalary)}</TableCell>
                    </TableRow>
                  ))}
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
                {payrollItems?.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/payroll/${item.payrollRunId}/payslip/${item.employeeId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{item.employees?.fullName}</p>
                          <p className="text-sm text-muted-foreground">{item.employees?.employeeNumber}</p>
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">Net Pay</p>
                        <p className="text-lg font-bold">{formatZMW(item.netSalary)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                  {payrollItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.employees?.employeeNumber}</TableCell>
                      <TableCell>{item.employees?.fullName}</TableCell>
                      <TableCell>{item.employees?.napsaNumber || "-"}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.grossSalary)}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.napsaEmployee)}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.napsaEmployer)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatZMW(item.napsaEmployee + item.napsaEmployer)}</TableCell>
                    </TableRow>
                  ))}
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
                  {payrollItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.employees?.employeeNumber}</TableCell>
                      <TableCell>{item.employees?.fullName}</TableCell>
                      <TableCell>{item.employees?.nhimaNumber || "-"}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.basicSalary)}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.nhimaEmployee)}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.nhimaEmployer)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatZMW(item.nhimaEmployee + item.nhimaEmployer)}</TableCell>
                    </TableRow>
                  ))}
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
                <p className="text-sm text-muted-foreground mt-1">Total PAYE: {formatZMW(totalPAYE)}</p>
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
                  {payrollItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.employees?.employeeNumber}</TableCell>
                      <TableCell>{item.employees?.fullName}</TableCell>
                      <TableCell>{item.employees?.tpin || "-"}</TableCell>
                      <TableCell className="text-right">{formatZMW(item.grossSalary)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatZMW(item.paye)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
