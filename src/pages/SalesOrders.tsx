import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  addDoc,
  collection,
  documentId,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface CustomerOption {
  id: string;
  name: string;
}

interface SalesOrderRecord {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerId: string | null;
  customerName: string;
  orderType: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  status: string;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const toDateString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString();
    }
  }
  return "";
};

export default function SalesOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: settings } = useCompanySettings();

  const [formData, setFormData] = useState({
    customer_id: "",
    order_type: "sale",
    notes: "",
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-orders", user?.id],
    queryFn: async () => {
      if (!user) return [] as SalesOrderRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as SalesOrderRecord[];

      const salesOrdersRef = collection(firestore, COLLECTIONS.SALES_ORDERS);
      const ordersSnapshot = await getDocs(
        query(salesOrdersRef, where("companyId", "==", membership.companyId)),
      );

      const mappedOrders = ordersSnapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          orderNumber: String(row.orderNumber ?? row.order_number ?? ""),
          orderDate: toDateString(row.orderDate ?? row.order_date),
          customerId: (row.customerId ?? row.customer_id ?? null) as string | null,
          customerName: "-",
          orderType: String(row.orderType ?? row.order_type ?? "sale"),
          subtotal: Number(row.subtotal ?? 0),
          vatAmount: Number(row.vatAmount ?? row.vat_amount ?? 0),
          total: Number(row.total ?? 0),
          status: String(row.status ?? "pending"),
        } satisfies SalesOrderRecord;
      });

      const customerIds = Array.from(
        new Set(mappedOrders.map((order) => order.customerId).filter(Boolean)),
      ) as string[];

      const customerMap = new Map<string, string>();
      if (customerIds.length > 0) {
        const customersRef = collection(firestore, COLLECTIONS.CUSTOMERS);
        const customerChunks = chunk(customerIds, 30);

        const customerSnapshots = await Promise.all(
          customerChunks.map((ids) =>
            getDocs(query(customersRef, where(documentId(), "in", ids))),
          ),
        );

        customerSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            customerMap.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return mappedOrders
        .map((order) => ({
          ...order,
          customerName: (order.customerId && customerMap.get(order.customerId)) || "-",
        }))
        .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
    },
    enabled: Boolean(user),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      if (!user) return [] as CustomerOption[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as CustomerOption[];

      const customersRef = collection(firestore, COLLECTIONS.CUSTOMERS);
      const customersSnapshot = await getDocs(
        query(customersRef, where("companyId", "==", membership.companyId)),
      );

      return customersSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
          } satisfies CustomerOption;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(user),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error("You must be logged in");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) {
        throw new Error("No company profile found for your account");
      }

      const orderNumber = `SO-${Date.now()}`;
      await addDoc(collection(firestore, COLLECTIONS.SALES_ORDERS), {
        companyId: membership.companyId,
        userId: user.id,
        customerId: data.customer_id || null,
        orderType: data.order_type,
        notes: data.notes || null,
        orderNumber,
        orderDate: new Date().toISOString().slice(0, 10),
        subtotal: 0,
        vatAmount: 0,
        total: 0,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders", user?.id] });
      toast.success("Sales order created successfully");
      setIsDialogOpen(false);
      setFormData({ customer_id: "", order_type: "sale", notes: "" });
    },
    onError: (error) => {
      toast.error("Failed to create order: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
      case "accepted":
        return "default" as const;
      case "pending":
      case "draft":
        return "secondary" as const;
      case "cancelled":
      case "rejected":
        return "destructive" as const;
      default:
        return "outline" as const;
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
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales & Orders</h1>
          <p className="text-muted-foreground">
            Manage sales transactions and orders
            {settings?.isVatRegistered && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                VAT Registered (16%)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/quotations/new")}>
            <ClipboardList className="mr-2 h-4 w-4" />
            New Quotation
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sales Order</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(formData);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Order Type</Label>
                  <Select
                    value={formData.order_type}
                    onValueChange={(value) => setFormData({ ...formData, order_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="estimate">Estimate</SelectItem>
                      <SelectItem value="quote">Quote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Order</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
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
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                {settings?.isVatRegistered && <TableHead className="text-right">VAT</TableHead>}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.orderDate ? format(new Date(order.orderDate), "dd MMM yyyy") : "-"}</TableCell>
                  <TableCell>{order.customerName || "-"}</TableCell>
                  <TableCell className="capitalize">{order.orderType}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                  {settings?.isVatRegistered && (
                    <TableCell className="text-right">{formatCurrency(order.vatAmount)}</TableCell>
                  )}
                  <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status || "pending")}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/invoices/new?order=${order.id}`)}
                      title="Convert to Invoice"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={settings?.isVatRegistered ? 9 : 8}
                    className="text-center text-muted-foreground"
                  >
                    No orders found
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
