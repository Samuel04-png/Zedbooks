import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileText, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { exportToCSV } from "@/utils/exportToExcel";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, documentId, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface BillRecord {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  total: number;
  status: string;
  vendor_id: string | null;
  vendors: { name: string } | null;
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
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString().slice(0, 10);
    }
  }
  return "";
};

export default function AccountsPayable() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: bills = [], isLoading, refetch } = useQuery({
    queryKey: ["accounts-payable", startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) return [] as BillRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as BillRecord[];

      const billsRef = collection(firestore, COLLECTIONS.BILLS);
      const billSnapshot = await getDocs(
        query(billsRef, where("companyId", "==", membership.companyId)),
      );

      const mappedBills = billSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            bill_number: String(row.billNumber ?? row.bill_number ?? ""),
            bill_date: toDateString(row.billDate ?? row.bill_date),
            due_date: toDateString(row.dueDate ?? row.due_date) || null,
            total: Number(row.total ?? 0),
            status: String(row.status ?? "pending"),
            vendor_id: (row.vendorId ?? row.vendor_id ?? null) as string | null,
            vendors: null,
          } satisfies BillRecord;
        })
        .filter((bill) => bill.bill_date >= startDate && bill.bill_date <= endDate);

      const vendorIds = Array.from(new Set(mappedBills.map((bill) => bill.vendor_id).filter(Boolean))) as string[];
      const vendorNameById = new Map<string, string>();

      if (vendorIds.length > 0) {
        const vendorsRef = collection(firestore, COLLECTIONS.VENDORS);
        const vendorChunks = chunk(vendorIds, 30);
        const snapshots = await Promise.all(
          vendorChunks.map((ids) => getDocs(query(vendorsRef, where(documentId(), "in", ids)))),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            vendorNameById.set(docSnap.id, String(row.name ?? "-"));
          });
        });
      }

      return mappedBills
        .map((bill) => ({
          ...bill,
          vendors: bill.vendor_id ? { name: vendorNameById.get(bill.vendor_id) || "-" } : null,
        }))
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
    },
    enabled: Boolean(user),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const unpaidBills = bills.filter((b) => b.status !== "paid");
  const overdueBills = unpaidBills.filter((b) => b.due_date && isPast(new Date(b.due_date)));
  const dueSoon = unpaidBills.filter((b) => {
    if (!b.due_date) return false;
    const days = differenceInDays(new Date(b.due_date), new Date());
    return days >= 0 && days <= 7;
  });
  const paidBills = bills.filter((b) => b.status === "paid");

  const totalOutstanding = unpaidBills.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalOverdue = overdueBills.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalPaid = paidBills.reduce((sum, b) => sum + (b.total || 0), 0);

  const exportReport = () => {
    const columns = [
      { header: "Bill Number", key: "bill_number" },
      { header: "Bill Date", key: "bill_date" },
      { header: "Due Date", key: "due_date" },
      { header: "Amount", key: "total" },
      { header: "Status", key: "status" },
    ];
    exportToCSV(bills as Record<string, unknown>[], columns, `accounts-payable-${startDate}-to-${endDate}`);
  };

  const importColumns = [
    { key: "bill_number", header: "Bill Number", required: true },
    { key: "vendor_name", header: "Vendor Name", required: false },
    { key: "bill_date", header: "Bill Date (YYYY-MM-DD)", required: true },
    { key: "due_date", header: "Due Date (YYYY-MM-DD)", required: false },
    { key: "amount", header: "Amount", required: true },
    { key: "description", header: "Description", required: false },
  ];

  const handleImport = async (data: Record<string, unknown>[]) => {
    if (!user) throw new Error("You must be logged in");

    const membership = await companyService.getPrimaryMembershipByUser(user.id);
    if (!membership?.companyId) throw new Error("No company profile found for your account");

    for (const row of data) {
      await addDoc(collection(firestore, COLLECTIONS.BILLS), {
        companyId: membership.companyId,
        userId: user.id,
        billNumber: String(row.bill_number || ""),
        billDate: String(row.bill_date || ""),
        dueDate: (row.due_date as string) || null,
        subtotal: Number(row.amount) || 0,
        total: Number(row.amount) || 0,
        description: (row.description as string) || null,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    refetch();
    toast.success("Bills imported successfully");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts Payable</h1>
          <p className="text-muted-foreground">Track and manage vendor bills and payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">{unpaidBills.length} bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">{overdueBills.length} bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{paidBills.length} bills</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aging Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Bills</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Current (not due)</TableCell>
                <TableCell className="text-right">
                  {unpaidBills.filter((b) => !b.due_date || differenceInDays(new Date(b.due_date), new Date()) > 7).length}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    unpaidBills
                      .filter((b) => !b.due_date || differenceInDays(new Date(b.due_date), new Date()) > 7)
                      .reduce((sum, b) => sum + (b.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Due within 7 days</TableCell>
                <TableCell className="text-right">{dueSoon.length}</TableCell>
                <TableCell className="text-right text-warning">
                  {formatCurrency(dueSoon.reduce((sum, b) => sum + (b.total || 0), 0))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>1-30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueBills.filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) <= 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {formatCurrency(
                    overdueBills
                      .filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) <= 30)
                      .reduce((sum, b) => sum + (b.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Over 30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueBills.filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) > 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive font-bold">
                  {formatCurrency(
                    overdueBills
                      .filter((b) => differenceInDays(new Date(), new Date(b.due_date || "")) > 30)
                      .reduce((sum, b) => sum + (b.total || 0), 0),
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Bill Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => {
                const daysOverdue =
                  bill.due_date && bill.status !== "paid"
                    ? Math.max(0, differenceInDays(new Date(), new Date(bill.due_date)))
                    : 0;
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.bill_number}</TableCell>
                    <TableCell>{bill.vendors?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(bill.bill_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{bill.due_date ? format(new Date(bill.due_date), "dd MMM yyyy") : "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(bill.total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          bill.status === "paid"
                            ? "default"
                            : daysOverdue > 0
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{bill.status === "paid" ? "-" : daysOverdue > 0 ? `${daysOverdue} days` : "Current"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        columns={importColumns}
        title="Import Bills"
      />
    </div>
  );
}
