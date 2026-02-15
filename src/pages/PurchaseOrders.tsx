import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  vat_amount: number | null;
  total: number;
  status: string | null;
  description: string | null;
  vendor_id: string | null;
  vendors: { name: string } | null;
}

interface Vendor {
  id: string;
  name: string;
}

export default function PurchaseOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: settings } = useCompanySettings();

  const [formData, setFormData] = useState({
    vendor_id: "",
    order_number: `PO-${Date.now()}`,
    order_date: new Date().toISOString().split("T")[0],
    expected_date: "",
    amount: "",
    description: "",
  });

  const { data: companyId } = useQuery({
    queryKey: ["purchase-orders-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders", companyId],
    queryFn: async () => {
      if (!companyId) return [] as PurchaseOrder[];

      const ordersRef = collection(firestore, COLLECTIONS.PURCHASE_ORDERS);
      const ordersSnapshot = await getDocs(query(ordersRef, where("companyId", "==", companyId)));
      const ordersData = ordersSnapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          order_number: String(row.orderNumber ?? row.order_number ?? ""),
          order_date: String(row.orderDate ?? row.order_date ?? ""),
          expected_date: (row.expectedDate ?? row.expected_date ?? null) as string | null,
          subtotal: Number(row.subtotal ?? 0),
          vat_amount: Number(row.vatAmount ?? row.vat_amount ?? 0),
          total: Number(row.total ?? 0),
          status: (row.status ?? "pending") as string | null,
          description: (row.description ?? null) as string | null,
          vendor_id: (row.vendorId ?? row.vendor_id ?? null) as string | null,
          vendors: null,
        } satisfies PurchaseOrder;
      });

      const vendorIds = Array.from(new Set(ordersData.map((order) => order.vendor_id).filter(Boolean))) as string[];
      const vendorMap = new Map<string, string>();
      if (vendorIds.length > 0) {
        const vendorsRef = collection(firestore, COLLECTIONS.VENDORS);
        const vendorsSnapshot = await getDocs(query(vendorsRef, where("companyId", "==", companyId)));
        vendorsSnapshot.docs.forEach((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          vendorMap.set(docSnap.id, String(row.name ?? ""));
        });
      }

      return ordersData
        .map((order) => ({
          ...order,
          vendors: order.vendor_id ? { name: vendorMap.get(order.vendor_id) || "Unknown Vendor" } : null,
        }))
        .sort((a, b) => b.order_date.localeCompare(a.order_date));
    },
    enabled: Boolean(companyId),
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Vendor[];
      const vendorsRef = collection(firestore, COLLECTIONS.VENDORS);
      const snapshot = await getDocs(query(vendorsRef, where("companyId", "==", companyId)));
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
          } satisfies Vendor;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(companyId),
  });

  const isVatRegistered = settings?.isVatRegistered || false;
  const vatRate = settings?.vatRate || 16;

  const subtotal = parseFloat(formData.amount) || 0;
  const vatAmount = isVatRegistered ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId || !user) throw new Error("No active company context");
      await addDoc(collection(firestore, COLLECTIONS.PURCHASE_ORDERS), {
        companyId,
        vendorId: data.vendor_id,
        orderNumber: data.order_number,
        orderDate: data.order_date,
        expectedDate: data.expected_date || null,
        subtotal,
        vatAmount: vatAmount,
        total,
        status: "pending",
        description: data.description || null,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", companyId] });
      toast.success("Purchase order created successfully");
      setIsDialogOpen(false);
      setFormData({
        vendor_id: "",
        order_number: `PO-${Date.now()}`,
        order_date: new Date().toISOString().split("T")[0],
        expected_date: "",
        amount: "",
        description: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create purchase order: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(firestore, COLLECTIONS.PURCHASE_ORDERS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", companyId] });
      toast.success("Purchase order deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete purchase order: " + error.message);
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "received":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const filteredOrders = orders?.filter(
    (order) =>
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.vendors?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage purchase orders to vendors
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor *</Label>
                  <Select
                    value={formData.vendor_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, vendor_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors?.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_number">PO Number</Label>
                  <Input
                    id="order_number"
                    value={formData.order_number}
                    onChange={(e) =>
                      setFormData({ ...formData, order_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_date">Order Date *</Label>
                  <Input
                    id="order_date"
                    type="date"
                    value={formData.order_date}
                    onChange={(e) =>
                      setFormData({ ...formData, order_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected_date">Expected Delivery</Label>
                  <Input
                    id="expected_date"
                    type="date"
                    value={formData.expected_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (ZMW) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>
              {isVatRegistered && (
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT ({vatRate}%):</span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Order</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search purchase orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.order_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{order.vendors?.name || "-"}</TableCell>
                  <TableCell>
                    {order.expected_date
                      ? format(new Date(order.expected_date), "dd MMM yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(order.total))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status || "pending")}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/bills`)}
                        title="Convert to Bill"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(order.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No purchase orders found. Create your first PO!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
