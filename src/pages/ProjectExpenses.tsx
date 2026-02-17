import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { projectActivityService } from "@/services/firebase/projectActivityService";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Download, Pencil, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToCSV } from "@/utils/exportToExcel";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";

interface ProjectDetails {
  id: string;
  name: string;
  budget: number;
  spent: number;
  status: string | null;
  currentPhase: string | null;
}

interface ProjectExpenseRecord {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string | null;
  notes: string | null;
}

const expenseCategories = [
  "Personnel",
  "Equipment",
  "Travel",
  "Supplies",
  "Training",
  "Consultancy",
  "Utilities",
  "Communications",
  "Other",
];

export default function ProjectExpenses() {
  const { user } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ProjectExpenseRecord | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    category: "",
    notes: "",
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);

  const { data: companyId } = useQuery({
    queryKey: ["project-expenses-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: project } = useQuery({
    queryKey: ["project", companyId, projectId],
    queryFn: async () => {
      if (!projectId || !companyId) return null;
      const snap = await getDoc(doc(firestore, COLLECTIONS.PROJECTS, projectId));
      if (!snap.exists()) return null;

      const row = snap.data() as Record<string, unknown>;
      if (String(row.companyId ?? "") !== companyId) return null;

      return {
        id: snap.id,
        name: String(row.name ?? ""),
        budget: Number(row.budget ?? 0),
        spent: Number(row.spent ?? 0),
        status: (row.status ?? null) as string | null,
        currentPhase: (row.currentPhase ?? row.current_phase ?? null) as string | null,
      } satisfies ProjectDetails;
    },
    enabled: Boolean(projectId && companyId),
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["project-expenses", companyId, projectId],
    queryFn: async () => {
      if (!projectId || !companyId) return [] as ProjectExpenseRecord[];

      const ref = collection(firestore, COLLECTIONS.PROJECT_EXPENSES);
      const snapshot = await getDocs(
        query(
          ref,
          where("companyId", "==", companyId),
          where("projectId", "==", projectId),
        ),
      );

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const expenseDate = row.expenseDate ?? row.expense_date;
          const normalizedDate = typeof expenseDate === "string"
            ? expenseDate
            : (expenseDate as { toDate?: () => Date })?.toDate?.().toISOString().slice(0, 10)
                ?? new Date().toISOString().slice(0, 10);

          return {
            id: docSnap.id,
            description: String(row.description ?? ""),
            amount: Number(row.amount ?? 0),
            expense_date: normalizedDate,
            category: (row.category ?? null) as string | null,
            notes: (row.notes ?? null) as string | null,
          } satisfies ProjectExpenseRecord;
        })
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    },
    enabled: Boolean(projectId && companyId),
  });

  const refreshProjectSpent = async () => {
    if (!projectId || !companyId) return;
    const ref = collection(firestore, COLLECTIONS.PROJECT_EXPENSES);
    const snapshot = await getDocs(
      query(
        ref,
        where("companyId", "==", companyId),
        where("projectId", "==", projectId),
      ),
    );
    const spent = snapshot.docs.reduce(
      (sum, docSnap) => sum + Number((docSnap.data() as Record<string, unknown>).amount ?? 0),
      0,
    );
    await setDoc(
      doc(firestore, COLLECTIONS.PROJECTS, projectId),
      {
        spent,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["project-expenses", companyId, projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", companyId, projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
    queryClient.invalidateQueries({ queryKey: ["project-activity-log", companyId, projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-activity-logs", companyId] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!projectId || !companyId || !user) throw new Error("No active company context");

      const amount = Number.parseFloat(data.amount);
      const docRef = await addDoc(collection(firestore, COLLECTIONS.PROJECT_EXPENSES), {
        companyId,
        projectId,
        userId: user.id,
        description: data.description,
        amount,
        expenseDate: data.expense_date,
        category: data.category || null,
        notes: data.notes || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await refreshProjectSpent();
      await projectActivityService.create({
        companyId,
        projectId,
        activity: "Expense Added",
        description: `${data.description} recorded (${formatCurrency(amount)})`,
        source: "Project Expenses",
        sourceType: COLLECTIONS.PROJECT_EXPENSES,
        sourceId: docRef.id,
        phase: project?.currentPhase,
        status: "implemented",
        approvalStatus: "approved",
        appliedToSection: "Budget & Expenses",
        implemented: true,
        createdBy: user.id,
        metadata: {
          category: data.category || null,
          expenseDate: data.expense_date,
        },
      });
    },
    onSuccess: () => {
      refreshQueries();
      toast.success("Expense added successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to add expense: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      expense,
      data,
    }: {
      expense: ProjectExpenseRecord;
      data: typeof formData;
    }) => {
      if (!companyId || !projectId || !user) throw new Error("No active company context");

      const amount = Number.parseFloat(data.amount);
      await setDoc(
        doc(firestore, COLLECTIONS.PROJECT_EXPENSES, expense.id),
        {
          description: data.description,
          amount,
          expenseDate: data.expense_date,
          category: data.category || null,
          notes: data.notes || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await refreshProjectSpent();

      await projectActivityService.create({
        companyId,
        projectId,
        activity: "Expense Updated",
        description: `${data.description} updated (${formatCurrency(amount)})`,
        source: "Project Expenses",
        sourceType: COLLECTIONS.PROJECT_EXPENSES,
        sourceId: expense.id,
        phase: project?.currentPhase,
        status: "implemented",
        approvalStatus: "approved",
        appliedToSection: "Budget & Expenses",
        implemented: true,
        createdBy: user.id,
        metadata: {
          previousAmount: expense.amount,
          previousDate: expense.expense_date,
        },
      });
    },
    onSuccess: () => {
      refreshQueries();
      toast.success("Expense updated successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update expense: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (expense: ProjectExpenseRecord) => {
      if (!companyId || !projectId || !user) throw new Error("No active company context");
      await deleteDoc(doc(firestore, COLLECTIONS.PROJECT_EXPENSES, expense.id));
      await refreshProjectSpent();

      await projectActivityService.create({
        companyId,
        projectId,
        activity: "Expense Removed",
        description: `${expense.description} removed (${formatCurrency(expense.amount)})`,
        source: "Project Expenses",
        sourceType: COLLECTIONS.PROJECT_EXPENSES,
        sourceId: expense.id,
        phase: project?.currentPhase,
        status: "implemented",
        approvalStatus: "approved",
        appliedToSection: "Budget & Expenses",
        implemented: true,
        createdBy: user.id,
      });
    },
    onSuccess: () => {
      refreshQueries();
      toast.success("Expense deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete expense: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      category: "",
      notes: "",
    });
    setEditingExpense(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (expense: ProjectExpenseRecord) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      category: expense.category || "",
      notes: expense.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingExpense) {
      updateMutation.mutate({ expense: editingExpense, data: formData });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleExport = () => {
    const columns = [
      { header: "Date", key: "expense_date" },
      { header: "Description", key: "description" },
      { header: "Category", key: "category" },
      { header: "Amount", key: "amount" },
      { header: "Notes", key: "notes" },
    ];
    exportToCSV(expenses, columns, `${project?.name || "project"}-expenses`);
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full space-y-6">
      <ProjectWorkspaceHeader
        projectId={projectId}
        projectName={project ? `${project.name} - Expenses` : "Project Expenses"}
        subtitle={[
          `Budget: ${formatCurrency(project?.budget || 0)}`,
          `Spent: ${formatCurrency(totalExpenses)}`,
          `Remaining: ${formatCurrency((project?.budget || 0) - totalExpenses)}`,
        ].join(" | ")}
        activeTab="expenses"
        actions={(
          <>
            <Button variant="outline" onClick={handleExport} disabled={expenses.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input
                      value={formData.description}
                      onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Amount (ZMW) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={formData.expense_date}
                        onChange={(event) => setFormData({ ...formData, expense_date: event.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
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
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingExpense ? "Update" : "Add"} Expense
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(project?.budget || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency((project?.budget || 0) - totalExpenses)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No expenses recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.expense_date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{expense.description}</TableCell>
                      <TableCell>{expense.category || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(expense.amount))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(expense)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

