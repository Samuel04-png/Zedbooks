import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users, Eye } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";

export function ReadOnlyDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["readonly-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return { totalRevenue: 0, totalExpenses: 0, invoiceCount: 0 };
      }

      const companyId = await dashboardService.getCompanyIdForUser(user.id);
      const [liveMetrics, { invoices }] = await Promise.all([
        accountingService.getDashboardLiveMetrics({ companyId }),
        dashboardService.runQueries(user.id, {
        invoices: { collectionName: COLLECTIONS.INVOICES },
      }),
      ]);

      return {
        totalRevenue: liveMetrics.monthlyIncome,
        totalExpenses: liveMetrics.monthlyExpenses,
        invoiceCount: invoices.length,
      };
    },
  });

  const netIncome = (stats?.totalRevenue || 0) - (stats?.totalExpenses || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground flex items-center gap-1">
          <Eye className="h-4 w-4" /> View-only access
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(stats?.totalRevenue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZMW(stats?.totalExpenses || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {formatZMW(netIncome)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.invoiceCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Read-Only Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You have view-only access to this system. Contact your administrator to request additional permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
