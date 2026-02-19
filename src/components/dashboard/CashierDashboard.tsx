import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, ArrowDownCircle, ArrowUpCircle, Wallet, ClipboardCheck } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function CashierDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["cashier-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          cashBalance: 0,
          totalBalance: 0,
          cashAccounts: [] as Array<Record<string, unknown>>,
          recentReconciliations: [] as Array<Record<string, unknown>>,
          recentReceipts: [] as Array<Record<string, unknown>>,
          recentPayments: [] as Array<Record<string, unknown>>,
          todayReceipts: 0,
          todayPayments: 0,
        };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const today = new Date();
      const endDate = today.toISOString().slice(0, 10);
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

      const [liveMetrics, balanceSheet, cashFlow, { cashReconciliations }] = await Promise.all([
        accountingService.getDashboardLiveMetrics({ companyId }),
        accountingService.getBalanceSheetReport({ companyId, asOfDate: endDate }),
        accountingService.getCashFlowReport({ companyId, startDate, endDate }),
        dashboardService.runQueries(user.id, {
          cashReconciliations: {
            collectionName: COLLECTIONS.CASH_RECONCILIATIONS,
            orderByField: "reconciliationDate",
            orderDirection: "desc",
            limitCount: 5,
          },
        }),
      ]);

      const cashAssetRows = balanceSheet.assets.filter((row) => {
        const name = row.accountName.toLowerCase();
        return name.includes("cash") || name.includes("bank") || name.includes("money");
      });

      const cashAccounts = cashAssetRows.map((row) => ({
        accountName: row.accountName,
        currentBalance: row.balance,
      }));

      const recentReceipts = cashFlow.rows
        .filter((row) => row.moneyIn > 0)
        .slice(0, 5)
        .map((row) => ({
          description: row.description || row.referenceType || "Receipt",
          amount: row.moneyIn,
        }));

      const recentPayments = cashFlow.rows
        .filter((row) => row.moneyOut > 0)
        .slice(0, 5)
        .map((row) => ({
          description: row.description || row.referenceType || "Payment",
          amount: row.moneyOut,
        }));

      return {
        cashBalance: liveMetrics.bankDefaultBalance,
        totalBalance: cashAssetRows.reduce((sum, row) => sum + Number(row.balance || 0), 0),
        cashAccounts,
        recentReconciliations: cashReconciliations,
        recentReceipts,
        recentPayments,
        todayReceipts: cashFlow.rows.reduce((sum, row) => sum + Number(row.moneyIn || 0), 0),
        todayPayments: cashFlow.rows.reduce((sum, row) => sum + Number(row.moneyOut || 0), 0),
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
              {stats?.recentReceipts?.length ? stats.recentReceipts.map((t: Record<string, unknown>, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground truncate max-w-[60%]">{readString(t, ["description"], "Deposit")}</span>
                  <span className="font-medium text-green-600">{formatZMW(readNumber(t, ["amount"]))}</span>
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
              {stats?.recentReconciliations?.length ? stats.recentReconciliations.map((r: Record<string, unknown>) => (
                <div key={readString(r, ["id"], "reconciliation")} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{readString(r, ["reconciliationDate", "reconciliation_date"], "-")}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatZMW(readNumber(r, ["closingBalance", "closing_balance"]))}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${readString(r, ["status"]) === 'approved' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {readString(r, ["status"], "pending")}
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
