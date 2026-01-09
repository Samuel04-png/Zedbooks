import { useUserRole } from "@/hooks/useUserRole";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { BookkeeperDashboard } from "@/components/dashboard/BookkeeperDashboard";
import { HRDashboard } from "@/components/dashboard/HRDashboard";
import { InventoryDashboard } from "@/components/dashboard/InventoryDashboard";
import { ProjectManagerDashboard } from "@/components/dashboard/ProjectManagerDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users, FileText } from "lucide-react";

function DefaultDashboard() {
  const metrics = [
    { title: "Total Revenue", value: "ZMW 245,890", change: "+12.5%", trend: "up", icon: DollarSign },
    { title: "Outstanding Invoices", value: "ZMW 58,240", change: "23 invoices", trend: "neutral", icon: FileText },
    { title: "Total Expenses", value: "ZMW 142,560", change: "+8.2%", trend: "down", icon: TrendingDown },
    { title: "Active Donors", value: "47", change: "+3 this month", trend: "up", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your organization's financials</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {metric.trend === "up" && <TrendingUp className="h-3 w-3 text-success" />}
                {metric.trend === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
                {metric.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Select a module from the sidebar to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { data: userRole, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  switch (userRole) {
    case "super_admin":
    case "admin":
      return <SuperAdminDashboard />;
    case "accountant":
    case "finance_officer":
      return <AccountantDashboard />;
    case "bookkeeper":
      return <BookkeeperDashboard />;
    case "hr_manager":
      return <HRDashboard />;
    case "inventory_manager":
      return <InventoryDashboard />;
    case "project_manager":
      return <ProjectManagerDashboard />;
    default:
      return <DefaultDashboard />;
  }
}
