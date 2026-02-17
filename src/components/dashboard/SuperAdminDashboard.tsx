import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
  Search,
  Bell,
  Moon,
  Activity,
  Heart,
  Stethoscope,
  MapPin,
  Building2,
} from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

// Updated Fintech Palette
const COLORS = ["#0f172a", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899"];
const DONUT_COLORS = ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8"];

export function SuperAdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          totalRevenue: 0,
          pendingInvoices: 0,
          activeEmployees: 0,
          totalEmployees: 0,
          totalPayroll: 0,
          totalExpenses: 0,
          activeProjects: 0,
          totalCustomers: 0,
          departmentData: [] as Array<{ name: string; value: number }>,
          monthlyRevenue: [] as Array<{ name: string; revenue: number; expenses: number }>,
          projects: [] as Array<Record<string, unknown>>,
        };
      }

      const { invoices, employees, payrollRuns, expenses, projects, customers } = await dashboardService.runQueries(user.id, {
        invoices: { collectionName: COLLECTIONS.INVOICES },
        employees: { collectionName: COLLECTIONS.EMPLOYEES },
        payrollRuns: { collectionName: COLLECTIONS.PAYROLL_RUNS },
        expenses: { collectionName: COLLECTIONS.EXPENSES },
        projects: { collectionName: COLLECTIONS.PROJECTS },
        customers: { collectionName: COLLECTIONS.CUSTOMERS },
      });

      // Group by department for donut chart
      const departmentData = employees.reduce((acc, employee) => {
        const dept = readString(employee, ["department"], "Other");
        if (!acc[dept]) acc[dept] = 0;
        acc[dept]++;
        return acc;
      }, {} as Record<string, number>);

      // Monthly data for charts
      const monthlyRevenue = [
        { name: "Jan", revenue: 12000, expenses: 8000 },
        { name: "Feb", revenue: 15000, expenses: 9500 },
        { name: "Mar", revenue: 18000, expenses: 11000 },
        { name: "Apr", revenue: 22000, expenses: 13000 },
        { name: "May", revenue: 25000, expenses: 14500 },
        { name: "Jun", revenue: 28000, expenses: 16000 },
        { name: "Jul", revenue: 32000, expenses: 18000 },
        { name: "Aug", revenue: 35000, expenses: 19500 },
        { name: "Sep", revenue: 38000, expenses: 21000 },
        { name: "Oct", revenue: 42000, expenses: 23000 },
        { name: "Nov", revenue: 45000, expenses: 25000 },
        { name: "Dec", revenue: 48000, expenses: 27000 },
      ];

      return {
        totalRevenue: invoices
          .filter((invoice) => readString(invoice, ["status"]) === "paid")
          .reduce((sum, invoice) => sum + readNumber(invoice, ["total", "amount"]), 0),
        pendingInvoices: invoices.filter((invoice) => readString(invoice, ["status"]) === "pending").length,
        activeEmployees: employees.filter((employee) => readString(employee, ["employmentStatus", "employment_status"]) === "active").length,
        totalEmployees: employees.length,
        totalPayroll: payrollRuns
          .filter((run) => readString(run, ["status", "payrollStatus", "payroll_status"]) === "approved")
          .reduce((sum, run) => sum + readNumber(run, ["totalNet", "total_net"]), 0),
        totalExpenses: expenses.reduce((sum, expense) => sum + readNumber(expense, ["amount", "total"]), 0),
        activeProjects: projects.filter((project) => readString(project, ["status"]) === "active").length,
        totalCustomers: customers.length,
        departmentData: Object.entries(departmentData).map(([name, value]) => ({ name, value })),
        monthlyRevenue,
        projects: projects.slice(0, 5),
      };
    },
  });

  const userName = user?.displayName || user?.email?.split("@")[0] || "Admin";

  // Calculate totals and other metrics...

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Safe defaults if stats fail to load
  const safeStats = stats || {
    totalRevenue: 0,
    pendingInvoices: 0,
    activeEmployees: 0,
    totalEmployees: 0,
    totalPayroll: 0,
    totalExpenses: 0,
    activeProjects: 0,
    totalCustomers: 0,
    departmentData: [],
    monthlyRevenue: [],
    projects: [],
  };

  // Health metrics cards data
  const healthMetrics = [
    {
      title: "Total Revenue",
      value: `ZMW ${safeStats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      trend: "+12.5% from last month",
      color: "text-green-600",
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Employees",
      value: stats?.totalEmployees?.toLocaleString() || "0",
      subtitle: `${stats?.activeEmployees || 0} active`,
      icon: Users,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Health Index",
      value: "75%",
      icon: Heart,
      color: "bg-green-500",
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
      trend: "+2%",
    },
    {
      title: "Customers",
      value: stats?.totalCustomers?.toLocaleString() || "0",
      icon: Stethoscope,
      color: "bg-purple-500",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  // Appointment/task data
  const upcomingTasks = [
    { name: "Invoice #1234", type: "Payment Due", date: "Today", status: "urgent" },
    { name: "Payroll Run", type: "Monthly", date: "Friday", status: "scheduled" },
    { name: "Tax Filing", type: "ZRA Compliance", date: "Next Week", status: "pending" },
    { name: "Budget Review", type: "Finance", date: "Monday", status: "scheduled" },
  ];

  return (
    <div className="space-y-6 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto justify-between md:justify-start">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Welcome {userName},
            </h1>
            <p className="text-xs md:text-base text-muted-foreground">Here's your organization's financial overview.</p>
          </div>
          {/* Mobile User Avatar (visible only on small screens) */}
          <div className="md:hidden">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-end">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 w-64 rounded-full bg-muted/50 focus:bg-background transition-colors"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-background" />
          </Button>
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <Switch />
            <span className="hidden md:inline text-sm text-muted-foreground">Dark Mode</span>
          </div>
          <div className="hidden md:flex items-center gap-3 pl-4 border-l">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {healthMetrics.map((metric, index) => (
          <Card key={index} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className={`p-2 md:p-3 rounded-xl ${metric.bgColor}`}>
                  <metric.icon className={`h-4 w-4 md:h-5 md:w-5 ${metric.iconColor}`} />
                </div>
                {metric.trend && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 gap-1 text-xs px-1.5 py-0.5">
                    <TrendingUp className="h-3 w-3" />
                    {metric.trend}
                  </Badge>
                )}
              </div>
              <div className="mt-3 md:mt-4">
                <p className="text-xs md:text-sm font-medium text-muted-foreground">{metric.title}</p>
                <p className="text-2xl md:text-3xl font-bold mt-1 tracking-tight text-foreground">{metric.value}</p>
                {metric.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Donut Chart - Department Distribution */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Department Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.departmentData?.length ? stats.departmentData : [{ name: "No Data", value: 1 }]}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(stats?.departmentData || [{ name: "No Data", value: 1 }]).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <p className="text-2xl font-bold text-primary">
                    {stats?.totalEmployees || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {(stats?.departmentData || []).slice(0, 5).map((dept, index) => (
                  <div key={dept.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                      />
                      <span className="truncate max-w-[100px] text-muted-foreground">{dept.name}</span>
                    </div>
                    <span className="font-medium">{dept.value}</span>
                  </div>
                ))}
                {(!stats?.departmentData || stats.departmentData.length === 0) && (
                  <p className="text-sm text-muted-foreground">No employee data</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Revenue Overview</CardTitle>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                <span className="text-muted-foreground">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Expenses</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} tickFormatter={(value) => `K${value / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0f172a" fill="url(#colorRevenue)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#3b82f6" fill="url(#colorExpenses)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map / Region Stats */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Regional Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {[
                  { region: "Lusaka", value: 42000, color: "bg-primary" },
                  { region: "Copperbelt", value: 28000, color: "bg-blue-500" },
                  { region: "Southern", value: 18000, color: "bg-indigo-500" },
                  { region: "Eastern", value: 12000, color: "bg-violet-500" },
                ].map((item) => (
                  <div key={item.region} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">{item.region}</span>
                    </div>
                    <span className="font-bold tabular-nums">{formatZMW(item.value)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { name: "Lusaka", value: 42 },
                    { name: "Copperbelt", value: 28 },
                    { name: "Southern", value: 18 },
                    { name: "Eastern", value: 12 },
                  ]}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingTasks.map((task, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${task.status === 'urgent' ? 'bg-red-50 text-red-600' :
                    task.status === 'scheduled' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                    }`}>
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{task.name}</p>
                    <p className="text-xs text-muted-foreground">{task.type}</p>
                  </div>
                  <Badge variant={task.status === 'urgent' ? 'destructive' : 'secondary'} className="text-xs font-normal">
                    {task.date}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/50 shadow-sm hover:border-primary/20 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active Projects</p>
                <p className="text-2xl font-bold mt-1">{stats?.activeProjects || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-sm hover:border-primary/20 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Pending Invoices</p>
                <p className="text-2xl font-bold mt-1">{stats?.pendingInvoices || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-sm hover:border-primary/20 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Payroll</p>
                <p className="text-2xl font-bold mt-1">{formatZMW(stats?.totalPayroll || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-sm hover:border-primary/20 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Expenses</p>
                <p className="text-2xl font-bold mt-1">{formatZMW(stats?.totalExpenses || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
