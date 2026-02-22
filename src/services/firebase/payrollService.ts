import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { assertFirebaseConfigured, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { callFunction } from "@/services/firebase/functionsService";
import type { RunDepreciationInput } from "@/services/firebase/types";

export interface PayrollRunRecord {
  id: string;
  companyId: string;
  payrollNumber?: string;
  periodStart: string;
  periodEnd: string;
  runDate: string;
  payrollStatus: "draft" | "processed" | "paid" | "trial" | "final" | "reversed" | "payment_reversed";
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  journalEntryId?: string | null;
  paymentJournalEntryId?: string | null;
  reversalJournalEntryId?: string | null;
  paymentReversalJournalEntryId?: string | null;
  paymentReversalReason?: string | null;
  paymentReversedBy?: string | null;
  paymentReversedAt?: string | null;
  reversalReferenceId?: string | null;
  reversalReason?: string | null;
  reversedBy?: string | null;
  reversedAt?: string | null;
  glPosted?: boolean;
  glJournalId?: string | null;
}

export interface PayrollDraftEmployeeInput {
  employeeId?: string;
  employeeName: string;
  grossSalary: number;
  payeDeduction?: number;
  napsaDeduction?: number;
  nhimaDeduction?: number;
  otherDeductions?: number;
  netSalary?: number;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  advancesDeducted?: number;
}

export const payrollService = {
  async getPayrollRuns(companyId: string): Promise<PayrollRunRecord[]> {
    assertFirebaseConfigured();
    const runsRef = collection(firestore, COLLECTIONS.PAYROLL_RUNS);
    const snapshot = await getDocs(
      query(runsRef, where("companyId", "==", companyId), orderBy("runDate", "desc")),
    );
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<PayrollRunRecord, "id">),
    }));
  },

  async createPayrollDraft(input: {
    companyId: string;
    periodStart?: string;
    periodEnd?: string;
    runDate?: string;
    periodLabel?: string;
    notes?: string;
    employees: PayrollDraftEmployeeInput[];
    additions?: Array<{
      employeeId?: string;
      type?: string;
      name?: string;
      amount?: number;
      totalAmount?: number;
      monthsToPay?: number;
      monthlyDeduction?: number;
    }>;
  }): Promise<{ payrollRunId: string; status: "Draft" }> {
    return callFunction<typeof input, { payrollRunId: string; status: "Draft" }>("createPayrollDraft", input);
  },

  async runPayrollTrial(input: { payrollRunId: string }): Promise<{ success: boolean }> {
    return callFunction<typeof input, { success: boolean }>("runPayrollTrial", input);
  },

  async processPayroll(input: { payrollRunId: string }): Promise<{
    payrollRunId: string;
    journalEntryId: string;
    status: "Processed";
  }> {
    return callFunction<typeof input, {
      payrollRunId: string;
      journalEntryId: string;
      status: "Processed";
    }>("processPayroll", input);
  },

  async payPayroll(input: { payrollRunId: string; paymentAccountId: string; paymentDate?: string }): Promise<{
    payrollRunId: string;
    journalEntryId: string;
    status: "Paid";
  }> {
    return callFunction<typeof input, {
      payrollRunId: string;
      journalEntryId: string;
      status: "Paid";
    }>("payPayroll", input);
  },

  async reversePayroll(input: {
    payrollRunId: string;
    reason: string;
    reversalDate?: string;
  }): Promise<{
    payrollRunId: string;
    payrollJournalEntryId: string;
    paymentJournalEntryId: string | null;
    reversalJournalEntryId: string;
    paymentReversalJournalEntryId: string | null;
    status: "Reversed";
  }> {
    return callFunction<typeof input, {
      payrollRunId: string;
      payrollJournalEntryId: string;
      paymentJournalEntryId: string | null;
      reversalJournalEntryId: string;
      paymentReversalJournalEntryId: string | null;
      status: "Reversed";
    }>("reversePayroll", input);
  },

  async reversePayrollPayment(input: {
    payrollRunId: string;
    reason: string;
    reversalDate?: string;
  }): Promise<{
    payrollRunId: string;
    paymentJournalEntryId: string;
    paymentReversalJournalEntryId: string;
    status: "Payment Reversed";
  }> {
    return callFunction<typeof input, {
      payrollRunId: string;
      paymentJournalEntryId: string;
      paymentReversalJournalEntryId: string;
      status: "Payment Reversed";
    }>("reversePayrollPayment", input);
  },

  async finalizePayroll(input: { payrollRunId: string }): Promise<{
    payrollRunId: string;
    journalEntryId: string;
    status: "Processed";
  }> {
    // Backward-compatible alias to process payroll.
    return callFunction<typeof input, {
      payrollRunId: string;
      journalEntryId: string;
      status: "Processed";
    }>("finalizePayroll", input);
  },

  async sendPayslipEmail(input: {
    payrollRunId: string;
    employeeId: string;
  }): Promise<{ success: boolean }> {
    return callFunction<typeof input, { success: boolean }>("sendPayslipEmail", input);
  },

  async runDepreciation(input: RunDepreciationInput): Promise<{
    success: boolean;
    assetsProcessed: number;
    totalDepreciation: number;
  }> {
    return callFunction<RunDepreciationInput, {
      success: boolean;
      assetsProcessed: number;
      totalDepreciation: number;
    }>("runDepreciation", input);
  },
};
