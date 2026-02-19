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
    return callFunction<typeof input, DashboardLiveMetrics>("getDashboardLiveMetrics", input);
  },
};
