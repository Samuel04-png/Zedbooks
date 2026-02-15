import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
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

export default function Bills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: settings } = useCompanySettings();

  const [formData, setFormData] = useState({
    vendor_id: "",
    bill_number: `BILL-${Date.now()}`,
    bill_date: new Date().toISOString().split("T")[0],
    due_date: "",
    amount: "",
    description: "",
  });

  const { data: companyId } = useQuery({
    queryKey: ["bills-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Bill[];
      const [billsSnapshot, vendorsSnapshot] = await Promise.all([
        getDocs(query(collection(firestore, COLLECTIONS.BILLS), where("companyId", "==", companyId))),
        getDocs(query(collection(firestore, COLLECTIONS.VENDORS), where("companyId", "==", companyId))),
      ]);

      const vendorMap = new Map<string, string>();
      vendorsSnapshot.docs.forEach((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        vendorMap.set(docSnap.id, String(row.name ?? ""));
      });

      return billsSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const vendorId = (row.vendorId ?? row.vendor_id ?? null) as string | null;
          return {
            id: docSnap.id,
            bill_number: String(row.billNumber ?? row.bill_number ?? ""),
            bill_date: String(row.billDate ?? row.bill_date ?? ""),
            due_date: (row.dueDate ?? row.due_date ?? null) as string | null,
            subtotal: Number(row.subtotal ?? 0),
            vat_amount: Number(row.vatAmount ?? row.vat_amount ?? 0),
            total: Number(row.total ?? 0),
            status: (row.status ?? "pending") as string | null,
            description: (row.description ?? null) as string | null,
            vendor_id: vendorId,
            vendors: vendorId ? { name: vendorMap.get(vendorId) || "Unknown Vendor" } : null,
          } satisfies Bill;
        })
        .sort((a, b) => b.bill_date.localeCompare(a.bill_date));
    },
    enabled: Boolean(companyId),
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Vendor[];
      const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.VENDORS), where("companyId", "==", companyId)));
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return { id: docSnap.id, name: String(row.name ?? "") } satisfies Vendor;
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
      if (!companyId || !user) throw new Error("Not authenticated");

      await addDoc(collection(firestore, COLLECTIONS.BILLS), {
        companyId,
        vendorId: data.vendor_id || null,
        billNumber: data.bill_number,
        billDate: data.bill_date,
        dueDate: data.due_date || null,
        description: data.description || null,
        subtotal,
        vatAmount,
        total,
        status: "pending",
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills", companyId] });
      toast.success("Bill created successfully");
      setIsDialogOpen(false);
      setFormData({
        vendor_id: "",
        bill_number: `BILL-${Date.now()}`,
        bill_date: new Date().toISOString().split("T")[0],
        due_date: "",
        amount: "",
        description: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create bill: " + error.message);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      await setDoc(doc(firestore, COLLECTIONS.BILLS, id), {
        status: "paid",
        paidDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills", companyId] });
      toast.success("Bill marked as paid");
    },
    onError: (error) => {
      toast.error("Failed to update bill: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(firestore, COLLECTIONS.BILLS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills", companyId] });
      toast.success("Bill deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete bill: " + error.message);
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "overdue":
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

  const filteredBills = bills?.filter(
    (bill) =>
      bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.vendors?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bills</h1>
          <p className="text-muted-foreground">
            Manage bills and payments to vendors
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Bill</DialogTitle>
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
                  <Label htmlFor="bill_number">Bill Number</Label>
                  <Input
                    id="bill_number"
                    value={formData.bill_number}
                    onChange={(e) =>
                      setFormData({ ...formData, bill_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bill_date">Bill Date *</Label>
                  <Input
                    id="bill_date"
                    type="date"
                    value={formData.bill_date}
                    onChange={(e) =>
                      setFormData({ ...formData, bill_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
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
                <Button type="submit">Create Bill</Button>
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
                placeholder="Search bills..."
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
                <TableHead>Bill #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills?.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">
                    {bill.bill_number}
                  </TableCell>
                  <TableCell>
                    {format(new Date(bill.bill_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{bill.vendors?.name || "-"}</TableCell>
                  <TableCell>
                    {bill.due_date
                      ? format(new Date(bill.due_date), "dd MMM yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(bill.total))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(bill.status || "pending")}>
                      {bill.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {bill.status !== "paid" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markPaidMutation.mutate(bill.id)}
                          title="Mark as Paid"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(bill.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredBills?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No bills found. Create your first bill!
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
