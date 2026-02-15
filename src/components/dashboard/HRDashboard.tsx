import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Calendar, Clock, AlertCircle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function HRDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["hr-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          totalEmployees: 0,
          activeEmployees: 0,
          permanentEmployees: 0,
          contractEmployees: 0,
          departments: 0,
          monthlyPayroll: 0,
          pendingPayroll: 0,
          activeAdvances: 0,
          totalAdvanceBalance: 0,
          hoursLogged: 0,
          pendingTimeEntries: 0,
        };
      }

      const currentMonth = format(new Date(), "yyyy-MM");
      const startOfMonth = `${currentMonth}-01`;
      const endOfMonth = new Date(
        parseInt(currentMonth.split("-")[0]),
        parseInt(currentMonth.split("-")[1]),
        0
      ).toISOString().split("T")[0];

      const { employees, payrollRuns, advances, timeEntries } = await dashboardService.runQueries(user.id, {
        employees: { collectionName: COLLECTIONS.EMPLOYEES },
        payrollRuns: {
          collectionName: COLLECTIONS.PAYROLL_RUNS,
          filters: [
            { field: "runDate", op: ">=", value: startOfMonth },
            { field: "runDate", op: "<=", value: endOfMonth },
          ],
        },
        advances: { collectionName: COLLECTIONS.ADVANCES },
        timeEntries: {
          collectionName: COLLECTIONS.TIME_ENTRIES,
          filters: [{ field: "workDate", op: ">=", value: startOfMonth }],
        },
      });

      const departments = new Set(
        employees
          .map((e) => readString(e, ["department"]))
          .filter((value) => Boolean(value)),
      );

      return {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => readString(e, ["employmentStatus", "employment_status"]) === "active").length,
        permanentEmployees: employees.filter((e) => readString(e, ["contractType", "contract_type"]) === "permanent").length,
        contractEmployees: employees.filter((e) => readString(e, ["contractType", "contract_type"]) === "contract").length,
        departments: departments.size,
        monthlyPayroll: payrollRuns
          .filter((p) => readString(p, ["status", "payrollStatus", "payroll_status"]) === "approved")
          .reduce((sum, p) => sum + readNumber(p, ["totalNet", "total_net"]), 0),
        pendingPayroll: payrollRuns.filter((p) => readString(p, ["status", "payrollStatus", "payroll_status"]) === "pending").length,
        activeAdvances: advances.filter((a) => readString(a, ["status"]) === "active").length,
        totalAdvanceBalance: advances
          .filter((a) => readString(a, ["status"]) === "active")
          .reduce((sum, a) => sum + readNumber(a, ["remainingBalance", "remaining_balance"]), 0),
        hoursLogged: timeEntries.reduce((sum, t) => sum + readNumber(t, ["hoursWorked", "hours_worked"]), 0),
        pendingTimeEntries: timeEntries.filter((t) => readString(t, ["status"]) === "pending").length,
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
