import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { assertFirebaseConfigured, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { callFunction } from "@/services/firebase/functionsService";
import type { AppRole, Company, CompanySettings, CompanyUser } from "@/services/firebase/types";

export interface CompanySetupInput {
  companyId: string;
  name: string;
  organizationType: "business" | "non_profit";
  businessType?: string;
  taxType?: string;
  taxClassification?: string;
  address?: string;
  phone?: string;
  email?: string;
  tpin?: string;
  registrationNumber?: string;
  industryType?: string;
  logoUrl?: string | null;
  isVatRegistered?: boolean;
  vatRate?: number | null;
}

export interface CompanyUserSummary {
  id: string;
  companyId: string;
  userId: string;
  role: AppRole;
  status: "active" | "invited" | "suspended";
  email: string | null;
  fullName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const asStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.trim() ? text : null;
};

const normalizeMembership = (id: string, row: Record<string, unknown>): CompanyUser => ({
  id,
  companyId: String(row.companyId ?? row.company_id ?? ""),
  userId: String(row.userId ?? row.user_id ?? ""),
  role: (row.role as CompanyUser["role"]) ?? "read_only",
  status: (row.status as CompanyUser["status"]) ?? "active",
  createdAt: String(row.createdAt ?? row.created_at ?? ""),
  updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
});

const normalizeCompany = (id: string, row: Record<string, unknown>): Company => ({
  id,
  name: String(row.name ?? row.companyName ?? row.company_name ?? ""),
  organizationType: (row.organizationType ?? row.organization_type ?? "business") as Company["organizationType"],
  businessType: asStringOrNull(row.businessType ?? row.business_type) ?? undefined,
  taxType: asStringOrNull(row.taxType ?? row.tax_type) ?? undefined,
  taxClassification: asStringOrNull(row.taxClassification ?? row.tax_classification) ?? undefined,
  tpin: asStringOrNull(row.tpin) ?? undefined,
  phone: asStringOrNull(row.phone) ?? undefined,
  email: asStringOrNull(row.email) ?? undefined,
  logoUrl: asStringOrNull(row.logoUrl ?? row.logo_url) ?? null,
  createdAt: String(row.createdAt ?? row.created_at ?? ""),
  updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
});

const normalizeSettings = (id: string, row: Record<string, unknown>): CompanySettings => ({
  id,
  companyId: String(row.companyId ?? row.company_id ?? id),
  companyName: String(row.companyName ?? row.company_name ?? ""),
  isVatRegistered: Boolean(row.isVatRegistered ?? row.is_vat_registered ?? false),
  vatRate: row.vatRate === null || row.vatRate === undefined
    ? Number(row.vat_rate ?? 0) || null
    : Number(row.vatRate),
  logoUrl: asStringOrNull(row.logoUrl ?? row.logo_url) ?? null,
  createdAt: String(row.createdAt ?? row.created_at ?? ""),
  updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
});

export const companyService = {
  async getPrimaryMembershipByUser(userId: string): Promise<CompanyUser | null> {
    assertFirebaseConfigured();
    const membershipsRef = collection(firestore, COLLECTIONS.COMPANY_USERS);

    const candidates = [
      query(membershipsRef, where("userId", "==", userId), where("status", "==", "active"), limit(1)),
      query(membershipsRef, where("user_id", "==", userId), where("status", "==", "active"), limit(1)),
      query(membershipsRef, where("userId", "==", userId), limit(1)),
      query(membershipsRef, where("user_id", "==", userId), limit(1)),
    ];

    for (const candidate of candidates) {
      const snapshot = await getDocs(candidate);
      if (snapshot.empty) continue;

      const membership = snapshot.docs[0];
      return normalizeMembership(membership.id, membership.data() as Record<string, unknown>);
    }

    return null;
  },

  async getCompanyById(companyId: string): Promise<Company | null> {
    assertFirebaseConfigured();
    const companyRef = doc(firestore, COLLECTIONS.COMPANIES, companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) return null;
    return normalizeCompany(companySnap.id, companySnap.data() as Record<string, unknown>);
  },

  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    assertFirebaseConfigured();
    const settingsRef = doc(firestore, COLLECTIONS.COMPANY_SETTINGS, companyId);
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) return null;
    return normalizeSettings(settingsSnap.id, settingsSnap.data() as Record<string, unknown>);
  },

  async completeCompanySetup(input: CompanySetupInput): Promise<void> {
    assertFirebaseConfigured();

    const companyRef = doc(firestore, COLLECTIONS.COMPANIES, input.companyId);
    await setDoc(
      companyRef,
      {
        name: input.name,
        organizationType: input.organizationType,
        businessType: input.businessType ?? null,
        taxType: input.taxType ?? null,
        taxClassification: input.taxClassification ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        tpin: input.tpin ?? null,
        registrationNumber: input.registrationNumber ?? null,
        industryType: input.industryType ?? null,
        logoUrl: input.logoUrl ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    const settingsRef = doc(firestore, COLLECTIONS.COMPANY_SETTINGS, input.companyId);
    await setDoc(
      settingsRef,
      {
        companyId: input.companyId,
        companyName: input.name,
        logoUrl: input.logoUrl ?? null,
        isVatRegistered: Boolean(input.isVatRegistered),
        vatRate: input.vatRate ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  },

  async updateCompanyLogo(companyId: string, logoUrl: string): Promise<void> {
    assertFirebaseConfigured();
    const companyRef = doc(firestore, COLLECTIONS.COMPANIES, companyId);
    await updateDoc(companyRef, {
      logoUrl,
      updatedAt: serverTimestamp(),
    });

    const settingsRef = doc(firestore, COLLECTIONS.COMPANY_SETTINGS, companyId);
    await setDoc(
      settingsRef,
      {
        companyId,
        logoUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  },

  async updateCompanyBasics(input: {
    companyId: string;
    name?: string;
    logoUrl?: string | null;
  }): Promise<void> {
    assertFirebaseConfigured();

    const companyRef = doc(firestore, COLLECTIONS.COMPANIES, input.companyId);
    const settingsRef = doc(firestore, COLLECTIONS.COMPANY_SETTINGS, input.companyId);

    const companyPayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    const settingsPayload: Record<string, unknown> = {
      companyId: input.companyId,
      updatedAt: serverTimestamp(),
    };

    if (typeof input.name === "string") {
      companyPayload.name = input.name;
      settingsPayload.companyName = input.name;
    }

    if (input.logoUrl !== undefined) {
      companyPayload.logoUrl = input.logoUrl;
      settingsPayload.logoUrl = input.logoUrl;
    }

    await setDoc(companyRef, companyPayload, { merge: true });
    await setDoc(settingsRef, settingsPayload, { merge: true });
  },

  async listCompanyUsers(companyId: string): Promise<CompanyUserSummary[]> {
    assertFirebaseConfigured();
    return callFunction<{ companyId: string }, CompanyUserSummary[]>("listCompanyUsers", { companyId });
  },

  async updateUserRole(input: {
    companyId: string;
    userId: string;
    newRole: AppRole;
  }): Promise<{ success: boolean }> {
    assertFirebaseConfigured();
    return callFunction<typeof input, { success: boolean }>("updateUserRole", input);
  },

  async removeCompanyUser(input: {
    companyId: string;
    userId: string;
  }): Promise<{ success: boolean }> {
    assertFirebaseConfigured();
    return callFunction<typeof input, { success: boolean }>("removeCompanyUser", input);
  },

  async suspendUser(input: { companyId: string; userId: string }): Promise<{ success: boolean }> {
    assertFirebaseConfigured();
    return callFunction<typeof input, { success: boolean }>("suspendUser", input);
  },

  async reactivateUser(input: { companyId: string; userId: string }): Promise<{ success: boolean }> {
    assertFirebaseConfigured();
    return callFunction<typeof input, { success: boolean }>("reactivateUser", input);
  },

  async revokeInvitation(input: { companyId: string; invitationId: string }): Promise<{ success: boolean }> {
    assertFirebaseConfigured();
    return callFunction<typeof input, { success: boolean }>("revokeInvitation", input);
  },
};
