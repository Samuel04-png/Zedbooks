import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, TrendingUp, TrendingDown, ShieldCheck, CreditCard, AlertTriangle, CheckCircle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function FinancialManagerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["financial-manager-dashboard-stats"],
    queryFn: async () => {
      const [invoices, expenses, bills, bankAccounts, payrollRuns, approvalRequests] = await Promise.all([
        supabase.from("invoices").select("total, status, vat_amount"),
        supabase.from("expenses").select("amount, approval_status"),
        supabase.from("bills").select("total, status, approval_status"),
        supabase.from("bank_accounts").select("current_balance, account_name"),
        supabase.from("payroll_runs").select("total_gross, total_net, status, payroll_status"),
        supabase.from("approval_requests").select("status, workflow_type, amount"),
      ]);

      const pendingApprovals = approvalRequests.data?.filter(a => a.status === 'pending') || [];

      return {
        totalRevenue: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0) || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        cashBalance: bankAccounts.data?.reduce((s, a) => s + (a.current_balance || 0), 0) || 0,
        unpaidBills: bills.data?.filter(b => b.status !== 'paid').reduce((s, b) => s + (b.total || 0), 0) || 0,
        pendingApprovals: pendingApprovals.length,
        pendingApprovalsAmount: pendingApprovals.reduce((s, a) => s + (a.amount || 0), 0),
        expensesPendingApproval: expenses.data?.filter(e => e.approval_status === 'pending').length || 0,
        lastPayrollGross: payrollRuns.data?.[0]?.total_gross || 0,
        lastPayrollNet: payrollRuns.data?.[0]?.total_net || 0,
        bankAccounts: bankAccounts.data || [],
        vatCollected: invoices.data?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.vat_amount || 0), 0) || 0,
      };
    },
  });

  const netIncome = (stats?.totalRevenue || 0) - (stats?.totalExpenses || 0);

  const metrics = [
    { title: "Total Revenue", value: formatZMW(stats?.totalRevenue || 0), icon: DollarSign, color: "text-green-500" },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), icon: TrendingDown, color: "text-destructive" },
    { title: "Cash Balance", value: formatZMW(stats?.cashBalance || 0), icon: CreditCard, color: "text-primary" },
    { title: "Pending Approvals", value: stats?.pendingApprovals || 0, icon: ShieldCheck, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Manager Dashboard</h1>
        <p className="text-muted-foreground">Oversee all financial operations and approvals</p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Profit & Loss
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-medium text-green-600">{formatZMW(stats?.totalRevenue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium text-destructive">({formatZMW(stats?.totalExpenses || 0)})</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold">Net Income</span>
              <span className={`font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-destructive'}`}>
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
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Approval Requests</span>
              <Badge variant={stats?.pendingApprovals ? "destructive" : "secondary"}>
                {stats?.pendingApprovals || 0}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Approvals Value</span>
              <span className="font-medium">{formatZMW(stats?.pendingApprovalsAmount || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expenses Pending</span>
              <Badge variant={stats?.expensesPendingApproval ? "outline" : "secondary"}>
                {stats?.expensesPendingApproval || 0}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Unpaid Bills</span>
              <span className="font-medium text-destructive">{formatZMW(stats?.unpaidBills || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Payroll Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Gross Payroll</span>
              <span className="font-medium">{formatZMW(stats?.lastPayrollGross || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Net Payroll</span>
              <span className="font-medium">{formatZMW(stats?.lastPayrollNet || 0)}</span>
            </div>
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground">Bank Accounts</p>
              {stats?.bankAccounts?.map((a: { account_name: string; current_balance: number }) => (
                <div key={a.account_name} className="flex justify-between mt-1">
                  <span className="text-sm text-muted-foreground">{a.account_name}</span>
                  <span className="text-sm font-medium">{formatZMW(a.current_balance || 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
