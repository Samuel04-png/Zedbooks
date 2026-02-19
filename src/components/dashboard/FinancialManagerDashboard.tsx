import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, TrendingUp, TrendingDown, ShieldCheck, CreditCard, AlertTriangle, CheckCircle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function FinancialManagerDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["financial-manager-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          totalRevenue: 0,
          totalExpenses: 0,
          cashBalance: 0,
          unpaidBills: 0,
          pendingApprovals: 0,
          pendingApprovalsAmount: 0,
          expensesPendingApproval: 0,
          lastPayrollGross: 0,
          lastPayrollNet: 0,
          monthlyProfit: 0,
          bankAccounts: [] as Array<Record<string, unknown>>,
        };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const [liveMetrics, { expenses, bankAccounts, payrollRuns, approvalRequests }] = await Promise.all([
        accountingService.getDashboardLiveMetrics({ companyId }),
        dashboardService.runQueries(user.id, {
        invoices: { collectionName: COLLECTIONS.INVOICES },
        expenses: { collectionName: COLLECTIONS.EXPENSES },
        bankAccounts: { collectionName: COLLECTIONS.BANK_ACCOUNTS },
        payrollRuns: { collectionName: COLLECTIONS.PAYROLL_RUNS, orderByField: "createdAt", orderDirection: "desc" },
        approvalRequests: { collectionName: COLLECTIONS.APPROVAL_REQUESTS },
      }),
      ]);

      const pendingApprovals = approvalRequests.filter((a) => readString(a, ["status"]) === "pending");

      return {
        totalRevenue: liveMetrics.monthlyIncome,
        totalExpenses: liveMetrics.monthlyExpenses,
        cashBalance: liveMetrics.bankDefaultBalance,
        unpaidBills: liveMetrics.outstandingAccountsPayable,
        pendingApprovals: pendingApprovals.length,
        pendingApprovalsAmount: pendingApprovals.reduce((sum, a) => sum + readNumber(a, ["amount"]), 0),
        expensesPendingApproval: expenses.filter((e) => readString(e, ["approvalStatus", "approval_status"]) === "pending").length,
        lastPayrollGross: payrollRuns[0] ? readNumber(payrollRuns[0], ["totalGross", "total_gross"]) : 0,
        lastPayrollNet: payrollRuns[0] ? readNumber(payrollRuns[0], ["totalNet", "total_net"]) : 0,
        monthlyProfit: liveMetrics.monthlyProfit,
        bankAccounts,
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
              <span className="text-muted-foreground">Monthly Profit (GL)</span>
              <span className="font-medium">{formatZMW(stats?.monthlyProfit || 0)}</span>
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
              {stats?.bankAccounts?.map((a: Record<string, unknown>) => (
                <div key={readString(a, ["accountName", "account_name", "id"], "bank-account")} className="flex justify-between mt-1">
                  <span className="text-sm text-muted-foreground">{readString(a, ["accountName", "account_name"], "Bank Account")}</span>
                  <span className="text-sm font-medium">{formatZMW(readNumber(a, ["currentBalance", "current_balance"]))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
