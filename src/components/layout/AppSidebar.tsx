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
  Calculator,
  BookOpen,
  Building2,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { useUserRole, canAccessRoute, AppRole } from "@/hooks/useUserRole";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/Logo";
import { useIsMobile } from "@/hooks/use-mobile";

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
      { title: "Accounts Receivable", icon: Wallet, href: "/accounts-receivable" },
      { title: "Estimates", icon: FileText, href: "/estimates" },
      { title: "Sales Orders", icon: ShoppingCart, href: "/sales-orders" },
    ],
  },
  {
    title: "Purchasing & Payables",
    items: [
      { title: "Vendors", icon: Users, href: "/vendors" },
      { title: "Bills", icon: FileText, href: "/bills" },
      { title: "Accounts Payable", icon: Wallet, href: "/accounts-payable" },
      { title: "Purchase Orders", icon: ShoppingCart, href: "/purchase-orders" },
      { title: "Expenses", icon: DollarSign, href: "/expenses" },
    ],
  },
  {
    title: "Inventory & Assets",
    items: [
      { title: "Products & Services", icon: Package, href: "/products" },
      { title: "Inventory", icon: Package, href: "/inventory" },
      { title: "Fixed Assets", icon: Package, href: "/fixed-assets" },
      { title: "Depreciation", icon: Calculator, href: "/asset-depreciation" },
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
      { title: "Donors & Grants", icon: Users, href: "/donors" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { title: "Chart of Accounts", icon: BookOpen, href: "/chart-of-accounts" },
      { title: "Journal Entries", icon: FileText, href: "/journal-entries" },
      { title: "Opening Balances", icon: BookOpen, href: "/opening-balances" },
      { title: "Financial Periods", icon: Clock, href: "/financial-periods" },
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
      { title: "Payroll Settings", icon: Settings, href: "/payroll-settings" },
      { title: "Company Settings", icon: Settings, href: "/company-settings" },
    ],
  },
];

function filterNavigationByRole(navSections: NavSection[], role: AppRole | null): NavSection[] {
  // Fail closed if role is not yet known.
  if (!role) {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.href === "/dashboard"),
      }))
      .filter((section) => section.items.length > 0);
  }

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
  const { data: userRole } = useUserRole();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  const filteredNavigation = filterNavigationByRole(navigation, userRole || null);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={handleLinkClick}>
          <Logo variant="full" size="lg" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          <div className="space-y-1 p-2">
            {filteredNavigation.map((section, sectionIndex) => {
              const hasActiveItem = section.items.some(
                (item) => location.pathname === item.href
              );

              return (
                <Collapsible
                  key={section.title}
                  defaultOpen={hasActiveItem || sectionIndex < 3}
                  className="group/collapsible"
                >
                  <SidebarGroup className="p-0">
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                      <span>{section.title}</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent className="mt-1">
                        <SidebarMenu>
                          {section.items.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                  asChild
                                  isActive={isActive}
                                  className={cn(
                                    "w-full transition-colors",
                                    isActive
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                  )}
                                >
                                  <Link to={item.href} onClick={handleLinkClick} className="flex items-center gap-2">
                                    <item.icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "")} />
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <UserMenu />
      </SidebarFooter >
    </Sidebar >
  );
}
