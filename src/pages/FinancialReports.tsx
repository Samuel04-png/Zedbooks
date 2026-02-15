import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, BarChart3, PieChart, TrendingUp, BookOpen } from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { accountingService, companyService } from "@/services/firebase";
import type { GLBalanceRow } from "@/services/firebase/accountingService";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface AccountBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  debit_total: number;
  credit_total: number;
  balance: number;
}

const normalizeAccountType = (rawType: string): AccountType => {
  const normalized = rawType.toLowerCase();
  if (normalized === "revenue") {
    return "income";
  }

  if (
    normalized === "asset" ||
    normalized === "liability" ||
    normalized === "equity" ||
    normalized === "income" ||
    normalized === "expense"
  ) {
    return normalized;
  }

  return "expense";
};

const isDebitNormalAccount = (accountType: AccountType) => {
  return accountType === "asset" || accountType === "expense";
};

const computeAccountBalance = (accountType: AccountType, debitTotal: number, creditTotal: number) => {
  return isDebitNormalAccount(accountType)
    ? debitTotal - creditTotal
    : creditTotal - debitTotal;
};

const mapBalancesFromGL = (rows: GLBalanceRow[]): AccountBalanceRow[] => {
  return rows
    .map((row) => {
      const accountType = normalizeAccountType(row.accountType);
      const debitTotal = Number(row.debitTotal ?? 0);
      const creditTotal = Number(row.creditTotal ?? 0);
      return {
        account_id: row.accountId,
        account_code: String(row.accountCode ?? ""),
        account_name: String(row.accountName ?? ""),
        account_type: accountType,
        debit_total: debitTotal,
        credit_total: creditTotal,
        balance: computeAccountBalance(accountType, debitTotal, creditTotal),
      } satisfies AccountBalanceRow;
    })
    .sort((a, b) => a.account_code.localeCompare(b.account_code));
};

const sumBalancesByType = (rows: AccountBalanceRow[], accountType: AccountType) => {
  return rows
    .filter((row) => row.account_type === accountType)
    .reduce((total, row) => total + row.balance, 0);
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const toCSVValue = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) return "";
  return String(value).replaceAll('"', '""');
};

const downloadCSV = (
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  filename: string,
) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => `"${toCSVValue(row[header])}"`).join(","));
  const csv = [headers.join(","), ...body].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const FinancialReports = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const isDateRangeValid = startDate <= endDate;

  const companyQuery = useQuery({
    queryKey: ["financial-reports-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const companyId = companyQuery.data ?? null;

  const periodBalancesQuery = useQuery({
    queryKey: ["financial-reports-gl-period", companyId, startDate, endDate],
    queryFn: () =>
      accountingService.getGLBalances({
        companyId: companyId as string,
        startDate,
        endDate,
      }),
    enabled: Boolean(companyId) && isDateRangeValid,
  });

  const asOfBalancesQuery = useQuery({
    queryKey: ["financial-reports-gl-as-of", companyId, endDate],
    queryFn: () =>
      accountingService.getGLBalances({
        companyId: companyId as string,
        startDate: "1900-01-01",
        endDate,
      }),
    enabled: Boolean(companyId) && isDateRangeValid,
  });

  const isLoading = companyQuery.isLoading || periodBalancesQuery.isLoading || asOfBalancesQuery.isLoading;
  const isError = companyQuery.isError || periodBalancesQuery.isError || asOfBalancesQuery.isError;

  const periodBalances = useMemo(
    () => mapBalancesFromGL(periodBalancesQuery.data ?? []),
    [periodBalancesQuery.data],
  );

  const asOfBalances = useMemo(
    () => mapBalancesFromGL(asOfBalancesQuery.data ?? []),
    [asOfBalancesQuery.data],
  );

  const incomeRows = periodBalances.filter((row) => row.account_type === "income");
  const expenseRows = periodBalances.filter((row) => row.account_type === "expense");

  const periodRevenue = sumBalancesByType(periodBalances, "income");
  const periodExpenses = sumBalancesByType(periodBalances, "expense");
  const netIncome = periodRevenue - periodExpenses;

  const totalAssets = sumBalancesByType(asOfBalances, "asset");
  const totalLiabilities = sumBalancesByType(asOfBalances, "liability");
  const totalEquityWithoutRetained = sumBalancesByType(asOfBalances, "equity");
  const retainedEarnings = sumBalancesByType(asOfBalances, "income") - sumBalancesByType(asOfBalances, "expense");
  const totalEquity = totalEquityWithoutRetained + retainedEarnings;

  const cashLikeAccounts = asOfBalances.filter(
    (row) => row.account_type === "asset" && /cash|bank/i.test(row.account_name),
  );

  const closingCashBalance = cashLikeAccounts.reduce((total, row) => total + row.balance, 0);
  const periodCashMovement = periodBalances
    .filter((row) => row.account_type === "asset" && /cash|bank/i.test(row.account_name))
    .reduce((total, row) => total + row.balance, 0);
  const operatingInflowProxy = incomeRows.reduce((total, row) => total + row.credit_total, 0);
  const operatingOutflowProxy = expenseRows.reduce((total, row) => total + row.debit_total, 0);

  const trialBalanceRows = asOfBalances.map((row) => {
    const netByLedger = row.debit_total - row.credit_total;
    return {
      ...row,
      debit_balance: netByLedger > 0 ? netByLedger : 0,
      credit_balance: netByLedger < 0 ? Math.abs(netByLedger) : 0,
    };
  });

  const trialDebitTotal = trialBalanceRows.reduce((total, row) => total + row.debit_balance, 0);
  const trialCreditTotal = trialBalanceRows.reduce((total, row) => total + row.credit_balance, 0);

  if (!isDateRangeValid) {
    return (
      <ErrorState
        title="Invalid date range"
        message="Start date must be before or equal to end date."
      />
    );
  }

  if (!user) {
    return (
      <ErrorState
        title="Not authenticated"
        message="Sign in to view financial reports."
      />
    );
  }

  if (isLoading) {
    return <LoadingState message="Building reports from the general ledger..." className="py-20" />;
  }

  if (!companyId) {
    return (
      <EmptyState
        title="No company membership found"
        description="Your account is not linked to an active company."
        icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  if (isError) {
    const message = companyQuery.error instanceof Error
      ? companyQuery.error.message
      : periodBalancesQuery.error instanceof Error
        ? periodBalancesQuery.error.message
        : asOfBalancesQuery.error instanceof Error
          ? asOfBalancesQuery.error.message
          : undefined;

    return (
      <ErrorState
        title="Failed to load financial reports"
        message={message}
        onRetry={() => {
          companyQuery.refetch();
          periodBalancesQuery.refetch();
          asOfBalancesQuery.refetch();
        }}
      />
    );
  }

  if (!periodBalances.length && !asOfBalances.length) {
    return (
      <EmptyState
        title="No posted journal entries found"
        description="Post journal entries first. Financial reports are generated directly from the general ledger."
        icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">
          All statements below are generated from posted general ledger journal lines only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="report-start-date">Start Date</Label>
              <Input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-end-date">End Date</Label>
              <Input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="income-statement">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="income-statement">
            <TrendingUp className="mr-2 h-4 w-4" />
            Income Statement
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            <PieChart className="mr-2 h-4 w-4" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash-flow">
            <BarChart3 className="mr-2 h-4 w-4" />
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="trial-balance">
            <FileText className="mr-2 h-4 w-4" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="general-ledger">
            <BookOpen className="mr-2 h-4 w-4" />
            GL Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Income Statement (GL-based)</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV(
                    [
                      { category: "Revenue", amount: periodRevenue },
                      { category: "Expenses", amount: periodExpenses },
                      { category: "Net Income", amount: netIncome },
                    ],
                    "income-statement",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
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
                  <TableRow className="font-medium">
                    <TableCell>Total Revenue</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(periodRevenue)}</TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total Expenses</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(periodExpenses)})</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Net Income</TableCell>
                    <TableCell className={`text-right ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(netIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Balance Sheet (as of {endDate})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV(
                    [
                      { section: "Assets", amount: totalAssets },
                      { section: "Liabilities", amount: totalLiabilities },
                      { section: "Equity", amount: totalEquity },
                    ],
                    "balance-sheet",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Total Assets</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalAssets)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Liabilities</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalLiabilities)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Equity (includes retained earnings)</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalEquity)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Liabilities + Equity</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalLiabilities + totalEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cash Flow Summary (GL-derived)</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV(
                    [
                      { metric: "Operating Inflow Proxy", amount: operatingInflowProxy },
                      { metric: "Operating Outflow Proxy", amount: operatingOutflowProxy },
                      { metric: "Net Cash Movement (Cash/Bank Accounts)", amount: periodCashMovement },
                      { metric: "Closing Cash Balance", amount: closingCashBalance },
                    ],
                    "cash-flow-summary",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Operating Inflow Proxy</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(operatingInflowProxy)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Operating Outflow Proxy</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(operatingOutflowProxy)})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Net Cash Movement (Cash/Bank Accounts)</TableCell>
                    <TableCell className={`text-right ${periodCashMovement >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(periodCashMovement)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Closing Cash Balance</TableCell>
                    <TableCell className="text-right">{formatCurrency(closingCashBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                Cash balances are derived from asset accounts with names containing "cash" or "bank".
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Trial Balance (as of {endDate})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV(
                    trialBalanceRows.map((row) => ({
                      account_code: row.account_code,
                      account_name: row.account_name,
                      debit: row.debit_balance,
                      credit: row.credit_balance,
                    })),
                    "trial-balance",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
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
                  {trialBalanceRows.map((row) => (
                    <TableRow key={row.account_id}>
                      <TableCell>{row.account_code} - {row.account_name}</TableCell>
                      <TableCell className="text-right">
                        {row.debit_balance > 0 ? formatCurrency(row.debit_balance) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.credit_balance > 0 ? formatCurrency(row.credit_balance) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Totals</TableCell>
                    <TableCell className="text-right">{formatCurrency(trialDebitTotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(trialCreditTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general-ledger">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>General Ledger Account Movements</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV(
                    periodBalances.map((row) => ({
                      account_code: row.account_code,
                      account_name: row.account_name,
                      account_type: row.account_type,
                      debit_total: row.debit_total,
                      credit_total: row.credit_total,
                      balance: row.balance,
                    })),
                    "general-ledger-summary",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debits</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodBalances.map((row) => (
                    <TableRow key={row.account_id}>
                      <TableCell>{row.account_code} - {row.account_name}</TableCell>
                      <TableCell className="capitalize">{row.account_type}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.debit_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.credit_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                    </TableRow>
                  ))}
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
