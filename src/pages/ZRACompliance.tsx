import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PayrollRunRecord {
  id: string;
  runDate: string;
  status: "draft" | "trial" | "processed" | "paid" | "payment_reversed" | "reversed" | "final";
}

interface PayrollItemRecord {
  id: string;
  employeeId: string;
  payrollRunId: string;
  grossSalary: number;
  paye: number;
  napsaEmployee: number;
  napsaEmployer: number;
  nhimaEmployee: number;
  nhimaEmployer: number;
}

interface EmployeeRecord {
  id: string;
  fullName: string;
  employeeNumber: string | null;
  tpin: string | null;
  napsaNumber: string | null;
  nhimaNumber: string | null;
}

interface PayrollItemWithEmployee extends PayrollItemRecord {
  employee: EmployeeRecord | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
};

const toDateOnly = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString().slice(0, 10);
    }
  }
  return "";
};

const normalizePayrollStatus = (raw: unknown): PayrollRunRecord["status"] => {
  const value = String(raw || "").toLowerCase().trim();
  if (value === "approved") return "processed";
  if (value === "completed") return "paid";
  if (["draft", "trial", "processed", "paid", "payment_reversed", "reversed", "final"].includes(value)) {
    return value as PayrollRunRecord["status"];
  }
  return "draft";
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCSVValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/"/g, '""');
};

const downloadCSV = (headers: string[], rows: Array<Array<string | number | null | undefined>>, filename: string) => {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${toCSVValue(cell)}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function ZRACompliance() {
  const { user } = useAuth();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [includeReversed, setIncludeReversed] = useState(false);

  const companyQuery = useQuery({
    queryKey: ["zra-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const companyId = companyQuery.data ?? null;
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  const payrollRunsQuery = useQuery({
    queryKey: ["payroll-runs-zra", companyId, month],
    queryFn: async () => {
      if (!companyId) return [] as PayrollRunRecord[];

      const runsRef = collection(firestore, COLLECTIONS.PAYROLL_RUNS);
      const snapshot = await getDocs(query(runsRef, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            runDate: toDateOnly(row.runDate ?? row.run_date),
            status: normalizePayrollStatus(row.payrollStatus ?? row.payroll_status ?? row.status),
          } satisfies PayrollRunRecord;
        })
        .filter((run) => run.runDate >= startDate && run.runDate <= endDate)
        .sort((a, b) => b.runDate.localeCompare(a.runDate));
    },
    enabled: Boolean(companyId),
  });

  const payrollItemsQuery = useQuery({
    queryKey: [
      "payroll-items-zra",
      companyId,
      month,
      includeReversed ? "with-reversed" : "without-reversed",
      payrollRunsQuery.data?.map((run) => run.id).join(","),
    ],
    queryFn: async () => {
      if (!companyId || !payrollRunsQuery.data || payrollRunsQuery.data.length === 0) {
        return [] as PayrollItemWithEmployee[];
      }

      const runIds = payrollRunsQuery.data
        .filter((run) => includeReversed || run.status !== "reversed")
        .map((run) => run.id);
      if (runIds.length === 0) {
        return [] as PayrollItemWithEmployee[];
      }
      const itemsRef = collection(firestore, COLLECTIONS.PAYROLL_ITEMS);
      const runChunks = chunk(runIds, 30);

      const itemSnapshots = await Promise.all(
        runChunks.map((ids) => getDocs(query(itemsRef, where("payrollRunId", "in", ids)))),
      );

      const items: PayrollItemRecord[] = itemSnapshots.flatMap((snapshot) =>
        snapshot.docs.map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            employeeId: String(row.employeeId ?? row.employee_id ?? ""),
            payrollRunId: String(row.payrollRunId ?? row.payroll_run_id ?? ""),
            grossSalary: toNumber(row.grossSalary ?? row.gross_salary),
            paye: toNumber(row.paye),
            napsaEmployee: toNumber(row.napsaEmployee ?? row.napsa_employee),
            napsaEmployer: toNumber(row.napsaEmployer ?? row.napsa_employer),
            nhimaEmployee: toNumber(row.nhimaEmployee ?? row.nhima_employee),
            nhimaEmployer: toNumber(row.nhimaEmployer ?? row.nhima_employer),
          } satisfies PayrollItemRecord;
        }),
      );

      const employeeIds = Array.from(new Set(items.map((item) => item.employeeId).filter(Boolean)));
      const employeeMap = new Map<string, EmployeeRecord>();

      if (employeeIds.length > 0) {
        const employeesRef = collection(firestore, COLLECTIONS.EMPLOYEES);
        const employeeChunks = chunk(employeeIds, 30);
        const employeeSnapshots = await Promise.all(
          employeeChunks.map((ids) => getDocs(query(employeesRef, where(documentId(), "in", ids)))),
        );

        employeeSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            employeeMap.set(docSnap.id, {
              id: docSnap.id,
              fullName: String(row.fullName ?? row.full_name ?? ""),
              employeeNumber: (row.employeeNumber ?? row.employee_number ?? null) as string | null,
              tpin: (row.tpin ?? null) as string | null,
              napsaNumber: (row.napsaNumber ?? row.napsa_number ?? null) as string | null,
              nhimaNumber: (row.nhimaNumber ?? row.nhima_number ?? null) as string | null,
            });
          });
        });
      }

      return items.map((item) => ({
        ...item,
        employee: employeeMap.get(item.employeeId) ?? null,
      }));
    },
    enabled: Boolean(companyId) && Boolean(payrollRunsQuery.data) && (payrollRunsQuery.data?.length ?? 0) > 0,
  });

  const payrollItems = useMemo(
    () => payrollItemsQuery.data ?? [],
    [payrollItemsQuery.data],
  );
  const isLoading = companyQuery.isLoading || payrollRunsQuery.isLoading || payrollItemsQuery.isLoading;

  const totalPAYE = useMemo(
    () => payrollItems.reduce((sum, item) => sum + item.paye, 0),
    [payrollItems],
  );
  const totalNAPSAEmployee = useMemo(
    () => payrollItems.reduce((sum, item) => sum + item.napsaEmployee, 0),
    [payrollItems],
  );
  const totalNAPSAEmployer = useMemo(
    () => payrollItems.reduce((sum, item) => sum + item.napsaEmployer, 0),
    [payrollItems],
  );
  const totalNHIMAEmployee = useMemo(
    () => payrollItems.reduce((sum, item) => sum + item.nhimaEmployee, 0),
    [payrollItems],
  );
  const totalNHIMAEmployer = useMemo(
    () => payrollItems.reduce((sum, item) => sum + item.nhimaEmployer, 0),
    [payrollItems],
  );

  const exportPAYEReport = () => {
    if (payrollItems.length === 0) return;
    downloadCSV(
      ["TPIN", "Employee Number", "Employee Name", "Gross Salary", "PAYE"],
      payrollItems.map((item) => [
        item.employee?.tpin || "N/A",
        item.employee?.employeeNumber || "",
        item.employee?.fullName || "",
        item.grossSalary,
        item.paye,
      ]),
      `PAYE-Report-${month}.csv`,
    );
  };

  const exportNAPSAReport = () => {
    if (payrollItems.length === 0) return;
    downloadCSV(
      [
        "NAPSA Number",
        "Employee Number",
        "Employee Name",
        "Gross Salary",
        "NAPSA Employee (5%)",
        "NAPSA Employer (5%)",
        "Total NAPSA",
      ],
      payrollItems.map((item) => [
        item.employee?.napsaNumber || "N/A",
        item.employee?.employeeNumber || "",
        item.employee?.fullName || "",
        item.grossSalary,
        item.napsaEmployee,
        item.napsaEmployer,
        item.napsaEmployee + item.napsaEmployer,
      ]),
      `NAPSA-Report-${month}.csv`,
    );
  };

  const exportNHIMAReport = () => {
    if (payrollItems.length === 0) return;
    downloadCSV(
      [
        "NHIMA Number",
        "Employee Number",
        "Employee Name",
        "Gross Salary",
        "NHIMA Employee (1%)",
        "NHIMA Employer (1%)",
        "Total NHIMA",
      ],
      payrollItems.map((item) => [
        item.employee?.nhimaNumber || "N/A",
        item.employee?.employeeNumber || "",
        item.employee?.fullName || "",
        item.grossSalary,
        item.nhimaEmployee,
        item.nhimaEmployer,
        item.nhimaEmployee + item.nhimaEmployer,
      ]),
      `NHIMA-Report-${month}.csv`,
    );
  };

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
        <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeReversed}
            onChange={(event) => setIncludeReversed(event.target.checked)}
          />
          Include reversed payroll runs
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total PAYE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(totalPAYE)}</div>
            <Button className="mt-4 w-full" variant="outline" onClick={exportPAYEReport} disabled={payrollItems.length === 0}>
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
            <Button className="mt-4 w-full" variant="outline" onClick={exportNAPSAReport} disabled={payrollItems.length === 0}>
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
            <Button className="mt-4 w-full" variant="outline" onClick={exportNHIMAReport} disabled={payrollItems.length === 0}>
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
              {payrollItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.employee?.fullName || "Unknown Employee"}</div>
                      <div className="text-sm text-muted-foreground">{item.employee?.employeeNumber || "-"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{item.employee?.tpin || "N/A"}</TableCell>
                  <TableCell className="text-sm">{item.employee?.napsaNumber || "N/A"}</TableCell>
                  <TableCell className="text-sm">{item.employee?.nhimaNumber || "N/A"}</TableCell>
                  <TableCell>{formatZMW(item.grossSalary)}</TableCell>
                  <TableCell>{formatZMW(item.paye)}</TableCell>
                  <TableCell>{formatZMW(item.napsaEmployee)}</TableCell>
                  <TableCell>{formatZMW(item.nhimaEmployee)}</TableCell>
                </TableRow>
              ))}
              {payrollItems.length === 0 && (
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
