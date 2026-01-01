import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Scale } from "lucide-react";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  current_balance: number;
}

interface BankTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  reference_number: string | null;
  transaction_date: string;
  is_reconciled: boolean;
}

const Reconciliation = () => {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [statementBalance, setStatementBalance] = useState<number>(0);
  const [reconciliationDate, setReconciliationDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, current_balance")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!user,
  });

  const { data: unreconciledTransactions = [] } = useQuery({
    queryKey: ["unreconciled-transactions", selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("bank_account_id", selectedAccountId)
        .eq("is_reconciled", false)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as BankTransaction[];
    },
    enabled: !!selectedAccountId,
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId || selectedTransactions.size === 0) {
        throw new Error("Please select transactions to reconcile");
      }

      const transactionIds = Array.from(selectedTransactions);
      
      // Mark transactions as reconciled
      const { error: updateError } = await supabase
        .from("bank_transactions")
        .update({ is_reconciled: true, reconciled_date: reconciliationDate })
        .in("id", transactionIds);
      if (updateError) throw updateError;

      // Create reconciliation record
      const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
      const { error: reconcileError } = await supabase.from("reconciliations").insert({
        bank_account_id: selectedAccountId,
        reconciliation_date: reconciliationDate,
        statement_balance: statementBalance,
        book_balance: selectedAccount?.current_balance || 0,
        difference: statementBalance - (selectedAccount?.current_balance || 0),
        status: "completed",
        user_id: user?.id,
      });
      if (reconcileError) throw reconcileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreconciled-transactions"] });
      toast.success("Transactions reconciled successfully");
      setSelectedTransactions(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);

  const clearedBalance = unreconciledTransactions
    .filter(t => selectedTransactions.has(t.id))
    .reduce((sum, t) => {
      if (t.transaction_type === "deposit") {
        return sum + t.amount;
      }
      return sum - t.amount;
    }, selectedAccount?.current_balance || 0);

  const difference = statementBalance - clearedBalance;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const toggleTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const selectAll = () => {
    if (selectedTransactions.size === unreconciledTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(unreconciledTransactions.map(t => t.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h1>
        <p className="text-muted-foreground">Match your bank statement with recorded transactions</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Reconciliation Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} ({account.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statement Date</Label>
              <Input
                type="date"
                value={reconciliationDate}
                onChange={(e) => setReconciliationDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Statement Ending Balance</Label>
              <Input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(parseFloat(e.target.value) || 0)}
                placeholder="Enter balance from bank statement"
              />
            </div>

            {selectedAccount && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Book Balance:</span>
                  <span className="font-medium">{formatCurrency(selectedAccount.current_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cleared Balance:</span>
                  <span className="font-medium">{formatCurrency(clearedBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Statement Balance:</span>
                  <span className="font-medium">{formatCurrency(statementBalance)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Difference:</span>
                  <span className={difference === 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(difference)}
                  </span>
                </div>
                
                {difference === 0 ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>Balanced! Ready to reconcile.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>Difference must be zero to reconcile.</span>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => reconcileMutation.mutate()}
              disabled={difference !== 0 || selectedTransactions.size === 0}
            >
              <Scale className="h-4 w-4 mr-2" />
              Complete Reconciliation
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Unreconciled Transactions</CardTitle>
            {unreconciledTransactions.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedTransactions.size === unreconciledTransactions.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedAccountId ? (
              <p className="text-center text-muted-foreground py-8">
                Select a bank account to view transactions
              </p>
            ) : unreconciledTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No unreconciled transactions for this account
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Clear</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unreconciledTransactions.map((trans) => (
                    <TableRow
                      key={trans.id}
                      className={selectedTransactions.has(trans.id) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedTransactions.has(trans.id)}
                          onCheckedChange={() => toggleTransaction(trans.id)}
                        />
                      </TableCell>
                      <TableCell>{new Date(trans.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>{trans.description || "-"}</TableCell>
                      <TableCell>{trans.reference_number || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={trans.transaction_type === "deposit" ? "secondary" : "outline"}>
                          {trans.transaction_type}
                        </Badge>
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

export default Reconciliation;
