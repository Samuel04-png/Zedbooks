export type AppRole =
  | "super_admin"
  | "admin"
  | "financial_manager"
  | "accountant"
  | "assistant_accountant"
  | "finance_officer"
  | "bookkeeper"
  | "cashier"
  | "inventory_manager"
  | "hr_manager"
  | "project_manager"
  | "auditor"
  | "staff"
  | "read_only";

export interface CompanyUser {
  id: string;
  companyId: string;
  userId: string;
  role: AppRole;
  status: "active" | "invited" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  defaultCompanyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  organizationType: "business" | "non_profit";
  businessType?: string;
  taxType?: string;
  taxClassification?: string;
  tpin?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
  isSetupComplete?: boolean;
  setupCompletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  id: string;
  companyId: string;
  companyName: string;
  isVatRegistered?: boolean;
  vatRate?: number | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLineInput {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalEntryInput {
  companyId: string;
  entryDate: string;
  referenceNumber?: string;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  lines: JournalLineInput[];
}

export interface RunDepreciationInput {
  companyId: string;
  periodMonth: string;
  postToGL?: boolean;
}

export interface InvitationPayload {
  email: string;
  role: AppRole;
  inviteeName?: string;
  loginUrl: string;
  expiryHours?: number;
  companyId?: string;
}
