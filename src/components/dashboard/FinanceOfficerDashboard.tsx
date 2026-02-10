import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, TrendingDown, Receipt, CreditCard, AlertTriangle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function FinanceOfficerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["finance-officer-dashboard-stats"],
    queryFn: async () => {
      const [invoices, expenses, bills, bankAccounts] = await Promise.all([
        supabase.from("invoices").select("total, status, due_date"),
        supabase.from("expenses").select("amount, category, approval_status"),
        supabase.from("bills").select("total, status, due_date"),
        supabase.from("bank_accounts").select("current_balance, account_name"),
      ]);

      const today = new Date().toISOString().split('T')[0];

      return {
        paidInvoices: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        pendingInvoices: invoices.data?.filter(i => i.status === 'pending').length || 0,
        overdueInvoices: invoices.data?.filter(i => i.status !== 'paid' && i.due_date && i.due_date < today).length || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        pendingExpenses: expenses.data?.filter(e => e.approval_status === 'pending').length || 0,
        unpaidBills: bills.data?.filter(b => b.status !== 'paid').reduce((s, b) => s + (b.total || 0), 0) || 0,
        overdueBills: bills.data?.filter(b => b.status !== 'paid' && b.due_date && b.due_date < today).length || 0,
        cashBalance: bankAccounts.data?.reduce((s, a) => s + (a.current_balance || 0), 0) || 0,
      };
    },
  });

  const metrics = [
    { title: "Revenue Collected", value: formatZMW(stats?.paidInvoices || 0), icon: DollarSign },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), icon: TrendingDown },
    { title: "Unpaid Bills", value: formatZMW(stats?.unpaidBills || 0), icon: Receipt },
    { title: "Cash Balance", value: formatZMW(stats?.cashBalance || 0), icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance Officer Dashboard</h1>
        <p className="text-muted-foreground">Manage invoices, bills, and expenses</p>
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Invoice Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pending Invoices</span>
              <span className="font-medium">{stats?.pendingInvoices || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Overdue Invoices</span>
              <span className="font-medium text-destructive">{stats?.overdueInvoices || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expenses Pending Approval</span>
              <span className="font-medium">{stats?.pendingExpenses || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.overdueInvoices || 0) > 0 && (
              <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                {stats?.overdueInvoices} overdue invoice(s) require follow-up
              </div>
            )}
            {(stats?.overdueBills || 0) > 0 && (
              <div className="p-2 bg-warning/10 rounded text-sm text-warning">
                {stats?.overdueBills} overdue bill(s) need payment
              </div>
            )}
            {(stats?.overdueInvoices || 0) === 0 && (stats?.overdueBills || 0) === 0 && (
              <p className="text-muted-foreground text-sm">No urgent alerts</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
