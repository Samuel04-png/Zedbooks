import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export default function Estimates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: settings } = useCompanySettings();

  const { data: estimates, isLoading } = useQuery({
    queryKey: ["estimates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          customers (name)
        `)
        .in("order_type", ["quote", "estimate"])
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete estimate: " + error.message);
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "sent":
        return "default";
      case "accepted":
        return "default";
      case "draft":
        return "secondary";
      case "rejected":
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

  const filteredEstimates = estimates?.filter(
    (estimate) =>
      estimate.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (estimate.customers as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estimates & Quotations</h1>
          <p className="text-muted-foreground">
            Create and manage quotes for your customers
          </p>
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
                {settings?.is_vat_registered && (
                  <TableHead className="text-right">VAT</TableHead>
                )}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEstimates?.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell className="font-medium">
                    {estimate.order_number}
                  </TableCell>
                  <TableCell>
                    {format(new Date(estimate.order_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{(estimate.customers as any)?.name || "-"}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(estimate.subtotal))}
                  </TableCell>
                  {settings?.is_vat_registered && (
                    <TableCell className="text-right">
                      {formatCurrency(Number(estimate.vat_amount))}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {formatCurrency(Number(estimate.total))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(estimate.status || "draft")}>
                      {estimate.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          navigate(`/invoices/new?customer=${estimate.customer_id}`)
                        }
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
                    colSpan={settings?.is_vat_registered ? 8 : 7}
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
