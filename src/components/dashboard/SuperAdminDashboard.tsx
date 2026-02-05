import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899"];
const DONUT_COLORS = ["#f97316", "#ef4444", "#6366f1", "#ec4899", "#22c55e"];

export function SuperAdminDashboard() {
  const { data: companySettings } = useCompanySettings();
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [invoices, employees, payrollRuns, expenses, projects, customers] = await Promise.all([
        supabase.from("invoices").select("total, status, created_at"),
        supabase.from("employees").select("id, employment_status, department"),
        supabase.from("payroll_runs").select("total_net, status, total_gross, created_at"),
        supabase.from("expenses").select("amount, category, expense_date"),
        supabase.from("projects").select("id, status, budget, spent, name"),
        supabase.from("customers").select("id, name"),
      ]);

      // Group by department for donut chart
      const departmentData = (employees.data as { id: string; employment_status: string; department: string }[] || []).reduce((acc, emp) => {
        const dept = emp.department || "Other";
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

      const employeeList = employees.data as { id: string; employment_status: string; department: string }[] || [];

      return {
        totalRevenue: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        pendingInvoices: invoices.data?.filter(i => i.status === 'pending').length || 0,
        activeEmployees: employeeList.filter(e => e.employment_status === 'active').length,
        totalEmployees: employeeList.length,
        totalPayroll: payrollRuns.data?.filter(p => p.status === 'approved').reduce((s, p) => s + (p.total_net || 0), 0) || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        activeProjects: projects.data?.filter(p => p.status === 'active').length || 0,
        totalCustomers: customers.data?.length || 0,
        departmentData: Object.entries(departmentData).map(([name, value]) => ({ name, value })),
        monthlyRevenue,
        projects: projects.data?.slice(0, 5) || [],
      };
    },
  });

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';

  // Health metrics cards data
  const healthMetrics = [
    {
      title: "Total Revenue",
      value: formatZMW(stats?.totalRevenue || 0),
      icon: DollarSign,
      color: "bg-orange-500",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-500",
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
    <div className="space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome {userName},
            </h1>
            <p className="text-muted-foreground">How're you feeling today?</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 w-64 rounded-full bg-muted/50"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </Button>
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <Switch />
            <span className="text-sm text-muted-foreground">Dark Mode</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-orange-200">
              <AvatarFallback className="bg-gradient-to-br from-orange-400 to-orange-600 text-white">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthMetrics.map((metric, index) => (
          <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${metric.bgColor}`}>
                  <metric.icon className={`h-6 w-6 ${metric.iconColor}`} />
                </div>
                {metric.trend && (
                  <Badge className="bg-green-100 text-green-700 gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {metric.trend}
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{metric.title}</p>
                <p className="text-3xl font-bold mt-1">{metric.value}</p>
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
        <Card className="border-0 shadow-sm">
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
                  <p className="text-2xl font-bold text-orange-500">
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
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                      />
                      <span className="truncate max-w-[100px]">{dept.name}</span>
                    </div>
                    <span className="text-muted-foreground font-medium">{dept.value}</span>
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
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Revenue Overview</CardTitle>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Expenses</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="url(#colorRevenue)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#3b82f6" fill="url(#colorExpenses)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map / Region Stats */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              Regional Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {[
                  { region: "Lusaka", value: 42000, color: "bg-green-500" },
                  { region: "Copperbelt", value: 28000, color: "bg-blue-500" },
                  { region: "Southern", value: 18000, color: "bg-orange-500" },
                  { region: "Eastern", value: 12000, color: "bg-purple-500" },
                ].map((item) => (
                  <div key={item.region} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="font-medium">{item.region}</span>
                    </div>
                    <span className="font-bold">{formatZMW(item.value)}</span>
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
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              Upcoming Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingTasks.map((task, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    task.status === 'urgent' ? 'bg-red-100' : 
                    task.status === 'scheduled' ? 'bg-blue-100' : 'bg-orange-100'
                  }`}>
                    <Activity className={`h-5 w-5 ${
                      task.status === 'urgent' ? 'text-red-500' : 
                      task.status === 'scheduled' ? 'text-blue-500' : 'text-orange-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{task.name}</p>
                    <p className="text-xs text-muted-foreground">{task.type}</p>
                  </div>
                  <Badge variant={task.status === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
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
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold">{stats?.activeProjects || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Invoices</p>
                <p className="text-2xl font-bold">{stats?.pendingInvoices || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Payroll</p>
                <p className="text-2xl font-bold">{formatZMW(stats?.totalPayroll || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{formatZMW(stats?.totalExpenses || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
