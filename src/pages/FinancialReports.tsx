import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, BarChart3, PieChart, TrendingUp } from "lucide-react";

const FinancialReports = () => {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch invoices for revenue
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate)
        .eq("status", "paid");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch bills
  const { data: bills = [] } = useQuery({
    queryKey: ["bills-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .gte("bill_date", startDate)
        .lte("bill_date", endDate);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch payroll
  const { data: payrollRuns = [] } = useQuery({
    queryKey: ["payroll-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .gte("run_date", startDate)
        .lte("run_date", endDate)
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch inventory
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*");
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

  // Calculate financial metrics
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalBills = bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
  const totalPayroll = payrollRuns.reduce((sum, pr) => sum + (pr.total_net || 0), 0);
  const totalCashBalance = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  const totalInventoryValue = inventory.reduce((sum, item) => sum + ((item.quantity_on_hand || 0) * (item.unit_cost || 0)), 0);

  const grossProfit = totalRevenue;
  const operatingExpenses = totalExpenses + totalBills + totalPayroll;
  const netIncome = grossProfit - operatingExpenses;

  // Expense breakdown by category
  const expensesByCategory = expenses.reduce((acc: Record<string, number>, exp) => {
    const category = exp.category || "Uncategorized";
    acc[category] = (acc[category] || 0) + (exp.amount || 0);
    return acc;
  }, {});

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(h => `"${row[h] || ""}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground">Standard accounting reports and financial statements</p>
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

      <Tabs defaultValue="income-statement">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="income-statement">
            <TrendingUp className="h-4 w-4 mr-2" />
            Income Statement
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            <PieChart className="h-4 w-4 mr-2" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash-flow">
            <BarChart3 className="h-4 w-4 mr-2" />
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="trial-balance">
            <FileText className="h-4 w-4 mr-2" />
            Trial Balance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Income Statement (Profit & Loss)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV([
                { Category: "Revenue", Amount: totalRevenue },
                { Category: "Expenses", Amount: totalExpenses },
                { Category: "Bills", Amount: totalBills },
                { Category: "Payroll", Amount: totalPayroll },
                { Category: "Net Income", Amount: netIncome },
              ], "income-statement")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell>Revenue</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Sales Revenue (Paid Invoices)</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(totalRevenue)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell>Gross Profit</TableCell>
                    <TableCell className="text-right">{formatCurrency(grossProfit)}</TableCell>
                  </TableRow>
                  
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell>Operating Expenses</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">General Expenses</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalExpenses)})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Vendor Bills</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalBills)})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Payroll Expenses</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalPayroll)})</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell className="pl-8">Total Operating Expenses</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(operatingExpenses)})</TableCell>
                  </TableRow>

                  <TableRow className="font-bold text-lg bg-primary/10">
                    <TableCell>Net Income</TableCell>
                    <TableCell className={`text-right ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(netIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {Object.keys(expensesByCategory).length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Expense Breakdown by Category</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(expensesByCategory).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                          <TableCell className="text-right">
                            {((amount / totalExpenses) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Balance Sheet</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV([
                { Category: "Cash & Bank", Type: "Asset", Amount: totalCashBalance },
                { Category: "Inventory", Type: "Asset", Amount: totalInventoryValue },
                { Category: "Accounts Receivable", Type: "Asset", Amount: invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.total, 0) },
              ], "balance-sheet")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell>ASSETS</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  
                  <TableRow className="font-semibold">
                    <TableCell className="pl-4">Current Assets</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Cash & Bank Accounts</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCashBalance)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Accounts Receivable (Unpaid Invoices)</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total || 0), 0))}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Inventory</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalInventoryValue)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell className="pl-4">Total Current Assets</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalCashBalance + totalInventoryValue + invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total || 0), 0))}
                    </TableCell>
                  </TableRow>

                  <TableRow className="font-bold bg-muted/30">
                    <TableCell>LIABILITIES</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  
                  <TableRow className="font-semibold">
                    <TableCell className="pl-4">Current Liabilities</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Accounts Payable (Unpaid Bills)</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bills.filter(b => b.status !== "paid").reduce((s, b) => s + (b.total || 0), 0))}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell className="pl-4">Total Liabilities</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bills.filter(b => b.status !== "paid").reduce((s, b) => s + (b.total || 0), 0))}
                    </TableCell>
                  </TableRow>

                  <TableRow className="font-bold bg-muted/30">
                    <TableCell>EQUITY</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Retained Earnings</TableCell>
                    <TableCell className="text-right">{formatCurrency(netIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cash Flow Statement</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV([
                { Activity: "Cash from Operations", Amount: totalRevenue - operatingExpenses },
              ], "cash-flow")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Inflow</TableHead>
                    <TableHead className="text-right">Outflow</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={4}>Operating Activities</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4">Cash from Sales</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(totalRevenue)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4">Payments for Expenses</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalExpenses)})</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalExpenses)})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4">Payments to Vendors</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalBills)})</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalBills)})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4">Payroll Payments</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalPayroll)})</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalPayroll)})</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell className="pl-4">Net Cash from Operations</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                    <TableCell className="text-right">({formatCurrency(operatingExpenses)})</TableCell>
                    <TableCell className={`text-right ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(netIncome)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="font-bold bg-primary/10">
                    <TableCell>Cash Balance</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalCashBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Trial Balance</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCSV([
                { Account: "Cash & Bank", Debit: totalCashBalance, Credit: 0 },
                { Account: "Accounts Receivable", Debit: invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.total, 0), Credit: 0 },
                { Account: "Inventory", Debit: totalInventoryValue, Credit: 0 },
                { Account: "Accounts Payable", Debit: 0, Credit: bills.filter(b => b.status !== "paid").reduce((s, b) => s + b.total, 0) },
                { Account: "Revenue", Debit: 0, Credit: totalRevenue },
                { Account: "Expenses", Debit: operatingExpenses, Credit: 0 },
              ], "trial-balance")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Cash & Bank Accounts</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCashBalance)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Accounts Receivable</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total || 0), 0))}
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Inventory</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalInventoryValue)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Accounts Payable</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bills.filter(b => b.status !== "paid").reduce((s, b) => s + (b.total || 0), 0))}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Revenue</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Operating Expenses</TableCell>
                    <TableCell className="text-right">{formatCurrency(operatingExpenses)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell>TOTALS</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalCashBalance + totalInventoryValue + operatingExpenses + invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total || 0), 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalRevenue + bills.filter(b => b.status !== "paid").reduce((s, b) => s + (b.total || 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialReports;
