import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, ChevronRight, FileText, Filter } from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

const ACCOUNT_TYPES = [
  { value: "asset", label: "Asset", normalBalance: "Debit" },
  { value: "liability", label: "Liability", normalBalance: "Credit" },
  { value: "equity", label: "Equity", normalBalance: "Credit" },
  { value: "income", label: "Income", normalBalance: "Credit" },
  { value: "expense", label: "Expense", normalBalance: "Debit" },
] as const;

const ACCOUNT_TYPE_RANGES: Record<string, [number, number]> = {
  asset: [1000, 19999],
  liability: [2000, 29999],
  equity: [3000, 39999],
  income: [4000, 49999],
  expense: [5000, 99999],
};

const validateAccountCode = (type: string, code: string): string | null => {
  const num = Number(code);
  if (!Number.isFinite(num)) return "Code must be a number";
  const range = ACCOUNT_TYPE_RANGES[type.toLowerCase()];
  if (!range) return null; // Unknown type
  if (num < range[0] || num > range[1]) {
    return `Code must be between ${range[0]} and ${range[1]} for ${type}`;
  }
  return null;
};

const DEFAULT_ACCOUNTS = [
  { code: 1000, name: "Cash", type: "asset", description: "Money available in bank or cash" },
  { code: 1010, name: "Petty Cash", type: "asset", description: "Small cash for daily needs" },
  { code: 1100, name: "Accounts Receivable", type: "asset", description: "Amount to be received from customers" },
  { code: 1200, name: "Inventory", type: "asset", description: "Stock of goods for sale" },
  { code: 1300, name: "Prepaid Expenses", type: "asset", description: "Advance payments for future expenses" },
  { code: 1500, name: "Fixed Assets", type: "asset", description: "Long-term tangible assets" },
  { code: 1510, name: "Accumulated Depreciation", type: "asset", description: "Total depreciation of fixed assets" },
  { code: 2000, name: "Accounts Payable", type: "liability", description: "Money owed to suppliers" },
  { code: 2100, name: "Taxes Payable", type: "liability", description: "Taxes due to government" },
  { code: 2200, name: "Loans Payable", type: "liability", description: "Bank or other loans taken" },
  { code: 2300, name: "NAPSA Payable", type: "liability", description: "NAPSA contributions payable" },
  { code: 2310, name: "NHIMA Payable", type: "liability", description: "NHIMA contributions payable" },
  { code: 2320, name: "PAYE Payable", type: "liability", description: "Pay As You Earn tax payable" },
  { code: 3000, name: "Owner's Equity", type: "equity", description: "Owner's investment in business" },
  { code: 3100, name: "Retained Earnings", type: "equity", description: "Accumulated profits retained" },
  { code: 4001, name: "Sales Revenue", type: "income", description: "Income from sales" },
  { code: 4100, name: "Service Revenue", type: "income", description: "Income from services" },
  { code: 4200, name: "Grant Income", type: "income", description: "Income from grants and donations" },
  { code: 5000, name: "Cost of Goods Sold", type: "expense", description: "Direct costs of goods sold" },
  { code: 5100, name: "Rent Expense", type: "expense", description: "Monthly office rent" },
  { code: 5200, name: "Office Supplies", type: "expense", description: "Supplies used in office" },
  { code: 5300, name: "Salaries Expense", type: "expense", description: "Employee salaries" },
  { code: 5400, name: "Utilities Expense", type: "expense", description: "Electricity, internet, water bills" },
  { code: 5500, name: "Depreciation Expense", type: "expense", description: "Periodic asset depreciation" },
  { code: 5600, name: "Bank Charges", type: "expense", description: "Bank fees and charges" },
  { code: 5700, name: "Travel Expense", type: "expense", description: "Business travel costs" },
  { code: 5800, name: "Marketing Expense", type: "expense", description: "Advertising and promotion" },
] as const;

interface Account {
  id: string;
  companyId: string;
  accountCode: number;
  accountName: string;
  accountType: string;
  description: string | null;
  parentAccountId: string | null;
  status: string;
}

const normalizeType = (value: string): string => {
  const normalized = value.toLowerCase();
  if (normalized === "revenue") return "income";
  return normalized;
};

const toDbType = (value: string): string => {
  const normalized = normalizeType(value);
  const match = ACCOUNT_TYPES.find((type) => type.value === normalized);
  return match?.label || "Expense";
};

const toUiType = (value: string): string => normalizeType(value);

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "",
    description: "",
    parent_account_id: "",
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["chart-of-accounts", user?.id],
    queryFn: async () => {
      if (!user) return [] as Account[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as Account[];

      const chartRef = collection(firestore, COLLECTIONS.CHART_OF_ACCOUNTS);
      const snapshot = await getDocs(query(chartRef, where("companyId", "==", membership.companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            companyId: String(row.companyId ?? ""),
            accountCode: Number(row.accountCode ?? row.account_code ?? 0),
            accountName: String(row.accountName ?? row.account_name ?? ""),
            accountType: toUiType(String(row.accountType ?? row.account_type ?? "expense")),
            description: (row.description as string | null) ?? null,
            parentAccountId: (row.parentAccountId ?? row.parent_account_id ?? null) as string | null,
            status: String(row.status ?? (row.isActive === false ? "inactive" : "active")),
          } satisfies Account;
        })
        .sort((a, b) => a.accountCode - b.accountCode);
    },
    enabled: Boolean(user),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("Company context not found");

      const accountCode = Number(data.account_code);
      if (!Number.isFinite(accountCode)) {
        throw new Error("Account number must be numeric");
      }

      const paramType = toDbType(data.account_type);
      const error = validateAccountCode(paramType, data.account_code);
      if (error) throw new Error(error);

      await addDoc(collection(firestore, COLLECTIONS.CHART_OF_ACCOUNTS), {
        companyId: membership.companyId,
        accountCode,
        accountName: data.account_name,
        accountType: toDbType(data.account_type),
        description: data.description || null,
        parentAccountId: data.parent_account_id || null,
        status: "active",
        isSystem: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", user?.id] });
      toast.success("Account created successfully");
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create account: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string; companyId: string }) => {
      const accountCode = Number(data.account_code);
      if (!Number.isFinite(accountCode)) {
        throw new Error("Account number must be numeric");
      }

      const paramType = toDbType(data.account_type);
      const error = validateAccountCode(paramType, data.account_code);
      if (error) throw new Error(error);

      await setDoc(
        doc(firestore, COLLECTIONS.CHART_OF_ACCOUNTS, data.id),
        {
          companyId: data.companyId,
          accountCode,
          accountName: data.account_name,
          accountType: toDbType(data.account_type),
          description: data.description || null,
          parentAccountId: data.parent_account_id || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", user?.id] });
      toast.success("Account updated successfully");
      resetForm();
      setEditingAccount(null);
    },
    onError: (error) => {
      toast.error(`Failed to update account: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(firestore, COLLECTIONS.CHART_OF_ACCOUNTS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", user?.id] });
      toast.success("Account deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const setupDefaultAccounts = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("Company context not found");

      const batch = writeBatch(firestore);
      DEFAULT_ACCOUNTS.forEach((account) => {
        const ref = doc(firestore, COLLECTIONS.CHART_OF_ACCOUNTS, `${membership.companyId}_${account.code}`);
        batch.set(
          ref,
          {
            companyId: membership.companyId,
            accountCode: account.code,
            accountName: account.name,
            accountType: toDbType(account.type),
            description: account.description,
            parentAccountId: null,
            status: "active",
            isSystem: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", user?.id] });
      toast.success("Default chart of accounts created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to setup accounts: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const resetForm = () => {
    setFormData({
      account_code: "",
      account_name: "",
      account_type: "",
      description: "",
      parent_account_id: "",
    });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_code: String(account.accountCode),
      account_name: account.accountName,
      account_type: account.accountType,
      description: account.description || "",
      parent_account_id: account.parentAccountId || "",
    });
  };

  const getAccountRange = (type: string) => {
    switch (normalizeType(type)) {
      case "asset": return { min: 1000, max: 19999, label: "1000-19999" };
      case "liability": return { min: 2000, max: 29999, label: "2000-29999" };
      case "equity": return { min: 3000, max: 39999, label: "3000-39999" };
      case "income": return { min: 4000, max: 49999, label: "4000-49999" };
      case "expense": return { min: 5000, max: 99999, label: "5000-99999" };
      default: return null;
    }
  };

  const handleSubmit = () => {
    if (!formData.account_code || !formData.account_name || !formData.account_type) {
      toast.error("Please fill in all required fields");
      return;
    }

    const accountCode = Number(formData.account_code);
    if (!Number.isFinite(accountCode)) {
      toast.error("Account number must be numeric");
      return;
    }

    const range = getAccountRange(formData.account_type);
    if (range) {
      if (accountCode < range.min || accountCode > range.max) {
        toast.error(`Invalid account code for ${formData.account_type}. Must be between ${range.label}`);
        return;
      }
    }

    if (editingAccount) {
      updateMutation.mutate({ ...formData, id: editingAccount.id, companyId: editingAccount.companyId });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getNormalBalance = (type: string) => {
    const accountType = ACCOUNT_TYPES.find((t) => t.value === normalizeType(type));
    return accountType?.normalBalance || "-";
  };

  const getTypeColor = (type: string) => {
    switch (normalizeType(type)) {
      case "asset":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "liability":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "equity":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "income":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "expense":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredAccounts = accounts?.filter((account) => {
    const matchesSearch =
      account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(account.accountCode).includes(searchTerm);
    const matchesType = filterType === "all" || account.accountType === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return <LoadingState message="Loading chart of accounts..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your organization's account structure</p>
        </div>
        <div className="flex gap-2">
          {(!accounts || accounts.length === 0) && (
            <Button
              variant="outline"
              onClick={() => setupDefaultAccounts.mutate()}
              disabled={setupDefaultAccounts.isPending}
            >
              <FileText className="h-4 w-4 mr-2" />
              Setup Default Accounts
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setEditingAccount(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_code">Account Number *</Label>
                    <Input
                      id="account_code"
                      placeholder="e.g., 1000"
                      value={formData.account_code}
                      onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Account Type *</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_name">Account Name *</Label>
                  <Input
                    id="account_name"
                    placeholder="e.g., Cash on Hand"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_account">Parent Account (Optional)</Label>
                  <Select
                    value={formData.parent_account_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, parent_account_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts
                        ?.filter((account) => account.accountType === formData.account_type)
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountCode} - {account.accountName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this account"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                {formData.account_type && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Normal Balance:{" "}
                      <span className="font-medium text-foreground">{getNormalBalance(formData.account_type)}</span>
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  Create Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!filteredAccounts || filteredAccounts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
            <p className="text-muted-foreground mb-4">
              {accounts?.length === 0
                ? "Set up your chart of accounts to start tracking your finances"
                : "No accounts match your search criteria"}
            </p>
            {accounts?.length === 0 && (
              <Button onClick={() => setupDefaultAccounts.mutate()}>Setup Default Accounts</Button>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Account List</CardTitle>
              <Badge variant="secondary">{filteredAccounts.length} accounts</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50 dark:bg-amber-950/20">
                    <TableHead className="font-bold">Account Number</TableHead>
                    <TableHead className="font-bold">Account Name</TableHead>
                    <TableHead className="font-bold">Account Type</TableHead>
                    <TableHead className="font-bold">Normal Balance</TableHead>
                    <TableHead className="font-bold">Description</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono font-medium">{account.accountCode}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {account.parentAccountId && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          {account.accountName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(account.accountType)} variant="secondary">
                          {account.accountType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getNormalBalance(account.accountType)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{account.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this account?")) {
                                deleteMutation.mutate(account.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_account_code">Account Number *</Label>
                <Input
                  id="edit_account_code"
                  value={formData.account_code}
                  onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_account_type">Account Type *</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_account_name">Account Name *</Label>
              <Input
                id="edit_account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
