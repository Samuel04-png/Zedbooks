import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Calendar
} from "lucide-react";
import { format } from "date-fns";

export function AuditorDashboard() {
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollRuns = [] } = useQuery({
    queryKey: ["payroll-runs-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  // Calculate metrics
  const pendingPayrolls = payrollRuns.filter(p => p.status === "pending" || p.status === "draft").length;
  const approvedPayrolls = payrollRuns.filter(p => p.status === "approved").length;
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const projectsOverBudget = projects.filter(p => (p.spent || 0) > (p.budget || 0)).length;
  const recentChangesCount = auditLogs.length;

  // Get high-value expenses for review
  const highValueExpenses = expenses
    .filter(e => e.amount > 5000)
    .slice(0, 5);

  // Get action distribution
  const actionCounts = auditLogs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Auditor Dashboard
          </h1>
          <p className="text-muted-foreground">
            Compliance monitoring and audit trail overview
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Audit Mode
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayrolls}</div>
            <p className="text-xs text-muted-foreground">
              Payroll runs awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Payrolls</CardTitle>
            <FileCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedPayrolls}</div>
            <p className="text-xs text-muted-foreground">
              Successfully processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Over Budget</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectsOverBudget}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Changes</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentChangesCount}</div>
            <p className="text-xs text-muted-foreground">
              Audit log entries (last 20)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Audit Logs */}
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
                    <TableHead>Table</TableHead>
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
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge 
                            variant={
                              log.action === "DELETE" 
                                ? "destructive" 
                                : log.action === "INSERT" 
                                ? "default" 
                                : "secondary"
                            }
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.table_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.created_at), "MMM dd, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* High Value Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              High-Value Expenses ({">"} ZMW 5,000)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
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
                    highValueExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium max-w-[150px] truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(expense.amount)}
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

      {/* Action Distribution & Project Budget Status */}
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
                    <Badge 
                      variant={
                        action === "DELETE" 
                          ? "destructive" 
                          : action === "INSERT" 
                          ? "default" 
                          : "secondary"
                      }
                    >
                      {action}
                    </Badge>
                  </div>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(actionCounts).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No actions recorded
                </p>
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
                {projects
                  .filter(p => {
                    const utilization = p.budget ? ((p.spent || 0) / p.budget) * 100 : 0;
                    return utilization > 80;
                  })
                  .map((project) => {
                    const utilization = project.budget ? ((project.spent || 0) / project.budget) * 100 : 0;
                    return (
                      <div key={project.id} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.code}</p>
                        </div>
                        <Badge variant={utilization > 100 ? "destructive" : "secondary"}>
                          {utilization.toFixed(0)}% used
                        </Badge>
                      </div>
                    );
                  })}
                {projects.filter(p => {
                  const utilization = p.budget ? ((p.spent || 0) / p.budget) * 100 : 0;
                  return utilization > 80;
                }).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No budget alerts
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
