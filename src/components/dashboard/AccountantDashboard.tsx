import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, TrendingUp, TrendingDown, CreditCard, Building } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function AccountantDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["accountant-dashboard-stats"],
    queryFn: async () => {
      const [invoices, expenses, bills, bankAccounts] = await Promise.all([
        supabase.from("invoices").select("total, status, vat_amount"),
        supabase.from("expenses").select("amount, category"),
        supabase.from("bills").select("total, status"),
        supabase.from("bank_accounts").select("current_balance, account_name"),
      ]);

      return {
        totalRevenue: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        outstandingReceivables: invoices.data?.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        vatCollected: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.vat_amount || 0), 0) || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        unpaidBills: bills.data?.filter(b => b.status !== 'paid').reduce((s, b) => s + (b.total || 0), 0) || 0,
        cashBalance: bankAccounts.data?.reduce((s, a) => s + (a.current_balance || 0), 0) || 0,
        pendingInvoices: invoices.data?.filter(i => i.status === 'pending').length || 0,
        bankAccounts: bankAccounts.data || [],
      };
    },
  });

  const metrics = [
    { title: "Total Revenue", value: formatZMW(stats?.totalRevenue || 0), icon: DollarSign, trend: "up" },
    { title: "Outstanding Receivables", value: formatZMW(stats?.outstandingReceivables || 0), icon: FileText, trend: "neutral" },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), icon: TrendingDown, trend: "down" },
    { title: "Cash Balance", value: formatZMW(stats?.cashBalance || 0), icon: CreditCard, trend: "up" },
  ];

  const netIncome = (stats?.totalRevenue || 0) - (stats?.totalExpenses || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accountant Dashboard</h1>
        <p className="text-muted-foreground">Financial overview and key metrics</p>
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
              {metric.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500 inline ml-1" />}
              {metric.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500 inline ml-1" />}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-medium text-green-600">{formatZMW(stats?.totalRevenue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Expenses</span>
              <span className="font-medium text-red-600">({formatZMW(stats?.totalExpenses || 0)})</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Net Income</span>
              <span className={`font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatZMW(netIncome)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT Collected</span>
              <span className="font-medium">{formatZMW(stats?.vatCollected || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Bank Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.bankAccounts?.map((account: { account_name: string; current_balance: number }) => (
                <div key={account.account_name} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{account.account_name}</span>
                  <span className="font-medium">{formatZMW(account.current_balance || 0)}</span>
                </div>
              ))}
              {(!stats?.bankAccounts || stats.bankAccounts.length === 0) && (
                <p className="text-muted-foreground text-sm">No bank accounts configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
