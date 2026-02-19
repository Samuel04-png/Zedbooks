import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  AlertTriangle,
  FileCheck,
  ClipboardList,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

type DashboardRow = Record<string, unknown>;

const toDateValue = (row: DashboardRow, keys: string[]) => {
  const raw = readString(row, keys);
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export function AuditorDashboard() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["auditor-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          auditLogs: [] as DashboardRow[],
          payrollRuns: [] as DashboardRow[],
          expenseRows: [] as Array<{
            expenseAccount: string;
            entryDate: string;
            description: string | null;
            referenceType: string | null;
            amount: number;
          }>,
          projects: [] as DashboardRow[],
        };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = today.toISOString().slice(0, 10);

      const [expenseReport, queryData] = await Promise.all([
        accountingService.getExpenseReport({
          companyId,
          startDate: monthStart,
          endDate: monthEnd,
        }),
        dashboardService.runQueries(user.id, {
          auditLogs: {
            collectionName: COLLECTIONS.AUDIT_LOGS,
            orderByField: "createdAt",
            orderDirection: "desc",
            limitCount: 20,
          },
          payrollRuns: {
            collectionName: COLLECTIONS.PAYROLL_RUNS,
            orderByField: "createdAt",
            orderDirection: "desc",
            limitCount: 10,
          },
          projects: {
            collectionName: COLLECTIONS.PROJECTS,
            orderByField: "createdAt",
            orderDirection: "desc",
          },
        }),
      ]);

      return {
        ...queryData,
        expenseRows: expenseReport.rows,
      };
    },
  });

  const auditLogs = data?.auditLogs ?? [];
  const payrollRuns = data?.payrollRuns ?? [];
  const expenseRows = data?.expenseRows ?? [];
  const projects = data?.projects ?? [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const pendingPayrolls = payrollRuns.filter((run) => {
    const status = readString(run, ["status", "payrollStatus", "payroll_status"]).toLowerCase();
    return status === "pending" || status === "draft";
  }).length;

  const approvedPayrolls = payrollRuns.filter((run) => {
    const status = readString(run, ["status", "payrollStatus", "payroll_status"]).toLowerCase();
    return ["approved", "final", "processed", "paid"].includes(status);
  }).length;

  const totalExpenseAmount = expenseRows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const projectsOverBudget = projects.filter((project) => readNumber(project, ["spent"]) > readNumber(project, ["budget"])).length;
  const recentChangesCount = auditLogs.length;

  const highValueExpenses = expenseRows.filter((expense) => Number(expense.amount || 0) > 5000).slice(0, 5);

  const actionCounts = auditLogs.reduce((acc, log) => {
    const action = readString(log, ["action"]).toUpperCase() || "UNKNOWN";
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const budgetAlerts = projects.filter((project) => {
    const budget = readNumber(project, ["budget"]);
    const spent = readNumber(project, ["spent"]);
    const utilization = budget > 0 ? (spent / budget) * 100 : 0;
    return utilization > 80;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Auditor Dashboard</h1>
          <p className="text-muted-foreground">Compliance monitoring and audit trail overview</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Audit Mode
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayrolls}</div>
            <p className="text-xs text-muted-foreground">Payroll runs awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Payrolls</CardTitle>
            <FileCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedPayrolls}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Over Budget</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectsOverBudget}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Changes</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentChangesCount}</div>
            <p className="text-xs text-muted-foreground">Audit log entries (last 20)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Recent Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => {
                      const action = readString(log, ["action"]).toUpperCase();
                      const timestamp = toDateValue(log, ["createdAt", "created_at"]);
                      return (
                        <TableRow key={readString(log, ["id"], "audit-log")}>
                          <TableCell>
                            <Badge
                              variant={
                                action === "DELETE" ? "destructive" : action === "INSERT" ? "default" : "secondary"
                              }
                            >
                              {action || "UNKNOWN"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {readString(log, ["tableName", "table_name", "entity"], "Unknown")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {timestamp ? format(timestamp, "MMM dd, HH:mm") : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              High-Value Expense Postings (&gt; ZMW 5,000)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Expense Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highValueExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No high-value expenses found
                      </TableCell>
                    </TableRow>
                  ) : (
                    highValueExpenses.map((expense, index) => (
                      <TableRow key={`${expense.expenseAccount}-${expense.entryDate}-${index}`}>
                        <TableCell className="font-medium max-w-[150px] truncate">
                          {expense.description || "Expense"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.expenseAccount || "Expense"}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(expense.amount || 0))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Action Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(actionCounts).map(([action, count]) => (
                <div key={action} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={action === "DELETE" ? "destructive" : action === "INSERT" ? "default" : "secondary"}>
                      {action}
                    </Badge>
                  </div>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(actionCounts).length === 0 && (
                <p className="text-center text-muted-foreground py-4">No actions recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Project Budget Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {budgetAlerts.map((project) => {
                  const budget = readNumber(project, ["budget"]);
                  const spent = readNumber(project, ["spent"]);
                  const utilization = budget > 0 ? (spent / budget) * 100 : 0;
                  return (
                    <div key={readString(project, ["id"], "project")} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="font-medium">{readString(project, ["name"], "Project")}</p>
                        <p className="text-xs text-muted-foreground">{readString(project, ["code"], "-")}</p>
                      </div>
                      <Badge variant={utilization > 100 ? "destructive" : "secondary"}>
                        {utilization.toFixed(0)}% used
                      </Badge>
                    </div>
                  );
                })}
                {budgetAlerts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No budget alerts</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Expense Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(totalExpenseAmount)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
