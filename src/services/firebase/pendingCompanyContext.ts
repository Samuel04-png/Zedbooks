const PENDING_COMPANY_ID_KEY = "pendingCompanyId";
const PENDING_COMPANY_UID_KEY = "pendingCompanyUid";

const canUseSessionStorage = () => (
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
);

export const setPendingCompanyContext = (userId: string, companyId: string) => {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(PENDING_COMPANY_UID_KEY, userId);
  sessionStorage.setItem(PENDING_COMPANY_ID_KEY, companyId);
};

export const getPendingCompanyId = (userId: string): string | null => {
  if (!canUseSessionStorage()) return null;

  const storedUserId = sessionStorage.getItem(PENDING_COMPANY_UID_KEY);
  const storedCompanyId = sessionStorage.getItem(PENDING_COMPANY_ID_KEY);

  if (!storedUserId || !storedCompanyId) return null;
  if (storedUserId !== userId) return null;

  return storedCompanyId;
};

export const clearPendingCompanyContext = (userId?: string) => {
  if (!canUseSessionStorage()) return;

  if (userId) {
    const storedUserId = sessionStorage.getItem(PENDING_COMPANY_UID_KEY);
    if (storedUserId && storedUserId !== userId) return;
  }

  sessionStorage.removeItem(PENDING_COMPANY_UID_KEY);
  sessionStorage.removeItem(PENDING_COMPANY_ID_KEY);
};
