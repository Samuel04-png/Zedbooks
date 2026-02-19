import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, query, where, setDoc, doc, serverTimestamp } from "firebase/firestore";
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
import { Plus, Search, Pencil, Trash2, Upload, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { ImportColumn, transformers } from "@/utils/importFromExcel";
import { exportToCSV, ExportColumn, formatCurrencyForExport, formatDateForExport } from "@/utils/exportToExcel";
import { useUserRole } from "@/hooks/useUserRole";

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
  journal_entry_id: string | null;
}

interface ExpenseFormData {
  description: string;
  category: string;
  amount: string;
  expense_date: string;
  vendor_name: string;
  payment_method: string;
  reference_number: string;
  notes: string;
}

interface ExpenseCategoryOption {
  id: string;
  categoryName: string;
}

interface PaymentAccountOption {
  id: string;
  accountName: string;
}

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
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const canReversePostedEntries = [
    "super_admin",
    "admin",
    "financial_manager",
    "accountant",
    "assistant_accountant",
  ].includes(userRole || "");

  const [formData, setFormData] = useState<ExpenseFormData>({
    description: "",
    category: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    vendor_name: "",
    payment_method: "cash",
    reference_number: "",
    notes: "",
  });

  const { data: companyId } = useQuery({
    queryKey: ["expenses-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Expense[];
      const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.EXPENSES), where("companyId", "==", companyId)));
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            description: String(row.description ?? ""),
            category: (row.category ?? null) as string | null,
            amount: Number(row.amount ?? 0),
            expense_date: String(row.expenseDate ?? row.expense_date ?? new Date().toISOString().slice(0, 10)),
            vendor_name: (row.vendorName ?? row.vendor_name ?? null) as string | null,
            payment_method: (row.paymentMethod ?? row.payment_method ?? null) as string | null,
            reference_number: (row.referenceNumber ?? row.reference_number ?? null) as string | null,
            notes: (row.notes ?? null) as string | null,
            journal_entry_id: (row.journalEntryId ?? row.journal_entry_id ?? null) as string | null,
          } satisfies Expense;
        })
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    },
    enabled: Boolean(companyId),
  });

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ["expense-category-mappings", companyId],
    queryFn: async () => {
      if (!companyId) return [] as ExpenseCategoryOption[];
      const snapshot = await getDocs(
        query(collection(firestore, COLLECTIONS.EXPENSE_CATEGORY_MAPPINGS), where("companyId", "==", companyId)),
      );
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            categoryName: String(row.categoryName ?? row.category_name ?? ""),
          } satisfies ExpenseCategoryOption;
        })
        .filter((row) => row.categoryName)
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    },
    enabled: Boolean(companyId),
  });

  const { data: paymentAccounts = [] } = useQuery({
    queryKey: ["expense-payment-accounts", companyId],
    queryFn: async () => {
      if (!companyId) return [] as PaymentAccountOption[];
      const snapshot = await getDocs(
        query(
          collection(firestore, COLLECTIONS.CHART_OF_ACCOUNTS),
          where("companyId", "==", companyId),
          where("accountType", "==", "Asset"),
          where("status", "==", "active"),
        ),
      );
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            accountName: String(row.accountName ?? ""),
          } satisfies PaymentAccountOption;
        })
        .filter((row) => row.accountName)
        .sort((a, b) => a.accountName.localeCompare(b.accountName));
    },
    enabled: Boolean(companyId),
  });

  const normalizePaymentMethod = (value: string) => {
    const method = value.toLowerCase();
    if (method === "mobile_money") return "Mobile Money";
    if (method === "cash") return "Cash";
    if (method === "credit") return "Credit";
    return "Bank";
  };

  const resolvePaymentAccountId = (value: string) => {
    if (!paymentAccounts.length) return "";
    const method = value.toLowerCase();

    const matchByNames = (candidates: string[]) =>
      paymentAccounts.find((account) =>
        candidates.some((candidate) => account.accountName.toLowerCase().includes(candidate)),
      )?.id || "";

    if (method === "cash") {
      return matchByNames(["cash"]) || paymentAccounts[0].id;
    }
    if (method === "mobile_money") {
      return matchByNames(["mobile", "airtel", "mtn"]) || paymentAccounts[0].id;
    }
    return matchByNames(["bank"]) || paymentAccounts[0].id;
  };

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const paymentAccountId = resolvePaymentAccountId(data.payment_method);
      if (!paymentAccountId) {
        throw new Error("No active Asset payment account found in Chart of Accounts.");
      }
      if (!data.category) {
        throw new Error("Expense category is required.");
      }

      await accountingService.recordExpense({
        companyId,
        amount: Number(data.amount),
        categoryName: data.category,
        paymentMethod: normalizePaymentMethod(data.payment_method),
        paymentAccountId,
        expenseDate: data.expense_date,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("Expense recorded successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create expense: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpenseFormData }) => {
      await setDoc(doc(firestore, COLLECTIONS.EXPENSES, id), {
        description: data.description,
        category: data.category || null,
        amount: Number(data.amount),
        expenseDate: data.expense_date,
        vendorName: data.vendor_name || null,
        paymentMethod: data.payment_method || null,
        referenceNumber: data.reference_number || null,
        notes: data.notes || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", companyId] });
      toast.success("Expense updated successfully");

      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update expense: " + error.message);
    },
  });

  const reverseExpenseMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      if (!companyId) throw new Error("Company not found");
      if (!expense.journal_entry_id) {
        throw new Error("Expense has no posted journal entry to reverse.");
      }
      const reason = prompt(`Reason for reversing expense "${expense.description}" (optional):`) || undefined;
      return accountingService.reverseJournalEntry({
        companyId,
        journalEntryId: expense.journal_entry_id,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense journal entry reversed");
    },
    onError: (error) => {
      toast.error("Failed to reverse expense: " + error.message);
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
    if (expense.journal_entry_id) {
      toast.error("Posted expenses cannot be edited directly.");
      return;
    }
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
      if (editingExpense.journal_entry_id) {
        toast.error("Posted expenses cannot be edited directly.");
        return;
      }
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
    if (!user?.id || !companyId) throw new Error("Not authenticated");

    for (const rawItem of data) {
      const item = rawItem as Record<string, unknown>;
      const paymentMethodRaw = String(item.payment_method ?? "cash");
      const paymentAccountId = resolvePaymentAccountId(paymentMethodRaw);
      if (!paymentAccountId) {
        throw new Error("No active Asset payment account found in Chart of Accounts.");
      }
      await accountingService.recordExpense({
        companyId,
        description: String(item.description ?? "").trim(),
        categoryName: item.category ? String(item.category).trim() : "Miscellaneous",
        amount: Number(item.amount ?? 0),
        expenseDate: String(item.expense_date ?? new Date().toISOString().split("T")[0]),
        paymentMethod: normalizePaymentMethod(paymentMethodRaw),
        paymentAccountId,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["expenses", companyId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    toast.success(`Imported ${data.length} expenses`);
  };

  const handleExport = () => {
    if (!expenses || expenses.length === 0) {
      toast.error("No expenses to export");
      return;
    }
    exportToCSV(expenses, expenseExportColumns, "expenses-export");
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
                          <SelectItem key={category.id} value={category.categoryName}>
                            {category.categoryName}
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
                      {expense.journal_entry_id && canReversePostedEntries && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={reverseExpenseMutation.isPending}
                          onClick={() => {
                            if (!confirm("Reverse this expense posting? This creates an opposite journal entry.")) {
                              return;
                            }
                            reverseExpenseMutation.mutate(expense);
                          }}
                          title="Reverse expense posting"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(expense)}
                        disabled={Boolean(expense.journal_entry_id)}
                        title={expense.journal_entry_id ? "Posted expenses cannot be edited" : "Edit"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          toast.error("Expense deletion is blocked. Use a reversal journal workflow.");
                        }}
                        disabled
                        title="Expense deletion is blocked"
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
