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
  payrollStatus: "draft" | "processed" | "paid" | "trial" | "final" | "reversed";
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
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
