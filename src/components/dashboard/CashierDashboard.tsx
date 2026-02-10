import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, ArrowDownCircle, ArrowUpCircle, Wallet, ClipboardCheck } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function CashierDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["cashier-dashboard-stats"],
    queryFn: async () => {
      const [bankAccounts, cashRecons, bankTransactions] = await Promise.all([
        supabase.from("bank_accounts").select("current_balance, account_name, account_type"),
        supabase.from("cash_reconciliations").select("*").order("reconciliation_date", { ascending: false }).limit(5),
        supabase.from("bank_transactions").select("amount, transaction_type, transaction_date, description").order("created_at", { ascending: false }).limit(10),
      ]);

      const cashAccounts = bankAccounts.data?.filter(a => a.account_type === 'cash' || a.account_type === 'petty_cash') || [];
      const allAccounts = bankAccounts.data || [];

      const recentReceipts = bankTransactions.data?.filter(t => t.transaction_type === 'deposit') || [];
      const recentPayments = bankTransactions.data?.filter(t => t.transaction_type === 'withdrawal') || [];

      return {
        cashBalance: cashAccounts.reduce((s, a) => s + (a.current_balance || 0), 0),
        totalBalance: allAccounts.reduce((s, a) => s + (a.current_balance || 0), 0),
        cashAccounts,
        recentReconciliations: cashRecons.data || [],
        recentReceipts,
        recentPayments,
        todayReceipts: recentReceipts.reduce((s, t) => s + (t.amount || 0), 0),
        todayPayments: recentPayments.reduce((s, t) => s + (t.amount || 0), 0),
      };
    },
  });

  const metrics = [
    { title: "Cash on Hand", value: formatZMW(stats?.cashBalance || 0), icon: Wallet, color: "text-green-500" },
    { title: "Total Balance", value: formatZMW(stats?.totalBalance || 0), icon: Banknote, color: "text-primary" },
    { title: "Recent Receipts", value: formatZMW(stats?.todayReceipts || 0), icon: ArrowDownCircle, color: "text-green-500" },
    { title: "Recent Payments", value: formatZMW(stats?.todayPayments || 0), icon: ArrowUpCircle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cashier Dashboard</h1>
        <p className="text-muted-foreground">Cash transactions and petty cash management</p>
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
            <CardTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-green-500" />
              Recent Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.recentReceipts?.length ? stats.recentReceipts.map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground truncate max-w-[60%]">{t.description || 'Deposit'}</span>
                  <span className="font-medium text-green-600">{formatZMW(t.amount || 0)}</span>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm">No recent receipts</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Recent Reconciliations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.recentReconciliations?.length ? stats.recentReconciliations.map((r: any) => (
                <div key={r.id} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{r.reconciliation_date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatZMW(r.closing_balance || 0)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm">No reconciliations yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
