import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users, FileText, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const metrics = [
    {
      title: "Total Revenue",
      value: "ZMW 245,890",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Outstanding Invoices",
      value: "ZMW 58,240",
      change: "23 invoices",
      trend: "neutral",
      icon: FileText,
    },
    {
      title: "Total Expenses",
      value: "ZMW 142,560",
      change: "+8.2%",
      trend: "down",
      icon: TrendingDown,
    },
    {
      title: "Active Donors",
      value: "47",
      change: "+3 this month",
      trend: "up",
      icon: Users,
    },
  ];

  const recentInvoices = [
    { id: "INV-001", customer: "World Vision Zambia", amount: "ZMW 15,000", status: "Paid", date: "2025-10-28" },
    { id: "INV-002", customer: "UNICEF", amount: "ZMW 32,500", status: "Pending", date: "2025-10-25" },
    { id: "INV-003", customer: "Red Cross", amount: "ZMW 8,750", status: "Overdue", date: "2025-10-20" },
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{invoice.id}</p>
                    <p className="text-sm text-muted-foreground">{invoice.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{invoice.amount}</p>
                    <p className={`text-xs ${
                      invoice.status === "Paid" ? "text-success" :
                      invoice.status === "Overdue" ? "text-destructive" :
                      "text-warning"
                    }`}>
                      {invoice.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium">Reconcile October Bank Statement</p>
                  <p className="text-sm text-muted-foreground">Last reconciled: Oct 15, 2025</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">3 Overdue Invoices</p>
                  <p className="text-sm text-muted-foreground">Total: ZMW 24,850</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">Run October Payroll</p>
                  <p className="text-sm text-muted-foreground">Due: Nov 1, 2025</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
