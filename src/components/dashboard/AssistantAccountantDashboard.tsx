import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, TrendingDown, ClipboardList, BookOpen, CreditCard } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readBoolean, readString } from "@/components/dashboard/dashboardDataUtils";

export function AssistantAccountantDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["assistant-accountant-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          draftInvoices: 0,
          pendingInvoices: 0,
          recentExpenses: 0,
          totalExpenses: 0,
          unpaidBills: 0,
          unpaidBillsAmount: 0,
          unpostedJournals: 0,
          totalCustomers: 0,
          totalVendors: 0,
        };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = today.toISOString().slice(0, 10);

      const [liveMetrics, expenseReport, { invoices, bills, journalEntries, customers, vendors }] = await Promise.all([
        accountingService.getDashboardLiveMetrics({ companyId }),
        accountingService.getExpenseReport({
          companyId,
          startDate: monthStart,
          endDate: monthEnd,
        }),
        dashboardService.runQueries(user.id, {
          invoices: { collectionName: COLLECTIONS.INVOICES },
          bills: { collectionName: COLLECTIONS.BILLS },
          journalEntries: { collectionName: COLLECTIONS.JOURNAL_ENTRIES },
          customers: { collectionName: COLLECTIONS.CUSTOMERS },
          vendors: { collectionName: COLLECTIONS.VENDORS },
        }),
      ]);

      const isInvoicePending = (status: string) => {
        const normalized = status.toLowerCase();
        return ["sent", "unpaid", "partially paid", "overdue", "pending"].includes(normalized);
      };

      return {
        draftInvoices: invoices.filter((i) => readString(i, ["status"]).toLowerCase() === "draft").length,
        pendingInvoices: invoices.filter((i) => isInvoicePending(readString(i, ["status"]))).length,
        recentExpenses: expenseReport.rows.length,
        totalExpenses: liveMetrics.monthlyExpenses,
        unpaidBills: bills.filter((b) => readString(b, ["status"]).toLowerCase() !== "paid").length,
        unpaidBillsAmount: liveMetrics.outstandingAccountsPayable,
        unpostedJournals: journalEntries.filter((j) => !readBoolean(j, ["isPosted", "is_posted"])).length,
        totalCustomers: customers.length,
        totalVendors: vendors.length,
      };
    },
  });

  const metrics = [
    { title: "Draft Invoices", value: stats?.draftInvoices || 0, subtitle: `${stats?.pendingInvoices || 0} pending`, icon: FileText },
    { title: "Unpaid Bills", value: stats?.unpaidBills || 0, subtitle: formatZMW(stats?.unpaidBillsAmount || 0), icon: Receipt },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), subtitle: `${stats?.recentExpenses || 0} records`, icon: TrendingDown },
    { title: "Unposted Journals", value: stats?.unpostedJournals || 0, subtitle: "Awaiting review", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assistant Accountant Dashboard</h1>
        <p className="text-muted-foreground">Data entry tasks and bookkeeping overview</p>
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
              <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Daily Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Record new expenses</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.recentExpenses || 0} total</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Process draft invoices</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.draftInvoices || 0} drafts</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Review unposted journals</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.unpostedJournals || 0} unposted</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Process vendor bills</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.unpaidBills || 0} unpaid</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customers</span>
              <span className="font-medium">{stats?.totalCustomers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Vendors</span>
              <span className="font-medium">{stats?.totalVendors || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
