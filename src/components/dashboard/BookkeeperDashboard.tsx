import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, TrendingUp, TrendingDown, Receipt, CreditCard } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function BookkeeperDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["bookkeeper-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          totalInvoices: 0,
          paidInvoices: 0,
          unpaidInvoicesAmount: 0,
          totalExpenses: 0,
          unpaidBillsAmount: 0,
          overdueBillsCount: 0,
          overdueBillsAmount: 0,
          vendorCount: 0,
          customerCount: 0,
          recentExpenses: [] as Array<Record<string, unknown>>,
        };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const [liveMetrics, { invoices, expenses, bills, vendors, customers }] = await Promise.all([
        accountingService.getDashboardLiveMetrics({ companyId }),
        dashboardService.runQueries(user.id, {
        invoices: { collectionName: COLLECTIONS.INVOICES },
        expenses: { collectionName: COLLECTIONS.EXPENSES },
        bills: { collectionName: COLLECTIONS.BILLS },
        vendors: { collectionName: COLLECTIONS.VENDORS },
        customers: { collectionName: COLLECTIONS.CUSTOMERS },
      }),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const overdueBills = bills.filter((b) => {
        const dueDate = readString(b, ["dueDate", "due_date"]);
        return readString(b, ["status"]).toLowerCase() !== "paid" && Boolean(dueDate) && dueDate < today;
      });

      return {
        totalInvoices: invoices.length,
        paidInvoices: invoices.filter((i) => readString(i, ["status"]).toLowerCase() === "paid").length,
        unpaidInvoicesAmount: liveMetrics.outstandingAccountsReceivable,
        totalExpenses: liveMetrics.monthlyExpenses,
        unpaidBillsAmount: liveMetrics.outstandingAccountsPayable,
        overdueBillsCount: overdueBills.length,
        overdueBillsAmount: overdueBills.reduce((sum, b) => sum + readNumber(b, ["total", "amount"]), 0),
        vendorCount: vendors.length,
        customerCount: customers.length,
        recentExpenses: expenses.slice(0, 5),
      };
    },
  });

  const metrics = [
    { title: "Invoices Created", value: stats?.totalInvoices || 0, subtitle: `${stats?.paidInvoices || 0} paid`, icon: FileText, color: "text-primary" },
    { title: "Unpaid Invoices", value: formatZMW(stats?.unpaidInvoicesAmount || 0), icon: Receipt, color: "text-warning" },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), icon: TrendingDown, color: "text-destructive" },
    { title: "Unpaid Bills", value: formatZMW(stats?.unpaidBillsAmount || 0), icon: CreditCard, color: "text-amber-600" },
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
