import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  | "inventory_manager";

export interface UserRole {
  role: AppRole;
  user_id: string;
}

export function useUserRole() {
  return useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return data?.role as AppRole | null;
    },
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
    "reconciliation", "reports", "settings"
  ],
  bookkeeper: [
    "dashboard", "invoices", "customers", "estimates", "sales-orders",
    "vendors", "bills", "purchase-orders", "expenses"
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
    "reconciliation", "reports"
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
