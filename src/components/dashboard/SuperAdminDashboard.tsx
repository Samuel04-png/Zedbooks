import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, FileText, TrendingUp, Building, Shield, AlertCircle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function SuperAdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [invoices, employees, payrollRuns, expenses, users, projects] = await Promise.all([
        supabase.from("invoices").select("total, status"),
        supabase.from("employees").select("id, employment_status"),
        supabase.from("payroll_runs").select("total_net, status"),
        supabase.from("expenses").select("amount"),
        supabase.from("user_roles").select("id, role"),
        supabase.from("projects").select("id, status, budget, spent"),
      ]);

      return {
        totalRevenue: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        pendingInvoices: invoices.data?.filter(i => i.status === 'pending').length || 0,
        activeEmployees: employees.data?.filter(e => e.employment_status === 'active').length || 0,
        totalPayroll: payrollRuns.data?.filter(p => p.status === 'approved').reduce((s, p) => s + (p.total_net || 0), 0) || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        totalUsers: users.data?.length || 0,
        adminUsers: users.data?.filter(u => u.role === 'super_admin' || u.role === 'admin').length || 0,
        activeProjects: projects.data?.filter(p => p.status === 'active').length || 0,
        totalProjectBudget: projects.data?.reduce((s, p) => s + (p.budget || 0), 0) || 0,
      };
    },
  });

  const metrics = [
    { title: "Total Revenue", value: formatZMW(stats?.totalRevenue || 0), icon: DollarSign, color: "text-green-500" },
    { title: "Active Employees", value: stats?.activeEmployees || 0, icon: Users, color: "text-blue-500" },
    { title: "Total Payroll", value: formatZMW(stats?.totalPayroll || 0), icon: TrendingUp, color: "text-purple-500" },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), icon: FileText, color: "text-red-500" },
    { title: "System Users", value: stats?.totalUsers || 0, icon: Shield, color: "text-amber-500" },
    { title: "Active Projects", value: stats?.activeProjects || 0, icon: Building, color: "text-teal-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Complete system overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.pendingInvoices > 0 && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium">{stats.pendingInvoices} Pending Invoices</p>
                    <p className="text-sm text-muted-foreground">Awaiting payment</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">{stats?.adminUsers || 0} Admin Users</p>
                  <p className="text-sm text-muted-foreground">With elevated privileges</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Projects</span>
                <span className="font-medium">{stats?.activeProjects || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Budget</span>
                <span className="font-medium">{formatZMW(stats?.totalProjectBudget || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
