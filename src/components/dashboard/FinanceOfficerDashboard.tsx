import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, TrendingDown, Receipt, CreditCard, AlertTriangle } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function FinanceOfficerDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["finance-officer-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          paidInvoices: 0,
          pendingInvoices: 0,
          overdueInvoices: 0,
          totalExpenses: 0,
          pendingExpenses: 0,
          unpaidBills: 0,
          overdueBills: 0,
          cashBalance: 0,
        };
      }

      const { invoices, expenses, bills, bankAccounts } = await dashboardService.runQueries(user.id, {
        invoices: { collectionName: COLLECTIONS.INVOICES },
        expenses: { collectionName: COLLECTIONS.EXPENSES },
        bills: { collectionName: COLLECTIONS.BILLS },
        bankAccounts: { collectionName: COLLECTIONS.BANK_ACCOUNTS },
      });

      const today = new Date().toISOString().split("T")[0];

      return {
        paidInvoices: invoices
          .filter((i) => readString(i, ["status"]) === "paid")
          .reduce((sum, i) => sum + readNumber(i, ["total", "amount"]), 0),
        pendingInvoices: invoices.filter((i) => readString(i, ["status"]) === "pending").length,
        overdueInvoices: invoices.filter((i) => {
          const dueDate = readString(i, ["dueDate", "due_date"]);
          return readString(i, ["status"]) !== "paid" && Boolean(dueDate) && dueDate < today;
        }).length,
        totalExpenses: expenses.reduce((sum, e) => sum + readNumber(e, ["amount", "total"]), 0),
        pendingExpenses: expenses.filter((e) => readString(e, ["approvalStatus", "approval_status"]) === "pending").length,
        unpaidBills: bills
          .filter((b) => readString(b, ["status"]) !== "paid")
          .reduce((sum, b) => sum + readNumber(b, ["total", "amount"]), 0),
        overdueBills: bills.filter((b) => {
          const dueDate = readString(b, ["dueDate", "due_date"]);
          return readString(b, ["status"]) !== "paid" && Boolean(dueDate) && dueDate < today;
        }).length,
        cashBalance: bankAccounts.reduce((sum, a) => sum + readNumber(a, ["currentBalance", "current_balance"]), 0),
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
