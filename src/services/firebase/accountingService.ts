import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { assertFirebaseConfigured, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { callFunction } from "@/services/firebase/functionsService";
import type { JournalEntryInput } from "@/services/firebase/types";

export interface JournalLineRecord {
  id: string;
  companyId: string;
  entryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  entryDate: string;
  isPosted: boolean;
}

export interface GLBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debitTotal: number;
  creditTotal: number;
  netMovement: number;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitBalance: number;
  creditBalance: number;
}

export interface ProfitLossReport {
  startDate: string;
  endDate: string;
  income: Array<{ accountId: string; accountCode: string; accountName: string; balance: number }>;
  expenses: Array<{ accountId: string; accountCode: string; accountName: string; balance: number }>;
  totalIncome: number;
  totalExpenses: number;
  netProfitLoss: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: Array<{ accountId: string; accountCode: string; accountName: string; balance: number }>;
  liabilities: Array<{ accountId: string; accountCode: string; accountName: string; balance: number }>;
  equity: Array<{ accountId: string; accountCode: string; accountName: string; balance: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  liabilitiesPlusEquity: number;
  isBalanced: boolean;
}

export interface TrialBalanceReport {
  startDate: string | null;
  endDate: string | null;
  rows: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebits: number;
    totalCredits: number;
    closingBalance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface DashboardLiveMetrics {
  month: string;
  totalExpensesThisMonth: number;
  bankDefaultBalance: number;
  outstandingAccountsPayable: number;
  outstandingAccountsReceivable: number;
  monthlyProfit: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

type MetricsRow = Record<string, unknown> & { id: string };

const normalizeMetricKey = (value: string) => value.toLowerCase().replace(/[_\s-]/g, "");

const getMetricValue = (row: MetricsRow, keys: string[]): unknown => {
  const normalizedEntries = new Map<string, unknown>(
    Object.entries(row).map(([key, value]) => [normalizeMetricKey(key), value]),
  );

  for (const key of keys) {
    const direct = row[key];
    if (direct !== undefined && direct !== null) return direct;

    const normalized = normalizedEntries.get(normalizeMetricKey(key));
    if (normalized !== undefined && normalized !== null) return normalized;
  }

  return null;
};

const readMetricNumber = (row: MetricsRow, keys: string[], fallback = 0): number => {
  const parsed = Number(getMetricValue(row, keys));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readMetricString = (row: MetricsRow, keys: string[], fallback = ""): string => {
  const value = getMetricValue(row, keys);
  return typeof value === "string" ? value : fallback;
};

const readMetricDate = (row: MetricsRow, keys: string[]): Date | null => {
  const value = getMetricValue(row, keys);
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: unknown };
    if (typeof maybeTimestamp.toDate === "function") {
      const parsed = maybeTimestamp.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const seconds = Number(maybeTimestamp.seconds);
    if (Number.isFinite(seconds)) {
      const parsed = new Date(seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
};

const isClosedStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return ["paid", "settled", "completed", "cancelled", "canceled", "void", "voided"].includes(normalized);
};

const queryCompanyRows = async (collectionName: string, companyId: string): Promise<MetricsRow[]> => {
  const rows = new Map<string, MetricsRow>();
  const candidates = [
    query(collection(firestore, collectionName), where("companyId", "==", companyId), limit(1000)),
    query(collection(firestore, collectionName), where("company_id", "==", companyId), limit(1000)),
  ];

  for (const candidate of candidates) {
    try {
      const snapshot = await getDocs(candidate);
      snapshot.docs.forEach((docSnap) => {
        rows.set(docSnap.id, {
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        });
      });
    } catch {
      continue;
    }
  }

  return Array.from(rows.values());
};

const isCurrentMonthRow = (row: MetricsRow, keys: string[]) => {
  const rowDate = readMetricDate(row, keys);
  if (!rowDate) return false;

  const now = new Date();
  return rowDate.getUTCFullYear() === now.getUTCFullYear()
    && rowDate.getUTCMonth() === now.getUTCMonth();
};

const resolveInvoiceAmount = (row: MetricsRow) => (
  readMetricNumber(row, ["totalAmount", "total", "grandTotal", "invoiceTotal", "amount"])
);

const resolveExpenseAmount = (row: MetricsRow) => (
  readMetricNumber(row, ["amount", "totalAmount", "grossAmount", "expenseAmount", "total"])
);

const resolveOutstandingAmount = (
  row: MetricsRow,
  balanceKeys: string[],
  totalKeys: string[],
  statusKeys: string[],
) => {
  const explicitBalance = readMetricNumber(row, balanceKeys, Number.NaN);
  if (Number.isFinite(explicitBalance)) {
    return Math.max(explicitBalance, 0);
  }

  if (isClosedStatus(readMetricString(row, statusKeys))) {
    return 0;
  }

  return Math.max(readMetricNumber(row, totalKeys), 0);
};

const getLocalDashboardLiveMetrics = async (companyId: string): Promise<DashboardLiveMetrics> => {
  const [invoices, bills, expenses, bankAccounts] = await Promise.all([
    queryCompanyRows(COLLECTIONS.INVOICES, companyId),
    queryCompanyRows(COLLECTIONS.BILLS, companyId),
    queryCompanyRows(COLLECTIONS.EXPENSES, companyId),
    queryCompanyRows(COLLECTIONS.BANK_ACCOUNTS, companyId),
  ]);

  const month = new Date().toISOString().slice(0, 7);
  const monthlyIncome = invoices
    .filter((row) => isCurrentMonthRow(row, ["invoiceDate", "issueDate", "date", "createdAt"]))
    .reduce((sum, row) => sum + resolveInvoiceAmount(row), 0);
  const monthlyExpenses = expenses
    .filter((row) => isCurrentMonthRow(row, ["expenseDate", "date", "transactionDate", "createdAt"]))
    .reduce((sum, row) => sum + resolveExpenseAmount(row), 0);
  const bankDefaultBalance = bankAccounts.reduce(
    (sum, row) => sum + readMetricNumber(row, ["currentBalance", "balance", "closingBalance", "ledgerBalance"]),
    0,
  );
  const outstandingAccountsPayable = bills.reduce(
    (sum, row) => sum + resolveOutstandingAmount(
      row,
      ["balanceDue", "remainingBalance", "amountDue", "outstandingAmount"],
      ["totalAmount", "total", "grandTotal", "amount"],
      ["status", "paymentStatus"],
    ),
    0,
  );
  const outstandingAccountsReceivable = invoices.reduce(
    (sum, row) => sum + resolveOutstandingAmount(
      row,
      ["balanceDue", "remainingBalance", "amountDue", "outstandingAmount"],
      ["totalAmount", "total", "grandTotal", "amount"],
      ["status", "paymentStatus"],
    ),
    0,
  );

  return {
    month,
    totalExpensesThisMonth: monthlyExpenses,
    bankDefaultBalance,
    outstandingAccountsPayable,
    outstandingAccountsReceivable,
    monthlyProfit: monthlyIncome - monthlyExpenses,
    monthlyIncome,
    monthlyExpenses,
  };
};

const shouldUseLocalDashboardMetrics = () => (
  typeof window !== "undefined"
  && ["localhost", "127.0.0.1"].includes(window.location.hostname)
);

export const accountingService = {
  async getPostedJournalLines(companyId: string, startDate?: string, endDate?: string): Promise<JournalLineRecord[]> {
    assertFirebaseConfigured();

    const linesRef = collection(firestore, COLLECTIONS.JOURNAL_LINES);
    const constraints = [
      where("companyId", "==", companyId),
      where("isPosted", "==", true),
      orderBy("entryDate", "desc"),
      limit(5000),
    ];

    if (startDate) {
      constraints.push(where("entryDate", ">=", startDate));
    }
    if (endDate) {
      constraints.push(where("entryDate", "<=", endDate));
    }

    const snapshot = await getDocs(query(linesRef, ...constraints));
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<JournalLineRecord, "id">),
    }));
  },

  async postJournalEntry(input: JournalEntryInput): Promise<{ entryId: string }> {
    return callFunction<JournalEntryInput, { entryId: string }>("postJournalEntry", input);
  },

  async getGLBalances(input: {
    companyId: string;
    startDate: string;
    endDate: string;
  }): Promise<GLBalanceRow[]> {
    return callFunction<typeof input, GLBalanceRow[]>("getGLBalances", input);
  },

  async getTrialBalance(input: {
    companyId: string;
    asOfDate: string;
  }): Promise<TrialBalanceRow[]> {
    return callFunction<typeof input, TrialBalanceRow[]>("getTrialBalance", input);
  },

  async postInvoiceToGL(invoiceId: string): Promise<{ journalEntryId: string }> {
    return callFunction<{ invoiceId: string }, { journalEntryId: string }>("postInvoiceToGL", { invoiceId });
  },

  async postBillToGL(billId: string): Promise<{ journalEntryId: string }> {
    return callFunction<{ billId: string }, { journalEntryId: string }>("postBillToGL", { billId });
  },

  async postExpenseToGL(expenseId: string): Promise<{ journalEntryId: string }> {
    return callFunction<{ expenseId: string }, { journalEntryId: string }>("postExpenseToGL", { expenseId });
  },

  async seedDefaultChartOfAccounts(input: { companyId: string }): Promise<{ success: boolean; accountsSeeded: number }> {
    return callFunction<typeof input, { success: boolean; accountsSeeded: number }>("seedDefaultChartOfAccounts", input);
  },

  async seedDefaultExpenseCategories(input: { companyId: string }): Promise<{ success: boolean; categoriesSeeded: number }> {
    return callFunction<typeof input, { success: boolean; categoriesSeeded: number }>("seedDefaultExpenseCategories", input);
  },

  async recordExpense(input: {
    companyId: string;
    amount: number;
    categoryId?: string;
    categoryName?: string;
    paymentMethod: string;
    paymentAccountId: string;
    expenseDate: string;
    description?: string;
    receiptUrl?: string;
  }): Promise<{ expenseId: string; journalEntryId: string }> {
    return callFunction<typeof input, { expenseId: string; journalEntryId: string }>("recordExpense", input);
  },

  async createBill(input: {
    companyId: string;
    supplierId?: string;
    vendorId?: string;
    amount: number;
    categoryId?: string;
    categoryName?: string;
    billDate: string;
    dueDate: string;
    description?: string;
  }): Promise<{ billId: string; journalEntryId: string }> {
    return callFunction<typeof input, { billId: string; journalEntryId: string }>("createBill", input);
  },

  async payBill(input: {
    companyId: string;
    billId: string;
    amount: number;
    paymentDate: string;
    paymentAccountId: string;
    notes?: string;
  }): Promise<{ paymentId: string; journalEntryId: string; billStatus: string }> {
    return callFunction<typeof input, { paymentId: string; journalEntryId: string; billStatus: string }>("payBill", input);
  },

  async createInvoice(input: {
    companyId: string;
    customerId?: string;
    invoiceNumber?: string;
    invoiceDate: string;
    dueDate: string;
    status?: string;
    notes?: string;
    quotationId?: string;
    revenueAccountId?: string;
    taxAmount?: number;
    totalAmount?: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<{ invoiceId: string; journalEntryId: string; invoiceNumber: string }> {
    return callFunction<typeof input, { invoiceId: string; journalEntryId: string; invoiceNumber: string }>("createInvoice", input);
  },

  async updateInvoiceStatus(input: {
    companyId: string;
    invoiceId: string;
    status: string;
  }): Promise<{ invoiceId: string; status: string }> {
    return callFunction<typeof input, { invoiceId: string; status: string }>("updateInvoiceStatus", input);
  },

  async recordInvoicePayment(input: {
    companyId: string;
    invoiceId: string;
    amount: number;
    paymentDate: string;
    paymentAccountId: string;
    notes?: string;
  }): Promise<{ paymentId: string; journalEntryId: string; invoiceStatus: string }> {
    return callFunction<typeof input, { paymentId: string; journalEntryId: string; invoiceStatus: string }>("recordInvoicePayment", input);
  },

  async createQuotation(input: {
    companyId: string;
    customerId?: string;
    quotationNumber?: string;
    quotationDate: string;
    validUntil: string;
    status?: string;
    notes?: string;
    taxAmount?: number;
    totalAmount?: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<{ quotationId: string; quotationNumber: string }> {
    return callFunction<typeof input, { quotationId: string; quotationNumber: string }>("createQuotation", input);
  },

  async reverseJournalEntry(input: {
    companyId: string;
    journalEntryId: string;
    reason?: string;
    reversalDate?: string;
  }): Promise<{ originalEntryId: string; reversalEntryId: string }> {
    return callFunction<typeof input, { originalEntryId: string; reversalEntryId: string }>("reverseJournalEntry", input);
  },

  async deleteChartOfAccount(input: {
    companyId: string;
    accountId: string;
  }): Promise<{ deleted: boolean; accountId: string }> {
    return callFunction<typeof input, { deleted: boolean; accountId: string }>("deleteChartOfAccount", input);
  },

  async updateOverdueBills(input: { companyId: string }): Promise<{ updated: number }> {
    return callFunction<typeof input, { updated: number }>("updateOverdueBills", input);
  },


  async getExpenseReport(input: {
    companyId: string;
    startDate: string;
    endDate: string;
  }): Promise<{
    startDate: string;
    endDate: string;
    rows: Array<{
      expenseAccount: string;
      entryDate: string;
      description: string | null;
      referenceType: string | null;
      amount: number;
    }>;
  }> {
    return callFunction<typeof input, {
      startDate: string;
      endDate: string;
      rows: Array<{
        expenseAccount: string;
        entryDate: string;
        description: string | null;
        referenceType: string | null;
        amount: number;
      }>;
    }>("getExpenseReport", input);
  },

  async getGeneralLedger(input: {
    companyId: string;
    accountId: string;
    startDate: string;
    endDate: string;
  }): Promise<{
    accountId: string;
    accountCode: string;
    accountName: string;
    startDate: string;
    endDate: string;
    rows: Array<{
      entryDate: string;
      description: string | null;
      referenceType: string | null;
      referenceId: string | null;
      debitAmount: number;
      creditAmount: number;
      runningBalance: number;
    }>;
  }> {
    return callFunction<typeof input, {
      accountId: string;
      accountCode: string;
      accountName: string;
      startDate: string;
      endDate: string;
      rows: Array<{
        entryDate: string;
        description: string | null;
        referenceType: string | null;
        referenceId: string | null;
        debitAmount: number;
        creditAmount: number;
        runningBalance: number;
      }>;
    }>("getGeneralLedger", input);
  },

  async getProfitLossReport(input: { companyId: string; startDate: string; endDate: string }): Promise<ProfitLossReport> {
    return callFunction<typeof input, ProfitLossReport>("getProfitLossReport", input);
  },

  async getBalanceSheetReport(input: { companyId: string; asOfDate: string }): Promise<BalanceSheetReport> {
    return callFunction<typeof input, BalanceSheetReport>("getBalanceSheetReport", input);
  },

  async getTrialBalanceReport(input: { companyId: string; startDate?: string; endDate?: string }): Promise<TrialBalanceReport> {
    return callFunction<typeof input, TrialBalanceReport>("getTrialBalanceReport", input);
  },

  async getCashFlowReport(input: { companyId: string; startDate: string; endDate: string }): Promise<{
    startDate: string;
    endDate: string;
    rows: Array<{
      entryDate: string;
      description: string | null;
      referenceType: string | null;
      moneyIn: number;
      moneyOut: number;
      account: string | null;
    }>;
  }> {
    return callFunction<typeof input, {
      startDate: string;
      endDate: string;
      rows: Array<{
        entryDate: string;
        description: string | null;
        referenceType: string | null;
        moneyIn: number;
        moneyOut: number;
        account: string | null;
      }>;
    }>("getCashFlowReport", input);
  },

  async getDashboardLiveMetrics(input: { companyId: string }): Promise<DashboardLiveMetrics> {
    if (shouldUseLocalDashboardMetrics()) {
      return getLocalDashboardLiveMetrics(input.companyId);
    }

    try {
      return await callFunction<typeof input, DashboardLiveMetrics>("getDashboardLiveMetrics", input);
    } catch (error) {
      console.warn("Falling back to local dashboard metrics:", error);
      return getLocalDashboardLiveMetrics(input.companyId);
    }
  },
};
