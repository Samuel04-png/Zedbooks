import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string | null;
  bank_name: string;
  branch: string | null;
  account_type: string | null;
  currency: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  reference_number: string | null;
  transaction_date: string;
  is_reconciled: boolean;
}

const BankAccounts = () => {
  const queryClient = useQueryClient();
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [newAccount, setNewAccount] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    branch: "",
    account_type: "checking",
    currency: "ZMW",
    opening_balance: 0,
  });
  const [newTransaction, setNewTransaction] = useState({
    transaction_type: "deposit",
    amount: 0,
    description: "",
    reference_number: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: bankAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("account_name");
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["bank-transactions", selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("bank_account_id", selectedAccount.id)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as BankTransaction[];
    },
    enabled: !!selectedAccount,
  });

  const addAccountMutation = useMutation({
    mutationFn: async (account: typeof newAccount) => {
      const { error } = await supabase.from("bank_accounts").insert({
        ...account,
        current_balance: account.opening_balance,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("Bank account added successfully");
      setIsAccountDialogOpen(false);
      setNewAccount({
        account_name: "",
        account_number: "",
        bank_name: "",
        branch: "",
        account_type: "checking",
        currency: "ZMW",
        opening_balance: 0,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addTransactionMutation = useMutation({
    mutationFn: async (transaction: typeof newTransaction) => {
      if (!selectedAccount) throw new Error("No account selected");

      const newBalance = transaction.transaction_type === "deposit"
        ? selectedAccount.current_balance + transaction.amount
        : selectedAccount.current_balance - transaction.amount;

      const { error: transError } = await supabase.from("bank_transactions").insert({
        ...transaction,
        bank_account_id: selectedAccount.id,
        user_id: user?.id,
      });
      if (transError) throw transError;

      const { error: updateError } = await supabase
        .from("bank_accounts")
        .update({ current_balance: newBalance })
        .eq("id", selectedAccount.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      toast.success("Transaction recorded");
      setIsTransactionDialogOpen(false);
      setNewTransaction({
        transaction_type: "deposit",
        amount: 0,
        description: "",
        reference_number: "",
        transaction_date: new Date().toISOString().split("T")[0],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (amount: number, currency: string = "ZMW") => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
          <p className="text-muted-foreground">Manage your bank accounts and transactions</p>
        </div>
        <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input
                  value={newAccount.account_name}
                  onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                  placeholder="e.g., Main Operating Account"
                />
              </div>
              <div className="space-y-2">
                <Label>Bank Name *</Label>
                <Input
                  value={newAccount.bank_name}
                  onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                  placeholder="e.g., Zanaco, Stanbic, FNB"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={newAccount.account_number}
                    onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Input
                    value={newAccount.branch}
                    onChange={(e) => setNewAccount({ ...newAccount, branch: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={newAccount.account_type}
                    onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="money_market">Money Market</SelectItem>
                      <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={newAccount.currency}
                    onValueChange={(value) => setNewAccount({ ...newAccount, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZMW">ZMW - Zambian Kwacha</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newAccount.opening_balance}
                  onChange={(e) => setNewAccount({ ...newAccount, opening_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => addAccountMutation.mutate(newAccount)}
                disabled={!newAccount.account_name || !newAccount.bank_name}
              >
                Add Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bankAccounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bankAccounts.filter(a => a.is_active).length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <p>Loading accounts...</p>
            ) : bankAccounts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No bank accounts found. Add your first account to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedAccount?.id === account.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedAccount(account)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{account.account_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {account.bank_name} {account.account_number ? `- ${account.account_number}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(account.current_balance, account.currency || "ZMW")}</p>
                        <Badge variant={account.is_active ? "secondary" : "outline"}>
                          {account.account_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selectedAccount ? `Transactions - ${selectedAccount.account_name}` : "Select an Account"}
            </CardTitle>
            {selectedAccount && (
              <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Transaction</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Transaction Type</Label>
                      <Select
                        value={newTransaction.transaction_type}
                        onValueChange={(value) => setNewTransaction({ ...newTransaction, transaction_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit</SelectItem>
                          <SelectItem value="withdrawal">Withdrawal</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newTransaction.amount}
                        onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={newTransaction.transaction_date}
                        onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={newTransaction.description}
                        onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                        placeholder="Transaction description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reference Number</Label>
                      <Input
                        value={newTransaction.reference_number}
                        onChange={(e) => setNewTransaction({ ...newTransaction, reference_number: e.target.value })}
                        placeholder="Check#, Transfer#, etc."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => addTransactionMutation.mutate(newTransaction)}
                      disabled={newTransaction.amount <= 0}
                    >
                      Record Transaction
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!selectedAccount ? (
              <p className="text-center text-muted-foreground py-8">
                Select an account to view transactions
              </p>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions recorded for this account
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 10).map((trans) => (
                    <TableRow key={trans.id}>
                      <TableCell>{new Date(trans.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trans.transaction_type === "deposit" ? (
                            <ArrowDownRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          )}
                          {trans.description || trans.transaction_type}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        trans.transaction_type === "deposit" ? "text-green-600" : "text-red-600"
                      }`}>
                        {trans.transaction_type === "deposit" ? "+" : "-"}
                        {formatCurrency(trans.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BankAccounts;
