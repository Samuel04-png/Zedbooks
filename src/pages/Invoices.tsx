import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, customers (name)`)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "overdue": return "destructive";
      case "draft": return "outline";
      default: return "secondary";
    }
  };

  const filteredInvoices = invoices?.filter(
    (inv) =>
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customers as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
        </div>
        <Link to="/invoices/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Invoices</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices?.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{(invoice.customers as any)?.name || "-"}</TableCell>
                  <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}</TableCell>
                  <TableCell className="text-right font-medium">ZMW {Number(invoice.total).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status || "draft")}>{invoice.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredInvoices?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No invoices found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
