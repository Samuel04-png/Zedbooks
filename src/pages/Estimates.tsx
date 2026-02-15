import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, deleteDoc, doc, documentId, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface EstimateRecord {
  id: string;
  orderNumber: string;
  orderDate: string;
  orderType: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  status: string;
  customerId: string | null;
  customerName: string;
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

export default function Estimates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: settings } = useCompanySettings();

  const { data: estimates, isLoading } = useQuery({
    queryKey: ["estimates", user?.id],
    queryFn: async () => {
      if (!user) return [] as EstimateRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as EstimateRecord[];

      const salesOrdersRef = collection(firestore, COLLECTIONS.SALES_ORDERS);
      const ordersSnapshot = await getDocs(
        query(salesOrdersRef, where("companyId", "==", membership.companyId)),
      );

      const mappedEstimates = ordersSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            orderNumber: String(row.orderNumber ?? row.order_number ?? ""),
            orderDate: toDateString(row.orderDate ?? row.order_date),
            orderType: String(row.orderType ?? row.order_type ?? "sale"),
            subtotal: Number(row.subtotal ?? 0),
            vatAmount: Number(row.vatAmount ?? row.vat_amount ?? 0),
            total: Number(row.total ?? 0),
            status: String(row.status ?? "draft"),
            customerId: (row.customerId ?? row.customer_id ?? null) as string | null,
            customerName: "-",
          } satisfies EstimateRecord;
        })
        .filter((order) => ["quote", "estimate"].includes(order.orderType));

      const customerIds = Array.from(
        new Set(mappedEstimates.map((estimate) => estimate.customerId).filter(Boolean)),
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

      return mappedEstimates
        .map((estimate) => ({
          ...estimate,
          customerName: (estimate.customerId && customerMap.get(estimate.customerId)) || "-",
        }))
        .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
    },
    enabled: Boolean(user),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(firestore, COLLECTIONS.SALES_ORDERS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates", user?.id] });
      toast.success("Estimate deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete estimate: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "sent":
      case "accepted":
        return "default" as const;
      case "draft":
        return "secondary" as const;
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

  const filteredEstimates = estimates?.filter(
    (estimate) =>
      estimate.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      estimate.customerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estimates & Quotations</h1>
          <p className="text-muted-foreground">Create and manage quotes for your customers</p>
        </div>
        <Button onClick={() => navigate("/quotations/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Quotation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search estimates..."
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
                <TableHead>Quote #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                {settings?.isVatRegistered && <TableHead className="text-right">VAT</TableHead>}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEstimates?.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell className="font-medium">{estimate.orderNumber}</TableCell>
                  <TableCell>{estimate.orderDate ? format(new Date(estimate.orderDate), "dd MMM yyyy") : "-"}</TableCell>
                  <TableCell>{estimate.customerName || "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(estimate.subtotal)}</TableCell>
                  {settings?.isVatRegistered && (
                    <TableCell className="text-right">{formatCurrency(estimate.vatAmount)}</TableCell>
                  )}
                  <TableCell className="text-right">{formatCurrency(estimate.total)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(estimate.status || "draft")}>{estimate.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/invoices/new?customer=${estimate.customerId}`)}
                        title="Convert to Invoice"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(estimate.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEstimates?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={settings?.isVatRegistered ? 8 : 7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No estimates found. Create your first quotation!
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
