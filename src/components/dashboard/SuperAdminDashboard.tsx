import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Building,
  ChevronRight,
  Star,
  MessageSquare,
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
  Legend,
} from "recharts";
import { useCompanySettings } from "@/hooks/useCompanySettings";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899"];

export function SuperAdminDashboard() {
  const { data: companySettings } = useCompanySettings();

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [invoices, employees, payrollRuns, expenses, users, projects] = await Promise.all([
        supabase.from("invoices").select("total, status"),
        supabase.from("employees").select("id, employment_status, department"),
        supabase.from("payroll_runs").select("total_net, status, total_gross"),
        supabase.from("expenses").select("amount"),
        supabase.from("user_roles").select("id, role"),
        supabase.from("projects").select("id, status, budget, spent"),
      ]);

      // Group employees by department
      const departmentData = employees.data?.reduce((acc, emp) => {
        const dept = emp.department || "Other";
        if (!acc[dept]) acc[dept] = 0;
        acc[dept]++;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalRevenue: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        pendingInvoices: invoices.data?.filter(i => i.status === 'pending').length || 0,
        activeEmployees: employees.data?.filter(e => e.employment_status === 'active').length || 0,
        totalEmployees: employees.data?.length || 0,
        totalPayroll: payrollRuns.data?.filter(p => p.status === 'approved').reduce((s, p) => s + (p.total_net || 0), 0) || 0,
        avgSalary: payrollRuns.data?.length ? 
          (payrollRuns.data.filter(p => p.status === 'approved').reduce((s, p) => s + (p.total_gross || 0), 0) / (employees.data?.length || 1)) : 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        totalUsers: users.data?.length || 0,
        activeProjects: projects.data?.filter(p => p.status === 'active').length || 0,
        departmentData: Object.entries(departmentData).map(([name, value]) => ({ name, value })),
      };
    },
  });

  const topMetrics = [
    {
      title: "Total Posts",
      value: stats?.pendingInvoices?.toString() || "0",
      change: "+15%",
      trend: "up",
      icon: FileText,
      color: "bg-orange-100 text-orange-600",
    },
    {
      title: "Employees",
      value: stats?.totalEmployees?.toLocaleString() || "0",
      change: "+2%",
      trend: "up",
      icon: Users,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Following",
      value: stats?.activeProjects?.toString() || "0",
      change: "Active",
      trend: "neutral",
      icon: Building,
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Engagement",
      value: "82.6%",
      change: "+2%",
      trend: "up",
      icon: TrendingUp,
      color: "bg-purple-100 text-purple-600",
    },
  ];

  const overtimeData = [
    { name: "Acc", thisWeek: 45, lastWeek: 38 },
    { name: "Adm", thisWeek: 52, lastWeek: 48 },
    { name: "Cus", thisWeek: 38, lastWeek: 42 },
    { name: "Fin", thisWeek: 65, lastWeek: 55 },
    { name: "HR", thisWeek: 48, lastWeek: 52 },
    { name: "IT", thisWeek: 58, lastWeek: 45 },
    { name: "Mar", thisWeek: 42, lastWeek: 38 },
  ];

  return (
    <div className="space-y-6 p-6 bg-muted/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-orange-600 text-white text-xl">
              {companySettings?.company_name?.charAt(0) || "A"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {companySettings?.company_name || "Admin"}
            </h1>
            <p className="text-muted-foreground">Status · Administrator</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 rounded-full">
            <MessageSquare className="h-4 w-4" />
            Chat Support
          </Button>
          <Button variant="outline" className="rounded-full">
            This month
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Analytics Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">Analytics</h2>
        <div className="flex gap-6 mt-4 border-b">
          <button className="pb-3 border-b-2 border-orange-500 text-orange-500 font-medium">
            Overview
          </button>
          <button className="pb-3 text-muted-foreground hover:text-foreground">
            Audience
          </button>
          <button className="pb-3 text-muted-foreground hover:text-foreground">
            Post Performance
          </button>
          <button className="pb-3 text-muted-foreground hover:text-foreground">
            Bio link analytic
          </button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {topMetrics.map((metric) => (
          <Card key={metric.title} className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${metric.color}`}>
                  <metric.icon className="h-6 w-6" />
                </div>
                {metric.trend === "up" && (
                  <Badge className="bg-green-100 text-green-700 gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === "down" && (
                  <Badge className="bg-red-100 text-red-700 gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === "neutral" && (
                  <Badge variant="secondary">{metric.change}</Badge>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{metric.title}</p>
                <p className="text-3xl font-bold mt-1">{metric.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Employee Monitoring */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Employee Monitoring Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.departmentData || []}
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(stats?.departmentData || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <p className="text-xs text-muted-foreground">Total Employee</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {((stats?.totalEmployees || 0) / 1000).toFixed(1)}k
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Department</p>
                {(stats?.departmentData || []).slice(0, 5).map((dept, index) => (
                  <div key={dept.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span>{dept.name}</span>
                    </div>
                    <span className="text-muted-foreground">{((dept.value / (stats?.totalEmployees || 1)) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overview Income */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Overview Income</CardTitle>
            <p className="text-sm text-muted-foreground">Lorem ipsum is simply dummy</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl font-bold">4.8</div>
              <div className="flex">
                {[1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
                <Star className="h-5 w-5 text-gray-300" />
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Revenue", value: 85, color: "bg-orange-500" },
                { label: "Expenses", value: 65, color: "bg-blue-500" },
                { label: "Payroll", value: 75, color: "bg-green-500" },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className={`h-2 ${item.color}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Card */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Basic Plan</CardTitle>
                <p className="text-sm text-muted-foreground">Suitable for starter business</p>
              </div>
              <Button variant="ghost" size="icon">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <span className="text-4xl font-bold">$99.99</span>
              <span className="text-muted-foreground">/year</span>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                </div>
                <span>Customers Segmentations</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                </div>
                <span>Lorem Ipsum is simply</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                </div>
                <span>Activity Reminder</span>
              </div>
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 rounded-full">
              Choose Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">New Employee</p>
              <p className="text-2xl font-bold">{stats?.activeEmployees?.toLocaleString() || "0"}</p>
              <Badge className="mt-2 bg-red-100 text-red-700">-0.5%</Badge>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg. Salary</p>
              <p className="text-2xl font-bold">{formatZMW(stats?.avgSalary || 0)}</p>
              <Badge className="mt-2 bg-green-100 text-green-700">+0.8%</Badge>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg. Overtime</p>
              <p className="text-2xl font-bold">2hr 15min</p>
              <Badge className="mt-2 bg-green-100 text-green-700">+1.2%</Badge>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Kpi's</p>
              <p className="text-2xl font-bold">85.45%</p>
              <Badge className="mt-2 bg-green-100 text-green-700">+0.8%</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Overtime Chart */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Overtime</CardTitle>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>This week</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span>Last week</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={overtimeData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="thisWeek" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lastWeek" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Overview Income Donut */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Overview Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Done", value: 67 },
                        { name: "To Do", value: 20 },
                        { name: "Pending", value: 13 },
                      ]}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="#f97316" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <p className="text-3xl font-bold">26</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>57% Done</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>20% To Do</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
