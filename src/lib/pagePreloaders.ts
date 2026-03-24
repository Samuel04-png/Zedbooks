type RoutePreloader = () => Promise<unknown>;
type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

const routePreloaders: Record<string, RoutePreloader> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/customers": () => import("@/pages/Customers"),
  "/invoices": () => import("@/pages/Invoices"),
  "/accounts-receivable": () => import("@/pages/AccountsReceivable"),
  "/estimates": () => import("@/pages/Estimates"),
  "/sales-orders": () => import("@/pages/SalesOrders"),
  "/vendors": () => import("@/pages/Vendors"),
  "/bills": () => import("@/pages/Bills"),
  "/accounts-payable": () => import("@/pages/AccountsPayable"),
  "/purchase-orders": () => import("@/pages/PurchaseOrders"),
  "/expenses": () => import("@/pages/Expenses"),
  "/products": () => import("@/pages/Products"),
  "/inventory": () => import("@/pages/Inventory"),
  "/bank-accounts": () => import("@/pages/BankAccounts"),
  "/reconciliation": () => import("@/pages/Reconciliation"),
  "/employees": () => import("@/pages/Employees"),
  "/payroll": () => import("@/pages/Payroll"),
  "/advances": () => import("@/pages/Advances"),
  "/hr-operations": () => import("@/pages/HROperations"),
  "/time-tracking": () => import("@/pages/TimeTracking"),
  "/projects": () => import("@/pages/Projects"),
  "/donors": () => import("@/pages/Donors"),
  "/chart-of-accounts": () => import("@/pages/ChartOfAccounts"),
  "/journal-entries": () => import("@/pages/JournalEntries"),
  "/opening-balances": () => import("@/pages/OpeningBalances"),
  "/financial-periods": () => import("@/pages/FinancialPeriods"),
  "/reports": () => import("@/pages/FinancialReports"),
  "/payroll-reports": () => import("@/pages/PayrollReports"),
  "/zra-compliance": () => import("@/pages/ZRACompliance"),
  "/tax-calculator": () => import("@/pages/TaxCalculator"),
  "/users": () => import("@/pages/UserManagement"),
  "/audit-logs": () => import("@/pages/AuditLogs"),
  "/payroll-settings": () => import("@/pages/PayrollSettings"),
  "/company-settings": () => import("@/pages/CompanySettings"),
  "/fixed-assets": () => import("@/pages/FixedAssets"),
  "/asset-depreciation": () => import("@/pages/AssetDepreciation"),
};

const warmedRoutes = new Set<string>();
const defaultWarmRoutes = ["/dashboard", "/invoices", "/customers", "/vendors"];
const warmRouteGroups = [
  {
    prefixes: ["/dashboard"],
    routes: ["/dashboard", "/invoices", "/customers", "/vendors", "/products"],
  },
  {
    prefixes: ["/customers", "/invoices", "/accounts-receivable", "/estimates", "/sales-orders"],
    routes: ["/customers", "/invoices", "/accounts-receivable", "/sales-orders", "/estimates"],
  },
  {
    prefixes: ["/vendors", "/bills", "/accounts-payable", "/purchase-orders", "/expenses"],
    routes: ["/vendors", "/bills", "/accounts-payable", "/purchase-orders", "/expenses"],
  },
  {
    prefixes: ["/products", "/inventory"],
    routes: ["/products", "/inventory", "/reports"],
  },
  {
    prefixes: ["/bank-accounts", "/reconciliation", "/reports"],
    routes: ["/bank-accounts", "/reconciliation", "/reports", "/dashboard"],
  },
  {
    prefixes: ["/employees", "/payroll", "/advances", "/hr-operations", "/time-tracking", "/payroll-reports"],
    routes: ["/employees", "/payroll", "/advances", "/time-tracking", "/payroll-reports"],
  },
  {
    prefixes: ["/projects", "/donors"],
    routes: ["/projects", "/donors", "/dashboard"],
  },
] as const;

const normalizeRoute = (path: string) => {
  if (!path) return path;
  const clean = path.split("?")[0].split("#")[0];
  return clean.endsWith("/") && clean !== "/" ? clean.slice(0, -1) : clean;
};

const matchesPrefix = (path: string, prefix: string) => {
  return path === prefix || path.startsWith(`${prefix}/`);
};

const shouldSkipWarmup = () => {
  if (typeof navigator === "undefined") return false;

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return false;

  if (connection.saveData) return true;

  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
};

const getRoutesToWarm = (currentPath: string) => {
  const normalizedPath = normalizeRoute(currentPath) || "/dashboard";
  const matchingGroup = warmRouteGroups.find((group) =>
    group.prefixes.some((prefix) => matchesPrefix(normalizedPath, prefix)),
  );

  return matchingGroup?.routes ?? defaultWarmRoutes;
};

export const preloadRoute = (path?: string | null) => {
  const normalizedPath = normalizeRoute(path || "");
  if (!normalizedPath) return;

  const preload = routePreloaders[normalizedPath];
  if (!preload || warmedRoutes.has(normalizedPath)) return;

  warmedRoutes.add(normalizedPath);
  void preload().catch(() => {
    warmedRoutes.delete(normalizedPath);
  });
};

export const warmCommonRoutes = (currentPath = "/dashboard") => {
  if (shouldSkipWarmup()) return;

  const normalizedCurrentPath = normalizeRoute(currentPath);

  Array.from(new Set(getRoutesToWarm(currentPath)))
    .filter((path) => path !== normalizedCurrentPath)
    .forEach((path) => preloadRoute(path));
};
