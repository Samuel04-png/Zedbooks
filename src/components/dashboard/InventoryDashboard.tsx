import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { readNumber, readString } from "@/components/dashboard/dashboardDataUtils";

export function InventoryDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["inventory-dashboard-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          totalItems: 0,
          lowStockCount: 0,
          lowStockItems: [] as Array<Record<string, unknown>>,
          totalValue: 0,
          categories: 0,
          recentMovements: 0,
          inMovements: 0,
          outMovements: 0,
        };
      }

      const { items, movements } = await dashboardService.runQueries(user.id, {
        items: { collectionName: COLLECTIONS.INVENTORY_ITEMS },
        movements: {
          collectionName: COLLECTIONS.STOCK_MOVEMENTS,
          orderByField: "createdAt",
          orderDirection: "desc",
          limitCount: 100,
        },
      });

      const lowStockItems = items.filter((item) => {
        const qty = readNumber(item, ["quantityOnHand", "quantity_on_hand"]);
        const reorder = readNumber(item, ["reorderPoint", "reorder_point"]);
        return qty <= reorder;
      });

      const totalValue = items.reduce((sum, item) => {
        const qty = readNumber(item, ["quantityOnHand", "quantity_on_hand"]);
        const cost = readNumber(item, ["unitCost", "unit_cost"]);
        return sum + qty * cost;
      }, 0);

      const categoryCount = new Set(
        items.map((item) => readString(item, ["category"])).filter((category) => Boolean(category)),
      ).size;

      return {
        totalItems: items.length,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 5),
        totalValue,
        categories: categoryCount,
        recentMovements: movements.length,
        inMovements: movements
          .filter((movement) => readString(movement, ["movementType", "movement_type"]) === "in")
          .reduce((sum, movement) => sum + readNumber(movement, ["quantity"]), 0),
        outMovements: movements
          .filter((movement) => readString(movement, ["movementType", "movement_type"]) === "out")
          .reduce((sum, movement) => sum + readNumber(movement, ["quantity"]), 0),
      };
    },
  });

  const metrics = [
    { title: "Total Items", value: stats?.totalItems || 0, icon: Package, color: "text-blue-500" },
    { title: "Low Stock Alerts", value: stats?.lowStockCount || 0, icon: AlertTriangle, color: "text-red-500" },
    { title: "Total Value", value: formatZMW(stats?.totalValue || 0), icon: DollarSign, color: "text-green-500" },
    { title: "Categories", value: stats?.categories || 0, icon: TrendingUp, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
        <p className="text-muted-foreground">Stock levels and inventory management overview</p>
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
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.lowStockItems?.map((item: Record<string, unknown>) => (
                <div key={readString(item, ["id", "name"], "inventory-item")} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{readString(item, ["name"], "Unnamed Item")}</span>
                  <span className="font-medium text-destructive">
                    {readNumber(item, ["quantityOnHand", "quantity_on_hand"])} / {readNumber(item, ["reorderPoint", "reorder_point"])}
                  </span>
                </div>
              ))}
              {(!stats?.lowStockItems || stats.lowStockItems.length === 0) && (
                <p className="text-muted-foreground text-sm">No low stock alerts</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items Received</span>
              <span className="font-medium text-green-600">+{stats?.inMovements || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items Issued</span>
              <span className="font-medium text-red-600">-{stats?.outMovements || 0}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="text-muted-foreground">Recent Movements</span>
              <span className="font-medium">{stats?.recentMovements || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
