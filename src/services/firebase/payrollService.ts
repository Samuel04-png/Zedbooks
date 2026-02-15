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
  payrollStatus: "draft" | "trial" | "final" | "reversed";
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  glPosted?: boolean;
  glJournalId?: string | null;
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
    periodStart: string;
    periodEnd: string;
    runDate: string;
    notes?: string;
  }): Promise<{ payrollRunId: string }> {
    return callFunction<typeof input, { payrollRunId: string }>("createPayrollDraft", input);
  },

  async runPayrollTrial(input: { payrollRunId: string }): Promise<{ success: boolean }> {
    return callFunction<typeof input, { success: boolean }>("runPayrollTrial", input);
  },

  async finalizePayroll(input: { payrollRunId: string }): Promise<{ journalEntryId?: string }> {
    return callFunction<typeof input, { journalEntryId?: string }>("finalizePayroll", input);
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

