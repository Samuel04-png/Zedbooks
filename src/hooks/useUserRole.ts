import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { firestore, isFirebaseConfigured } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";

export type AppRole = 
  | "admin"
  | "financial_manager"
  | "finance_officer"
  | "hr_manager"
  | "project_manager"
  | "auditor"
  | "read_only"
  | "super_admin"
  | "accountant"
  | "assistant_accountant"
  | "bookkeeper"
  | "cashier"
  | "inventory_manager"
  | "staff";

export interface UserRole {
  role: AppRole;
  user_id: string;
}

const rolePriority: AppRole[] = [
  "super_admin",
  "admin",
  "financial_manager",
  "accountant",
  "bookkeeper",
  "assistant_accountant",
  "finance_officer",
  "hr_manager",
  "project_manager",
  "inventory_manager",
  "cashier",
  "auditor",
  "staff",
  "read_only",
];

const resolveHighestRole = (roles: AppRole[]): AppRole => {
  if (!roles.length) return "read_only";

  for (const candidate of rolePriority) {
    if (roles.includes(candidate)) {
      return candidate;
    }
  }

  return "read_only";
};

export function useUserRole() {
  const { user, isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user || !isFirebaseConfigured) return "read_only" as AppRole;

      try {
        const roles = new Set<AppRole>();

        const companyUsersRef = collection(firestore, COLLECTIONS.COMPANY_USERS);
        const membershipQueries = [
          query(companyUsersRef, where("userId", "==", user.id), where("status", "==", "active"), limit(20)),
          query(companyUsersRef, where("user_id", "==", user.id), where("status", "==", "active"), limit(20)),
          query(companyUsersRef, where("userId", "==", user.id), limit(20)),
          query(companyUsersRef, where("user_id", "==", user.id), limit(20)),
        ];

        for (const membershipQuery of membershipQueries) {
          const membershipSnapshot = await getDocs(membershipQuery);
          membershipSnapshot.docs.forEach((docSnap) => {
            const role = docSnap.data().role as AppRole | undefined;
            if (role) roles.add(role);
          });
          if (roles.size) break;
        }

        if (!roles.size) {
          const userRolesRef = collection(firestore, COLLECTIONS.USER_ROLES);
          const roleQueries = [
            query(userRolesRef, where("userId", "==", user.id), limit(20)),
            query(userRolesRef, where("user_id", "==", user.id), limit(20)),
          ];

          for (const roleQuery of roleQueries) {
            const roleSnapshot = await getDocs(roleQuery);
            roleSnapshot.docs.forEach((docSnap) => {
              const role = docSnap.data().role as AppRole | undefined;
              if (role) roles.add(role);
            });
            if (roles.size) break;
          }
        }

        if (!roles.size) return "read_only" as AppRole;
        return resolveHighestRole(Array.from(roles));
      } catch (error) {
        return "read_only" as AppRole;
      }
    },
    enabled: isAuthenticated && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useHasRole(requiredRoles: AppRole[]) {
  const { data: userRole, isLoading } = useUserRole();

  const hasRole = userRole ? requiredRoles.includes(userRole) : false;
  
  // Super admin has access to everything
  const isSuperAdmin = userRole === "super_admin";

  return {
    hasRole: hasRole || isSuperAdmin,
    isLoading,
    userRole,
  };
}

// Role permissions mapping
export const rolePermissions: Record<AppRole, string[]> = {
  super_admin: ["*"],
  admin: ["*"],
  financial_manager: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses", "bank-accounts",
    "reconciliation", "reports", "settings", "chart-of-accounts", "journal-entries",
    "accounts-payable", "accounts-receivable",
    "payroll", "payroll-reports", "employees", "fixed-assets", "asset-depreciation", "opening-balances",
    "financial-periods", "zra-compliance", "tax-calculator", "hr-operations"
  ],
  accountant: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses", "bank-accounts",
    "reconciliation", "reports", "settings", "chart-of-accounts", "journal-entries",
    "accounts-payable", "accounts-receivable", "payroll", "payroll-reports",
    "fixed-assets", "asset-depreciation", "opening-balances", "financial-periods", "tax-calculator", "hr-operations"
  ],
  assistant_accountant: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses", "chart-of-accounts",
    "journal-entries", "accounts-payable", "accounts-receivable", "financial-periods"
  ],
  finance_officer: [
    "dashboard", "invoices", "expenses", "bills", "bank-accounts",
    "reconciliation", "reports", "chart-of-accounts", "journal-entries",
    "accounts-payable", "accounts-receivable", "financial-periods"
  ],
  bookkeeper: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses", "chart-of-accounts",
    "journal-entries", "fixed-assets", "reconciliation", "accounts-payable", "accounts-receivable",
    "financial-periods"
  ],
  cashier: [
    "dashboard", "bank-accounts", "expenses", "reconciliation", "products", "inventory"
  ],
  inventory_manager: [
    "dashboard", "inventory", "products", "purchase-orders", "vendors"
  ],
  hr_manager: [
    "dashboard", "employees", "payroll", "advances", "payroll-reports",
    "time-tracking", "hr-operations"
  ],
  project_manager: [
    "dashboard", "projects", "donors", "time-tracking", "reports"
  ],
  auditor: [
    "dashboard", "reports", "payroll-reports", "audit-logs",
    "journal-entries", "chart-of-accounts"
  ],
  staff: [
    "dashboard", "time-tracking", "hr-operations"
  ],
  read_only: [
    "dashboard"
  ],
};

export function canAccessRoute(role: AppRole | null, route: string): boolean {
  if (!role) return false;
  
  // Super admin and admin can access everything
  if (role === "super_admin" || role === "admin") return true;
  
  const permissions = rolePermissions[role] || [];
  
  // Check if route is in permissions
  const routePath = route.replace(/^\//, "").split("/")[0];
  return permissions.includes(routePath) || permissions.includes("*");
}
