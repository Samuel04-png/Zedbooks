import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, TrendingUp, TrendingDown, CreditCard, Building } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function AccountantDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["accountant-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          totalRevenue: 0,
          outstandingReceivables: 0,
          totalExpenses: 0,
          outstandingPayables: 0,
          cashBalance: 0,
          pendingInvoices: 0,
          bankAccounts: [] as Array<Record<string, unknown>>,
        };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const [liveMetrics, { invoices, bankAccounts }] = await Promise.all([
        accountingService.getDashboardLiveMetrics({ companyId }),
        dashboardService.runQueries(user.id, {
        invoices: { collectionName: COLLECTIONS.INVOICES },
        bankAccounts: { collectionName: COLLECTIONS.BANK_ACCOUNTS },
      }),
      ]);

      return {
        totalRevenue: liveMetrics.monthlyIncome,
        outstandingReceivables: liveMetrics.outstandingAccountsReceivable,
        totalExpenses: liveMetrics.monthlyExpenses,
        outstandingPayables: liveMetrics.outstandingAccountsPayable,
        cashBalance: liveMetrics.bankDefaultBalance,
        pendingInvoices: invoices.filter((i) => {
          const status = readString(i, ["status"]).toLowerCase();
          return !["paid", "cancelled", "rejected"].includes(status);
        }).length,
        bankAccounts,
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
              <span className="text-muted-foreground">Outstanding Payables</span>
              <span className="font-medium">{formatZMW(stats?.outstandingPayables || 0)}</span>
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
              {stats?.bankAccounts?.map((account: Record<string, unknown>) => (
                <div key={readString(account, ["accountName", "account_name", "id"], "bank-account")} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{readString(account, ["accountName", "account_name"], "Bank Account")}</span>
                  <span className="font-medium">{formatZMW(readNumber(account, ["currentBalance", "current_balance"]))}</span>
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
