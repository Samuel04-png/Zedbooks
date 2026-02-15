import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Package, AlertTriangle, ArrowUpDown } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unit_of_measure: string | null;
  quantity_on_hand: number;
  reorder_point: number;
  unit_cost: number;
  selling_price: number;
}

const Inventory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    unit_of_measure: "units",
    quantity_on_hand: 0,
    reorder_point: 0,
    unit_cost: 0,
    selling_price: 0,
  });
  const [movement, setMovement] = useState({
    movement_type: "in",
    quantity: 0,
    reference_number: "",
    notes: "",
  });

  const { data: companyId } = useQuery({
    queryKey: ["inventory-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["inventory-items", companyId],
    queryFn: async () => {
      if (!companyId) return [] as InventoryItem[];

      const ref = collection(firestore, COLLECTIONS.INVENTORY_ITEMS);
      const snapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
            sku: (row.sku ?? null) as string | null,
            category: (row.category ?? null) as string | null,
            description: (row.description ?? null) as string | null,
            unit_of_measure: (row.unitOfMeasure ?? row.unit_of_measure ?? "units") as string | null,
            quantity_on_hand: Number(row.quantityOnHand ?? row.quantity_on_hand ?? 0),
            reorder_point: Number(row.reorderPoint ?? row.reorder_point ?? 0),
            unit_cost: Number(row.unitCost ?? row.unit_cost ?? 0),
            selling_price: Number(row.sellingPrice ?? row.selling_price ?? 0),
          } satisfies InventoryItem;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(companyId),
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      if (!companyId || !user) throw new Error("No active company context");

      await addDoc(collection(firestore, COLLECTIONS.INVENTORY_ITEMS), {
        companyId,
        name: item.name,
        sku: item.sku || null,
        category: item.category || null,
        description: item.description || null,
        unitOfMeasure: item.unit_of_measure || "units",
        quantityOnHand: item.quantity_on_hand,
        reorderPoint: item.reorder_point,
        unitCost: item.unit_cost,
        sellingPrice: item.selling_price,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", companyId] });
      toast.success("Item added successfully");
      setIsAddDialogOpen(false);
      setNewItem({
        name: "",
        sku: "",
        category: "",
        description: "",
        unit_of_measure: "units",
        quantity_on_hand: 0,
        reorder_point: 0,
        unit_cost: 0,
        selling_price: 0,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const stockMovementMutation = useMutation({
    mutationFn: async ({ itemId, movementData }: { itemId: string; movementData: { movement_type: string; quantity: number; reference_number: string; notes: string } }) => {
      if (!companyId || !user) throw new Error("No active company context");

      const item = inventoryItems.find(i => i.id === itemId);
      if (!item) throw new Error("Item not found");

      let newQuantity = item.quantity_on_hand;
      if (movementData.movement_type === "in") {
        newQuantity += movementData.quantity;
      } else if (movementData.movement_type === "out") {
        newQuantity -= movementData.quantity;
      } else {
        newQuantity = movementData.quantity;
      }

      const batch = writeBatch(firestore);
      const movementRef = doc(collection(firestore, COLLECTIONS.STOCK_MOVEMENTS));
      const itemRef = doc(firestore, COLLECTIONS.INVENTORY_ITEMS, itemId);

      batch.set(movementRef, {
        companyId,
        inventoryItemId: itemId,
        movementType: movementData.movement_type,
        quantity: movementData.quantity,
        referenceNumber: movementData.reference_number || null,
        notes: movementData.notes || null,
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });

      batch.update(itemRef, {
        quantityOnHand: newQuantity,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", companyId] });
      toast.success("Stock movement recorded");
      setIsMovementDialogOpen(false);
      setSelectedItem(null);
      setMovement({ movement_type: "in", quantity: 0, reference_number: "", notes: "" });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = inventoryItems.filter(
    (item) => item.quantity_on_hand <= item.reorder_point
  );

  const totalValue = inventoryItems.reduce(
    (sum, item) => sum + item.quantity_on_hand * item.unit_cost,
    0
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const categories = ["Raw Materials", "Finished Goods", "Supplies", "Equipment", "Other"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage your stock and inventory items</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name *</Label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={newItem.sku}
                  onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                  placeholder="Stock Keeping Unit"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Select
                  value={newItem.unit_of_measure}
                  onValueChange={(value) => setNewItem({ ...newItem, unit_of_measure: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="units">Units</SelectItem>
                    <SelectItem value="kg">Kilograms</SelectItem>
                    <SelectItem value="liters">Liters</SelectItem>
                    <SelectItem value="meters">Meters</SelectItem>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Quantity</Label>
                <Input
                  type="number"
                  value={newItem.quantity_on_hand}
                  onChange={(e) => setNewItem({ ...newItem, quantity_on_hand: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Point</Label>
                <Input
                  type="number"
                  value={newItem.reorder_point}
                  onChange={(e) => setNewItem({ ...newItem, reorder_point: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost (ZMW)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.unit_cost}
                  onChange={(e) => setNewItem({ ...newItem, unit_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (ZMW)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.selling_price}
                  onChange={(e) => setNewItem({ ...newItem, selling_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Item description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.name}>
                Add Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(inventoryItems.map(i => i.category).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Items</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading inventory...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No inventory items found. Add your first item to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty on Hand</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku || "-"}</TableCell>
                    <TableCell>{item.category || "-"}</TableCell>
                    <TableCell className="text-right">{item.quantity_on_hand} {item.unit_of_measure}</TableCell>
                    <TableCell className="text-right">{item.reorder_point}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.quantity_on_hand * item.unit_cost)}</TableCell>
                    <TableCell>
                      {item.quantity_on_hand <= item.reorder_point ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="secondary">In Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setIsMovementDialogOpen(true);
                        }}
                      >
                        <ArrowUpDown className="h-4 w-4 mr-1" />
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock Movement - {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Movement Type</Label>
              <Select
                value={movement.movement_type}
                onValueChange={(value) => setMovement({ ...movement, movement_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In (Add)</SelectItem>
                  <SelectItem value="out">Stock Out (Remove)</SelectItem>
                  <SelectItem value="adjustment">Adjustment (Set)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={movement.quantity}
                onChange={(e) => setMovement({ ...movement, quantity: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={movement.reference_number}
                onChange={(e) => setMovement({ ...movement, reference_number: e.target.value })}
                placeholder="PO#, Invoice#, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={movement.notes}
                onChange={(e) => setMovement({ ...movement, notes: e.target.value })}
                placeholder="Reason for adjustment"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedItem && stockMovementMutation.mutate({ itemId: selectedItem.id, movementData: movement })}
              disabled={movement.quantity <= 0}
            >
              Record Movement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
