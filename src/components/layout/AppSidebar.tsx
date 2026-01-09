import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  ShoppingCart,
  Package,
  Wallet,
  BriefcaseIcon,
  Clock,
  DollarSign,
  BarChart3,
  Settings,
  Heart,
  Calculator,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { useUserRole, canAccessRoute, AppRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    title: "Sales & Receivables",
    items: [
      { title: "Customers", icon: Users, href: "/customers" },
      { title: "Invoices", icon: FileText, href: "/invoices" },
      { title: "Estimates", icon: FileText, href: "/estimates" },
      { title: "Sales Orders", icon: ShoppingCart, href: "/sales-orders" },
    ],
  },
  {
    title: "Purchasing & Payables",
    items: [
      { title: "Vendors", icon: Users, href: "/vendors" },
      { title: "Bills", icon: FileText, href: "/bills" },
      { title: "Purchase Orders", icon: ShoppingCart, href: "/purchase-orders" },
      { title: "Expenses", icon: DollarSign, href: "/expenses" },
    ],
  },
  {
    title: "Inventory & Products",
    items: [
      { title: "Products & Services", icon: Package, href: "/products" },
      { title: "Inventory", icon: Package, href: "/inventory" },
    ],
  },
  {
    title: "Banking",
    items: [
      { title: "Bank Accounts", icon: Wallet, href: "/bank-accounts" },
      { title: "Reconciliation", icon: Wallet, href: "/reconciliation" },
    ],
  },
  {
    title: "People",
    items: [
      { title: "Employees", icon: Users, href: "/employees" },
      { title: "Payroll", icon: DollarSign, href: "/payroll" },
      { title: "Advances", icon: Wallet, href: "/advances" },
      { title: "Time & Contractors", icon: Clock, href: "/time-tracking" },
    ],
  },
  {
    title: "Projects & Grants",
    items: [
      { title: "Projects", icon: BriefcaseIcon, href: "/projects" },
      { title: "Donors & Grants", icon: Heart, href: "/donors" },
    ],
  },
  {
    title: "Reports",
    items: [
      { title: "Financial Reports", icon: BarChart3, href: "/reports" },
      { title: "Payroll Reports", icon: FileText, href: "/payroll-reports" },
      { title: "ZRA Compliance", icon: FileText, href: "/zra-compliance" },
      { title: "Tax Calculator", icon: Calculator, href: "/tax-calculator" },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Users & Roles", icon: Users, href: "/users" },
      { title: "Audit Logs", icon: FileText, href: "/audit-logs" },
      { title: "Company Settings", icon: Settings, href: "/company-settings" },
    ],
  },
];

function filterNavigationByRole(navSections: NavSection[], role: AppRole | null): NavSection[] {
  if (!role) return [];
  
  // Super admin and admin see everything
  if (role === "super_admin" || role === "admin") {
    return navSections;
  }

  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessRoute(role, item.href)),
    }))
    .filter((section) => section.items.length > 0);
}

export function AppSidebar() {
  const location = useLocation();
  const { data: userRole, isLoading } = useUserRole();

  const filteredNavigation = filterNavigationByRole(navigation, userRole || null);

  if (isLoading) {
    return (
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Heart className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">ZedBooks</span>
              <span className="text-xs text-sidebar-foreground/70">Loading...</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Heart className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">ZedBooks</span>
            <span className="text-xs text-sidebar-foreground/70">Accountability with Purpose</span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {filteredNavigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          <UserMenu />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
