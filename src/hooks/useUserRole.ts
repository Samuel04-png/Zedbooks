import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = 
  | "admin"
  | "finance_officer"
  | "hr_manager"
  | "project_manager"
  | "auditor"
  | "read_only"
  | "super_admin"
  | "accountant"
  | "bookkeeper"
  | "inventory_manager"
  | "staff";

export interface UserRole {
  role: AppRole;
  user_id: string;
}

export function useUserRole() {
  const { user, isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return "read_only" as AppRole;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        // Default to super_admin if no role found (for first user)
        return "super_admin" as AppRole;
      }

      // If no role record exists, default to super_admin
      if (!data) {
        return "super_admin" as AppRole;
      }

      return data.role as AppRole;
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
  super_admin: ["*"], // Access to everything
  admin: ["*"], // Access to everything
  accountant: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses", "bank-accounts",
    "reconciliation", "reports", "settings", "chart-of-accounts", "journal-entries"
  ],
  bookkeeper: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses", "chart-of-accounts"
  ],
  inventory_manager: [
    "dashboard", "inventory", "products", "purchase-orders", "vendors"
  ],
  hr_manager: [
    "dashboard", "employees", "payroll", "advances", "payroll-reports",
    "time-tracking"
  ],
  finance_officer: [
    "dashboard", "invoices", "expenses", "bills", "bank-accounts",
    "reconciliation", "reports", "chart-of-accounts", "journal-entries"
  ],
  project_manager: [
    "dashboard", "projects", "donors", "time-tracking", "reports"
  ],
  auditor: [
    "dashboard", "reports", "payroll-reports", "audit-logs"
  ],
  read_only: [
    "dashboard"
  ],
  staff: [
    "dashboard", "time-tracking"
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
