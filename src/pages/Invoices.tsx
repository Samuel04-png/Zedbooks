import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  customerId: string | null;
  customerName: string;
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

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      if (!user) return [] as InvoiceRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as InvoiceRecord[];

      const invoicesRef = collection(firestore, COLLECTIONS.INVOICES);
      const invoiceSnapshot = await getDocs(
        query(invoicesRef, where("companyId", "==", membership.companyId)),
      );

      const invoicesWithoutCustomer = invoiceSnapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;

        return {
          id: docSnap.id,
          invoiceNumber: String(row.invoiceNumber ?? row.invoice_number ?? ""),
          invoiceDate: toDateString(row.invoiceDate ?? row.invoice_date),
          dueDate: toDateString(row.dueDate ?? row.due_date) || null,
          customerId: (row.customerId ?? row.customer_id ?? null) as string | null,
          customerName: "-",
          total: Number(row.total ?? 0),
          status: String(row.status ?? "draft"),
        } satisfies InvoiceRecord;
      });

      const customerIds = Array.from(
        new Set(invoicesWithoutCustomer.map((invoice) => invoice.customerId).filter(Boolean)),
      ) as string[];

      const customerMap = new Map<string, string>();
      if (customerIds.length > 0) {
        const customersRef = collection(firestore, COLLECTIONS.CUSTOMERS);
        const customerChunks = chunk(customerIds, 30);

        const customerSnapshots = await Promise.all(
          customerChunks.map((ids) => getDocs(query(customersRef, where(documentId(), "in", ids)))),
        );

        customerSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            customerMap.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return invoicesWithoutCustomer
        .map((invoice) => ({
          ...invoice,
          customerName: (invoice.customerId && customerMap.get(invoice.customerId)) || "-",
        }))
        .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
    },
    enabled: Boolean(user),
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default" as const;
      case "sent":
        return "secondary" as const;
      case "overdue":
        return "destructive" as const;
      case "draft":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  const filteredInvoices = invoices?.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase()),
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
            {!isMobile && (
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            )}
          </div>
          {isMobile && (
            <div className="relative mt-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isMobile ? (
            /* Mobile Card View */
            <div className="space-y-4">
              {filteredInvoices?.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 space-y-3 bg-card shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
                      <p className="text-sm text-muted-foreground">{invoice.customerName || "-"}</p>
                    </div>
                    <Badge variant={getStatusVariant(invoice.status || "draft")}>{invoice.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p>{invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM yyyy") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p>{invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "-"}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                    <span className="text-lg font-bold text-primary">ZMW {invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {filteredInvoices?.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  No invoices found
                </div>
              )}
            </div>
          ) : (
            /* Desktop Table View */
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
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>
                      {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell>{invoice.customerName || "-"}</TableCell>
                    <TableCell>
                      {invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">ZMW {invoice.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invoice.status || "draft")}>{invoice.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredInvoices?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
