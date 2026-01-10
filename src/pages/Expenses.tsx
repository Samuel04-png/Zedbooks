import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Search, Pencil, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { ImportColumn, transformers } from "@/utils/importFromExcel";
import { exportToCSV, ExportColumn, formatCurrencyForExport, formatDateForExport } from "@/utils/exportToExcel";

interface Expense {
  id: string;
  description: string;
  category: string | null;
  amount: number;
  expense_date: string;
  vendor_name: string | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
}

const expenseCategories = [
  "Office Supplies",
  "Travel",
  "Meals & Entertainment",
  "Utilities",
  "Rent",
  "Professional Services",
  "Marketing",
  "Equipment",
  "Software & Subscriptions",
  "Training",
  "Insurance",
  "Maintenance",
  "Other",
];

const expenseImportColumns: ImportColumn[] = [
  { header: "Description", key: "description", required: true, transform: transformers.trim },
  { header: "Category", key: "category", transform: transformers.trim },
  { header: "Amount", key: "amount", required: true, transform: transformers.toNumber },
  { header: "Date", key: "expense_date", required: true, transform: transformers.toDate },
  { header: "Vendor", key: "vendor_name", transform: transformers.trim },
  { header: "Payment Method", key: "payment_method", transform: transformers.trim },
  { header: "Reference", key: "reference_number", transform: transformers.trim },
  { header: "Notes", key: "notes", transform: transformers.trim },
];

const expenseExportColumns: ExportColumn[] = [
  { header: "Date", key: "expense_date", formatter: formatDateForExport },
  { header: "Description", key: "description" },
  { header: "Category", key: "category" },
  { header: "Vendor", key: "vendor_name" },
  { header: "Amount", key: "amount", formatter: formatCurrencyForExport },
  { header: "Payment Method", key: "payment_method" },
  { header: "Reference", key: "reference_number" },
  { header: "Notes", key: "notes" },
];

export default function Expenses() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState({
    description: "",
    category: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    vendor_name: "",
    payment_method: "cash",
    reference_number: "",
    notes: "",
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Expense[];
    },
  });

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("expenses").insert({
        ...data,
        user_id: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create expense: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("expenses")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense updated successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update expense: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete expense: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      description: "",
      category: "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      vendor_name: "",
      payment_method: "cash",
      reference_number: "",
      notes: "",
    });
    setEditingExpense(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description || "",
      category: expense.category || "",
      amount: expense.amount?.toString() || "",
      expense_date: expense.expense_date || new Date().toISOString().split("T")[0],
      vendor_name: expense.vendor_name || "",
      payment_method: expense.payment_method || "cash",
      reference_number: expense.reference_number || "",
      notes: expense.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const getCategoryVariant = (category: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      "Office Supplies": "default",
      Travel: "secondary",
      "Meals & Entertainment": "outline",
      Utilities: "default",
      Rent: "secondary",
    };
    return variants[category] || "outline";
  };

  const filteredExpenses = expenses?.filter(
    (expense) =>
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate totals
  const totalExpenses = expenses?.reduce(
    (sum, exp) => sum + Number(exp.amount || 0),
    0
  ) || 0;

  const handleImport = async (data: Record<string, unknown>[]) => {
    for (const item of data) {
      await supabase.from("expenses").insert({
        ...item,
        user_id: user?.id,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    toast.success(`Imported ${data.length} expenses`);
  };

  const handleExport = () => {
    if (!expenses || expenses.length === 0) {
      toast.error("No expenses to export");
      return;
    }
    exportToCSV(expenses as any, expenseExportColumns, "expenses-export");
    toast.success("Expenses exported");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">
            Track and manage business expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Edit Expense" : "Record New Expense"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="What was this expense for?"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="space-y-2">
                  <Label htmlFor="expense_date">Date *</Label>
                  <Input
                    id="expense_date"
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expense_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor/Payee</Label>
                  <Input
                    id="vendor_name"
                    value={formData.vendor_name}
                    onChange={(e) =>
                      setFormData({ ...formData, vendor_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) =>
                      setFormData({ ...formData, payment_method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Reference #</Label>
                  <Input
                    id="reference_number"
                    value={formData.reference_number}
                    onChange={(e) =>
                      setFormData({ ...formData, reference_number: e.target.value })
                    }
                    placeholder="Receipt/Invoice number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingExpense ? "Update" : "Record"} Expense
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Expenses"
        description="Upload a CSV file to import expenses in bulk"
        columns={expenseImportColumns}
        onImport={handleImport}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                expenses
                  ?.filter((e) => {
                    const date = new Date(e.expense_date);
                    const now = new Date();
                    return (
                      date.getMonth() === now.getMonth() &&
                      date.getFullYear() === now.getFullYear()
                    );
                  })
                  .reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
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
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses?.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    {format(new Date(expense.expense_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getCategoryVariant(expense.category || "")}>
                      {expense.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{expense.vendor_name || "-"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(expense.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(expense)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredExpenses?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No expenses found. Record your first expense!
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