import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, TrendingUp, TrendingDown, Receipt, CreditCard } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function BookkeeperDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["bookkeeper-dashboard-stats"],
    queryFn: async () => {
      const [invoices, expenses, bills, vendors, customers] = await Promise.all([
        supabase.from("invoices").select("total, status"),
        supabase.from("expenses").select("amount, category, expense_date"),
        supabase.from("bills").select("total, status, due_date"),
        supabase.from("vendors").select("id"),
        supabase.from("customers").select("id"),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const overdueBills = bills.data?.filter(b => 
        b.status !== 'paid' && b.due_date && b.due_date < today
      ) || [];

      return {
        totalInvoices: invoices.data?.length || 0,
        paidInvoices: invoices.data?.filter(i => i.status === 'paid').length || 0,
        unpaidInvoicesAmount: invoices.data?.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        unpaidBillsAmount: bills.data?.filter(b => b.status !== 'paid').reduce((s, b) => s + (b.total || 0), 0) || 0,
        overdueBillsCount: overdueBills.length,
        overdueBillsAmount: overdueBills.reduce((s, b) => s + (b.total || 0), 0),
        vendorCount: vendors.data?.length || 0,
        customerCount: customers.data?.length || 0,
        recentExpenses: expenses.data?.slice(0, 5) || [],
      };
    },
  });

  const metrics = [
    { title: "Invoices Created", value: stats?.totalInvoices || 0, subtitle: `${stats?.paidInvoices || 0} paid`, icon: FileText, color: "text-primary" },
    { title: "Unpaid Invoices", value: formatZMW(stats?.unpaidInvoicesAmount || 0), icon: Receipt, color: "text-warning" },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), icon: TrendingDown, color: "text-destructive" },
    { title: "Unpaid Bills", value: formatZMW(stats?.unpaidBillsAmount || 0), icon: CreditCard, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookkeeper Dashboard</h1>
        <p className="text-muted-foreground">Daily transaction overview and data entry tasks</p>
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
              {"subtitle" in metric && (
                <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Customers</span>
              <span className="font-medium">{stats?.customerCount || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Vendors</span>
              <span className="font-medium">{stats?.vendorCount || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Overdue Bills</span>
              <span className="font-medium text-destructive">{stats?.overdueBillsCount || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <DollarSign className="h-5 w-5" />
              Overdue Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.overdueBillsCount > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Bills Overdue</span>
                  <span className="font-bold text-destructive">{stats.overdueBillsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-destructive">{formatZMW(stats.overdueBillsAmount || 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No overdue payments</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
