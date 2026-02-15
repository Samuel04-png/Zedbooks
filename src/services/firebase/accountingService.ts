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
};

