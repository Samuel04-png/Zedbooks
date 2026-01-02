import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function InventoryDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["inventory-dashboard-stats"],
    queryFn: async () => {
      const [items, movements] = await Promise.all([
        supabase.from("inventory_items").select("*"),
        supabase.from("stock_movements").select("quantity, movement_type").order("created_at", { ascending: false }).limit(100),
      ]);

      const inventoryItems = items.data || [];
      const lowStockItems = inventoryItems.filter(i => (i.quantity_on_hand || 0) <= (i.reorder_point || 0));
      const totalValue = inventoryItems.reduce((s, i) => s + ((i.quantity_on_hand || 0) * (i.unit_cost || 0)), 0);

      return {
        totalItems: inventoryItems.length,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 5),
        totalValue,
        categories: [...new Set(inventoryItems.map(i => i.category).filter(Boolean))].length,
        recentMovements: movements.data?.length || 0,
        inMovements: movements.data?.filter(m => m.movement_type === 'in').reduce((s, m) => s + (m.quantity || 0), 0) || 0,
        outMovements: movements.data?.filter(m => m.movement_type === 'out').reduce((s, m) => s + (m.quantity || 0), 0) || 0,
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
              {stats?.lowStockItems?.map((item: { name: string; quantity_on_hand: number; reorder_point: number }) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium text-destructive">
                    {item.quantity_on_hand || 0} / {item.reorder_point || 0}
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
