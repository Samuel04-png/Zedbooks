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
  companyId?: string;
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

const MEMBERSHIP_CACHE_TTL_MS = 5 * 60 * 1000;
const ENTITY_CACHE_TTL_MS = 5 * 60 * 1000;
const membershipCache = new Map<string, { membership: CompanyUser; expiresAt: number }>();
const membershipRequestCache = new Map<string, Promise<CompanyUser | null>>();
const companyCache = new Map<string, { value: Company; expiresAt: number }>();
const companyRequestCache = new Map<string, Promise<Company | null>>();
const settingsCache = new Map<string, { value: CompanySettings; expiresAt: number }>();
const settingsRequestCache = new Map<string, Promise<CompanySettings | null>>();

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
  address: asStringOrNull(row.address) ?? undefined,
  tpin: asStringOrNull(row.tpin) ?? undefined,
  registrationNumber: asStringOrNull(row.registrationNumber ?? row.registration_number) ?? undefined,
  industryType: asStringOrNull(row.industryType ?? row.industry_type) ?? undefined,
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

const normalizeLegacyProfileMembership = (
  userId: string,
  row: Record<string, unknown>,
): CompanyUser | null => {
  const companyId = asStringOrNull(
    row.defaultCompanyId
    ?? row.companyId
    ?? row.company_id
    ?? row.organizationId
    ?? row.organization_id,
  );
  if (!companyId) return null;

  return {
    id: `${companyId}_${userId}`,
    companyId,
    userId,
    role: (row.role as CompanyUser["role"]) ?? "read_only",
    status: "active",
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
  };
};

const getCachedValue = <T>(
  cache: Map<string, { value: T; expiresAt: number }>,
  key: string,
): T | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const setCachedValue = <T>(
  cache: Map<string, { value: T; expiresAt: number }>,
  key: string,
  value: T,
  ttlMs = ENTITY_CACHE_TTL_MS,
) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const setMembershipCache = (userId: string, membership: CompanyUser) => {
  membershipCache.set(userId, {
    membership,
    expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS,
  });
};

const clearMembershipCache = (userId: string) => {
  membershipCache.delete(userId);
  membershipRequestCache.delete(userId);
};

const clearCompanyCaches = (companyId: string) => {
  companyCache.delete(companyId);
  companyRequestCache.delete(companyId);
  settingsCache.delete(companyId);
  settingsRequestCache.delete(companyId);
};

const fetchPrimaryMembershipByUser = async (userId: string): Promise<CompanyUser | null> => {
  const membershipsRef = collection(firestore, COLLECTIONS.COMPANY_USERS);
  const userRef = doc(firestore, COLLECTIONS.USERS, userId);
  const userSnap = await getDoc(userRef);
  const userProfile = userSnap.exists()
    ? (userSnap.data() as Record<string, unknown>)
    : null;
  const profileCompanyCandidates = [
    userProfile?.defaultCompanyId,
    userProfile?.companyId,
    userProfile?.company_id,
    userProfile?.organizationId,
    userProfile?.organization_id,
  ]
    .map((value) => asStringOrNull(value))
    .filter((value): value is string => Boolean(value));

  for (const profileCompanyId of new Set(profileCompanyCandidates)) {
    const canonicalMembershipRef = doc(
      firestore,
      COLLECTIONS.COMPANY_USERS,
      `${profileCompanyId}_${userId}`,
    );
    const canonicalMembershipSnap = await getDoc(canonicalMembershipRef);

    if (canonicalMembershipSnap.exists()) {
      const canonicalMembership = normalizeMembership(
        canonicalMembershipSnap.id,
        canonicalMembershipSnap.data() as Record<string, unknown>,
      );

      if (canonicalMembership.status === "active") {
        setMembershipCache(userId, canonicalMembership);
        return canonicalMembership;
      }
    }
  }

  const candidates = [
    query(membershipsRef, where("userId", "==", userId), where("status", "==", "active"), limit(1)),
    query(membershipsRef, where("user_id", "==", userId), where("status", "==", "active"), limit(1)),
    query(membershipsRef, where("userId", "==", userId), limit(1)),
    query(membershipsRef, where("user_id", "==", userId), limit(1)),
  ];

  for (const candidate of candidates) {
    let snapshot;
    try {
      snapshot = await getDocs(candidate);
    } catch {
      continue;
    }

    if (snapshot.empty) continue;

    const membership = snapshot.docs[0];
    const normalizedMembership = normalizeMembership(
      membership.id,
      membership.data() as Record<string, unknown>,
    );

    if (normalizedMembership.status === "active") {
      setMembershipCache(userId, normalizedMembership);
    }

    return normalizedMembership;
  }

  if (!userProfile) return null;

  const legacyMembership = normalizeLegacyProfileMembership(userId, userProfile);
  if (legacyMembership?.status === "active") {
    setMembershipCache(userId, legacyMembership);
  }

  return legacyMembership;
};

export const companyService = {
  async getPrimaryMembershipByUser(userId: string): Promise<CompanyUser | null> {
    assertFirebaseConfigured();
    const cachedMembership = membershipCache.get(userId);
    if (cachedMembership && cachedMembership.expiresAt > Date.now()) {
      return cachedMembership.membership;
    }
    const pendingRequest = membershipRequestCache.get(userId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = fetchPrimaryMembershipByUser(userId)
      .finally(() => {
        membershipRequestCache.delete(userId);
      });

    membershipRequestCache.set(userId, request);
    return request;
  },

  async getCompanyById(companyId: string): Promise<Company | null> {
    assertFirebaseConfigured();
    const cachedCompany = getCachedValue(companyCache, companyId);
    if (cachedCompany) {
      return cachedCompany;
    }

    const pendingRequest = companyRequestCache.get(companyId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const companyRef = doc(firestore, COLLECTIONS.COMPANIES, companyId);
      const companySnap = await getDoc(companyRef);
      if (!companySnap.exists()) return null;

      const company = normalizeCompany(companySnap.id, companySnap.data() as Record<string, unknown>);
      setCachedValue(companyCache, companyId, company);
      return company;
    })().finally(() => {
      companyRequestCache.delete(companyId);
    });

    companyRequestCache.set(companyId, request);
    return request;
  },

  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    assertFirebaseConfigured();
    const cachedSettings = getCachedValue(settingsCache, companyId);
    if (cachedSettings) {
      return cachedSettings;
    }

    const pendingRequest = settingsRequestCache.get(companyId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      const settingsRef = doc(firestore, COLLECTIONS.COMPANY_SETTINGS, companyId);
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) return null;

      const settings = normalizeSettings(settingsSnap.id, settingsSnap.data() as Record<string, unknown>);
      setCachedValue(settingsCache, companyId, settings);
      return settings;
    })().finally(() => {
      settingsRequestCache.delete(companyId);
    });

    settingsRequestCache.set(companyId, request);
    return request;
  },

  async completeCompanySetup(input: CompanySetupInput): Promise<void> {
    assertFirebaseConfigured();
    const response = await callFunction<CompanySetupInput, { success: boolean; companyId: string }>("completeCompanySetup", input);
    if (response.companyId) {
      clearCompanyCaches(response.companyId);
    }
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

    const cachedCompany = getCachedValue(companyCache, companyId);
    if (cachedCompany) {
      setCachedValue(companyCache, companyId, {
        ...cachedCompany,
        logoUrl,
      });
    }

    const cachedSettings = getCachedValue(settingsCache, companyId);
    if (cachedSettings) {
      setCachedValue(settingsCache, companyId, {
        ...cachedSettings,
        logoUrl,
      });
    }
  },

  async updateCompanyBasics(input: {
    companyId: string;
    name?: string;
    logoUrl?: string | null;
    organizationType?: Company["organizationType"];
    businessType?: string | null;
    taxType?: string | null;
    taxClassification?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    tpin?: string | null;
    registrationNumber?: string | null;
    industryType?: string | null;
    isVatRegistered?: boolean;
    vatRate?: number | null;
  }): Promise<void> {
    assertFirebaseConfigured();

    const companyRef = doc(firestore, COLLECTIONS.COMPANIES, input.companyId);
    const settingsRef = doc(firestore, COLLECTIONS.COMPANY_SETTINGS, input.companyId);
    const hasField = (field: string) => Object.prototype.hasOwnProperty.call(input, field);

    const companyPayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    const settingsPayload: Record<string, unknown> = {
      companyId: input.companyId,
      updatedAt: serverTimestamp(),
    };

    if (hasField("name")) {
      const normalizedName = typeof input.name === "string" ? input.name.trim() : "";
      companyPayload.name = normalizedName;
      settingsPayload.companyName = normalizedName;
    }

    if (hasField("logoUrl")) {
      companyPayload.logoUrl = input.logoUrl;
      settingsPayload.logoUrl = input.logoUrl;
    }

    if (hasField("organizationType")) {
      companyPayload.organizationType = input.organizationType ?? "business";
    }

    if (hasField("businessType")) {
      companyPayload.businessType = asStringOrNull(input.businessType);
    }

    if (hasField("taxType")) {
      companyPayload.taxType = asStringOrNull(input.taxType);
    }

    if (hasField("taxClassification")) {
      companyPayload.taxClassification = asStringOrNull(input.taxClassification);
    }

    if (hasField("address")) {
      companyPayload.address = asStringOrNull(input.address);
    }

    if (hasField("phone")) {
      companyPayload.phone = asStringOrNull(input.phone);
    }

    if (hasField("email")) {
      companyPayload.email = asStringOrNull(input.email);
    }

    if (hasField("tpin")) {
      companyPayload.tpin = asStringOrNull(input.tpin);
    }

    if (hasField("registrationNumber")) {
      companyPayload.registrationNumber = asStringOrNull(input.registrationNumber);
    }

    if (hasField("industryType")) {
      companyPayload.industryType = asStringOrNull(input.industryType);
    }

    if (hasField("isVatRegistered")) {
      settingsPayload.isVatRegistered = Boolean(input.isVatRegistered);
    }

    if (hasField("vatRate")) {
      settingsPayload.vatRate = input.vatRate ?? null;
    }

    await setDoc(companyRef, companyPayload, { merge: true });
    await setDoc(settingsRef, settingsPayload, { merge: true });

    const cachedCompany = getCachedValue(companyCache, input.companyId);
    if (cachedCompany) {
      const nextCompany: Company = { ...cachedCompany };

      if (hasField("name")) {
        nextCompany.name = typeof input.name === "string" ? input.name.trim() : "";
      }
      if (hasField("logoUrl")) {
        nextCompany.logoUrl = input.logoUrl;
      }
      if (hasField("organizationType")) {
        nextCompany.organizationType = input.organizationType ?? "business";
      }
      if (hasField("businessType")) {
        nextCompany.businessType = asStringOrNull(input.businessType) ?? undefined;
      }
      if (hasField("taxType")) {
        nextCompany.taxType = asStringOrNull(input.taxType) ?? undefined;
      }
      if (hasField("taxClassification")) {
        nextCompany.taxClassification = asStringOrNull(input.taxClassification) ?? undefined;
      }
      if (hasField("address")) {
        nextCompany.address = asStringOrNull(input.address) ?? undefined;
      }
      if (hasField("phone")) {
        nextCompany.phone = asStringOrNull(input.phone) ?? undefined;
      }
      if (hasField("email")) {
        nextCompany.email = asStringOrNull(input.email) ?? undefined;
      }
      if (hasField("tpin")) {
        nextCompany.tpin = asStringOrNull(input.tpin) ?? undefined;
      }
      if (hasField("registrationNumber")) {
        nextCompany.registrationNumber = asStringOrNull(input.registrationNumber) ?? undefined;
      }
      if (hasField("industryType")) {
        nextCompany.industryType = asStringOrNull(input.industryType) ?? undefined;
      }

      setCachedValue(companyCache, input.companyId, nextCompany);
    }

    const cachedSettings = getCachedValue(settingsCache, input.companyId);
    if (cachedSettings) {
      const nextSettings: CompanySettings = { ...cachedSettings };

      if (hasField("name")) {
        nextSettings.companyName = typeof input.name === "string" ? input.name.trim() : "";
      }
      if (hasField("logoUrl")) {
        nextSettings.logoUrl = input.logoUrl;
      }
      if (hasField("isVatRegistered")) {
        nextSettings.isVatRegistered = Boolean(input.isVatRegistered);
      }
      if (hasField("vatRate")) {
        nextSettings.vatRate = input.vatRate ?? null;
      }

      setCachedValue(settingsCache, input.companyId, nextSettings);
    }
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

  clearCachedMembership(userId?: string) {
    if (!userId) {
      membershipCache.clear();
      membershipRequestCache.clear();
      companyCache.clear();
      companyRequestCache.clear();
      settingsCache.clear();
      settingsRequestCache.clear();
      return;
    }
    clearMembershipCache(userId);
  },
};
