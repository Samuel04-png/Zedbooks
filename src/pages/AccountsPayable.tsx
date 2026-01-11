import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export default function AccountsPayable() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: bills = [], isLoading, refetch } = useQuery({
    queryKey: ["accounts-payable", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          vendors (name)
        `)
        .gte("bill_date", startDate)
        .lte("bill_date", endDate)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  // Categorize bills
  const unpaidBills = bills.filter((b: any) => b.status !== "paid");
  const overdueBills = unpaidBills.filter((b: any) => b.due_date && isPast(new Date(b.due_date)));
  const dueSoon = unpaidBills.filter((b: any) => {
    if (!b.due_date) return false;
    const days = differenceInDays(new Date(b.due_date), new Date());
    return days >= 0 && days <= 7;
  });
  const paidBills = bills.filter((b: any) => b.status === "paid");

  const totalOutstanding = unpaidBills.reduce((sum: number, b: any) => sum + (b.total || 0), 0);
  const totalOverdue = overdueBills.reduce((sum: number, b: any) => sum + (b.total || 0), 0);
  const totalPaid = paidBills.reduce((sum: number, b: any) => sum + (b.total || 0), 0);

  const exportReport = () => {
    const columns = [
      { header: "Bill Number", key: "bill_number" },
      { header: "Bill Date", key: "bill_date" },
      { header: "Due Date", key: "due_date" },
      { header: "Amount", key: "total" },
      { header: "Status", key: "status" }
    ];
    exportToCSV(bills as any, columns, `accounts-payable-${startDate}-to-${endDate}`);
  };

  const importColumns = [
    { key: "bill_number", header: "Bill Number", required: true },
    { key: "vendor_name", header: "Vendor Name", required: false },
    { key: "bill_date", header: "Bill Date (YYYY-MM-DD)", required: true },
    { key: "due_date", header: "Due Date (YYYY-MM-DD)", required: false },
    { key: "amount", header: "Amount", required: true },
    { key: "description", header: "Description", required: false }
  ];

  const handleImport = async (data: any[]) => {
    for (const row of data) {
      const { error } = await supabase.from("bills").insert({
        bill_number: row.bill_number,
        bill_date: row.bill_date,
        due_date: row.due_date || null,
        subtotal: parseFloat(row.amount) || 0,
        total: parseFloat(row.amount) || 0,
        description: row.description || null,
        status: "pending",
        user_id: user?.id,
      });
      if (error) throw error;
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
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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

      {/* Aging Summary */}
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
                  {unpaidBills.filter((b: any) => !b.due_date || differenceInDays(new Date(b.due_date), new Date()) > 7).length}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    unpaidBills
                      .filter((b: any) => !b.due_date || differenceInDays(new Date(b.due_date), new Date()) > 7)
                      .reduce((sum: number, b: any) => sum + (b.total || 0), 0)
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Due within 7 days</TableCell>
                <TableCell className="text-right">{dueSoon.length}</TableCell>
                <TableCell className="text-right text-warning">
                  {formatCurrency(dueSoon.reduce((sum: number, b: any) => sum + (b.total || 0), 0))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>1-30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueBills.filter((b: any) => differenceInDays(new Date(), new Date(b.due_date)) <= 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {formatCurrency(
                    overdueBills
                      .filter((b: any) => differenceInDays(new Date(), new Date(b.due_date)) <= 30)
                      .reduce((sum: number, b: any) => sum + (b.total || 0), 0)
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Over 30 days overdue</TableCell>
                <TableCell className="text-right">
                  {overdueBills.filter((b: any) => differenceInDays(new Date(), new Date(b.due_date)) > 30).length}
                </TableCell>
                <TableCell className="text-right text-destructive font-bold">
                  {formatCurrency(
                    overdueBills
                      .filter((b: any) => differenceInDays(new Date(), new Date(b.due_date)) > 30)
                      .reduce((sum: number, b: any) => sum + (b.total || 0), 0)
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Table */}
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
              {bills.map((bill: any) => {
                const daysOverdue = bill.due_date && bill.status !== "paid"
                  ? Math.max(0, differenceInDays(new Date(), new Date(bill.due_date)))
                  : 0;
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.bill_number}</TableCell>
                    <TableCell>{bill.vendors?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(bill.bill_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {bill.due_date ? format(new Date(bill.due_date), "dd MMM yyyy") : "-"}
                    </TableCell>
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
                    <TableCell>
                      {daysOverdue > 0 && (
                        <span className="text-destructive font-medium">{daysOverdue} days</span>
                      )}
                    </TableCell>
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