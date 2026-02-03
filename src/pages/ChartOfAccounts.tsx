import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Plus, Search, Edit2, Trash2, ChevronRight, Folder, FileText, Filter, Download } from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";

const ACCOUNT_TYPES = [
  { value: "Asset", label: "Asset", normalBalance: "Debit" },
  { value: "Liability", label: "Liability", normalBalance: "Credit" },
  { value: "Equity", label: "Equity", normalBalance: "Credit" },
  { value: "Revenue", label: "Revenue", normalBalance: "Credit" },
  { value: "Cost of Sales", label: "Cost of Sales", normalBalance: "Debit" },
  { value: "Expense", label: "Expense", normalBalance: "Debit" },
];

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "Asset", description: "Money available in bank or cash" },
  { code: "1010", name: "Petty Cash", type: "Asset", description: "Small cash for daily needs" },
  { code: "1100", name: "Accounts Receivable", type: "Asset", description: "Amount to be received from customers" },
  { code: "1200", name: "Inventory", type: "Asset", description: "Stock of goods for sale" },
  { code: "1300", name: "Prepaid Expenses", type: "Asset", description: "Advance payments for future expenses" },
  { code: "1500", name: "Fixed Assets", type: "Asset", description: "Long-term tangible assets" },
  { code: "1510", name: "Accumulated Depreciation", type: "Asset", description: "Total depreciation of fixed assets" },
  { code: "2000", name: "Accounts Payable", type: "Liability", description: "Money owed to suppliers" },
  { code: "2100", name: "Taxes Payable", type: "Liability", description: "Taxes due to government" },
  { code: "2200", name: "Loans Payable", type: "Liability", description: "Bank or other loans taken" },
  { code: "2300", name: "NAPSA Payable", type: "Liability", description: "NAPSA contributions payable" },
  { code: "2310", name: "NHIMA Payable", type: "Liability", description: "NHIMA contributions payable" },
  { code: "2320", name: "PAYE Payable", type: "Liability", description: "Pay As You Earn tax payable" },
  { code: "3000", name: "Owner's Equity", type: "Equity", description: "Owner's investment in business" },
  { code: "3100", name: "Retained Earnings", type: "Equity", description: "Accumulated profits retained" },
  { code: "4000", name: "Sales Revenue", type: "Revenue", description: "Income from sales" },
  { code: "4100", name: "Service Revenue", type: "Revenue", description: "Income from services" },
  { code: "4200", name: "Grant Income", type: "Revenue", description: "Income from grants and donations" },
  { code: "5000", name: "Cost of Goods Sold", type: "Cost of Sales", description: "Direct costs of goods sold" },
  { code: "6000", name: "Rent Expense", type: "Expense", description: "Monthly office rent" },
  { code: "6100", name: "Office Supplies", type: "Expense", description: "Supplies used in office" },
  { code: "6200", name: "Salaries Expense", type: "Expense", description: "Employee salaries" },
  { code: "6300", name: "Utilities Expense", type: "Expense", description: "Electricity, internet, water bills" },
  { code: "6400", name: "Depreciation Expense", type: "Expense", description: "Periodic asset depreciation" },
  { code: "6500", name: "Bank Charges", type: "Expense", description: "Bank fees and charges" },
];

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  description: string | null;
  parent_account_id: string | null;
  is_active: boolean;
}

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
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
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("account_code", { ascending: true });

      if (error) throw error;
      return data as Account[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("chart_of_accounts").insert({
        account_code: data.account_code,
        account_name: data.account_name,
        account_type: data.account_type,
        description: data.description || null,
        parent_account_id: data.parent_account_id || null,
        user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Account created successfully");
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create account: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({
          account_code: data.account_code,
          account_name: data.account_name,
          account_type: data.account_type,
          description: data.description || null,
          parent_account_id: data.parent_account_id || null,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Account updated successfully");
      resetForm();
      setEditingAccount(null);
    },
    onError: (error) => {
      toast.error(`Failed to update account: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chart_of_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Account deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });

  const setupDefaultAccounts = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const accountsToInsert = DEFAULT_ACCOUNTS.map(acc => ({
        ...acc,
        account_code: acc.code,
        account_name: acc.name,
        account_type: acc.type,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from("chart_of_accounts")
        .insert(accountsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Default chart of accounts created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to setup accounts: ${error.message}`);
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
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      description: account.description || "",
      parent_account_id: account.parent_account_id || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.account_code || !formData.account_name || !formData.account_type) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingAccount) {
      updateMutation.mutate({ ...formData, id: editingAccount.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getNormalBalance = (type: string) => {
    const accountType = ACCOUNT_TYPES.find(t => t.value === type);
    return accountType?.normalBalance || "-";
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Asset": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Liability": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Equity": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Revenue": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Cost of Sales": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "Expense": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredAccounts = accounts?.filter(account => {
    const matchesSearch = 
      account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || account.account_type === filterType;
    return matchesSearch && matchesType;
  });

  // Group accounts by type
  const groupedAccounts = filteredAccounts?.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  if (isLoading) {
    return <LoadingState message="Loading chart of accounts..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">
            Manage your organization's account structure
          </p>
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
              <Button onClick={() => { resetForm(); setEditingAccount(null); }}>
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
                    value={formData.parent_account_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {accounts?.filter(a => a.account_type === formData.account_type).map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_code} - {account.account_name}
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
                      Normal Balance: <span className="font-medium text-foreground">{getNormalBalance(formData.account_type)}</span>
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

      {/* Search and Filter */}
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

      {/* Accounts Table */}
      {!filteredAccounts || filteredAccounts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
            <p className="text-muted-foreground mb-4">
              {accounts?.length === 0 
                ? "Set up your chart of accounts to start tracking your finances"
                : "No accounts match your search criteria"
              }
            </p>
            {accounts?.length === 0 && (
              <Button onClick={() => setupDefaultAccounts.mutate()}>
                Setup Default Accounts
              </Button>
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
                      <TableCell className="font-mono font-medium">
                        {account.account_code}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {account.parent_account_id && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          {account.account_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(account.account_type)} variant="secondary">
                          {account.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getNormalBalance(account.account_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {account.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              handleEdit(account);
                              setIsAddDialogOpen(true);
                            }}
                          >
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

      {/* Edit Dialog */}
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
