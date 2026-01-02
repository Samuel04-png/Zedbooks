import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Calendar, Clock, AlertCircle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";

export function HRDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["hr-dashboard-stats"],
    queryFn: async () => {
      const currentMonth = format(new Date(), "yyyy-MM");
      const startOfMonth = `${currentMonth}-01`;
      const endOfMonth = new Date(
        parseInt(currentMonth.split("-")[0]),
        parseInt(currentMonth.split("-")[1]),
        0
      ).toISOString().split("T")[0];

      const [employees, payrollRuns, advances, timeEntries] = await Promise.all([
        supabase.from("employees").select("id, employment_status, contract_type, department"),
        supabase.from("payroll_runs").select("total_net, total_gross, status, run_date").gte("run_date", startOfMonth).lte("run_date", endOfMonth),
        supabase.from("advances").select("amount, status, remaining_balance"),
        supabase.from("time_entries").select("hours_worked, status").gte("work_date", startOfMonth),
      ]);

      return {
        totalEmployees: employees.data?.length || 0,
        activeEmployees: employees.data?.filter(e => e.employment_status === 'active').length || 0,
        permanentEmployees: employees.data?.filter(e => e.contract_type === 'permanent').length || 0,
        contractEmployees: employees.data?.filter(e => e.contract_type === 'contract').length || 0,
        departments: [...new Set(employees.data?.map(e => e.department).filter(Boolean))].length,
        monthlyPayroll: payrollRuns.data?.filter(p => p.status === 'approved').reduce((s, p) => s + (p.total_net || 0), 0) || 0,
        pendingPayroll: payrollRuns.data?.filter(p => p.status === 'pending').length || 0,
        activeAdvances: advances.data?.filter(a => a.status === 'active').length || 0,
        totalAdvanceBalance: advances.data?.filter(a => a.status === 'active').reduce((s, a) => s + (a.remaining_balance || 0), 0) || 0,
        hoursLogged: timeEntries.data?.reduce((s, t) => s + (t.hours_worked || 0), 0) || 0,
        pendingTimeEntries: timeEntries.data?.filter(t => t.status === 'pending').length || 0,
      };
    },
  });

  const metrics = [
    { title: "Active Employees", value: stats?.activeEmployees || 0, icon: Users, color: "text-blue-500" },
    { title: "Monthly Payroll", value: formatZMW(stats?.monthlyPayroll || 0), icon: DollarSign, color: "text-green-500" },
    { title: "Active Advances", value: stats?.activeAdvances || 0, icon: Calendar, color: "text-amber-500" },
    { title: "Hours Logged", value: `${stats?.hoursLogged || 0}h`, icon: Clock, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">HR & Payroll Dashboard</h1>
        <p className="text-muted-foreground">Employee and payroll management overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle>Workforce Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Employees</span>
              <span className="font-medium">{stats?.totalEmployees || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Permanent Staff</span>
              <span className="font-medium">{stats?.permanentEmployees || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract Staff</span>
              <span className="font-medium">{stats?.contractEmployees || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Departments</span>
              <span className="font-medium">{stats?.departments || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.pendingPayroll > 0 && (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium">{stats.pendingPayroll} Pending Payroll Run(s)</p>
                  <p className="text-sm text-muted-foreground">Awaiting approval</p>
                </div>
              </div>
            )}
            {stats?.pendingTimeEntries > 0 && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">{stats.pendingTimeEntries} Pending Time Entries</p>
                  <p className="text-sm text-muted-foreground">Need review</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium">Outstanding Advances</p>
                <p className="text-sm text-muted-foreground">{formatZMW(stats?.totalAdvanceBalance || 0)} remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
