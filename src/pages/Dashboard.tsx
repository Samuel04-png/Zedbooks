import { useUserRole } from "@/hooks/useUserRole";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { BookkeeperDashboard } from "@/components/dashboard/BookkeeperDashboard";
import { HRDashboard } from "@/components/dashboard/HRDashboard";
import { InventoryDashboard } from "@/components/dashboard/InventoryDashboard";
import { ProjectManagerDashboard } from "@/components/dashboard/ProjectManagerDashboard";
import { AuditorDashboard } from "@/components/dashboard/AuditorDashboard";
import { FinancialManagerDashboard } from "@/components/dashboard/FinancialManagerDashboard";
import { AssistantAccountantDashboard } from "@/components/dashboard/AssistantAccountantDashboard";
import { FinanceOfficerDashboard } from "@/components/dashboard/FinanceOfficerDashboard";
import { CashierDashboard } from "@/components/dashboard/CashierDashboard";
import { StaffDashboard } from "@/components/dashboard/StaffDashboard";
import { ReadOnlyDashboard } from "@/components/dashboard/ReadOnlyDashboard";

export default function Dashboard() {
  const { data: userRole, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  switch (userRole) {
    case "super_admin":
    case "admin":
      return <SuperAdminDashboard />;
    case "financial_manager":
      return <FinancialManagerDashboard />;
    case "accountant":
      return <AccountantDashboard />;
    case "assistant_accountant":
      return <AssistantAccountantDashboard />;
    case "finance_officer":
      return <FinanceOfficerDashboard />;
    case "bookkeeper":
      return <BookkeeperDashboard />;
    case "cashier":
      return <CashierDashboard />;
    case "hr_manager":
      return <HRDashboard />;
    case "inventory_manager":
      return <InventoryDashboard />;
    case "project_manager":
      return <ProjectManagerDashboard />;
    case "auditor":
      return <AuditorDashboard />;
    case "staff":
      return <StaffDashboard />;
    case "read_only":
      return <ReadOnlyDashboard />;
    default:
      return <ReadOnlyDashboard />;
  }
}
