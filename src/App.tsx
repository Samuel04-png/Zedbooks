import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { RoleProtectedRoute } from "./components/layout/RoleProtectedRoute";
import Auth from "./pages/Auth";
import AcceptInvitation from "./pages/AcceptInvitation";
import NotFound from "./pages/NotFound";
import CompanySetup from "./pages/CompanySetup";
import Landing from "./pages/Landing";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Invoices = lazy(() => import("./pages/Invoices"));
const NewInvoice = lazy(() => import("./pages/NewInvoice"));
const Employees = lazy(() => import("./pages/Employees"));
const NewEmployee = lazy(() => import("./pages/NewEmployee"));
const EditEmployee = lazy(() => import("./pages/EditEmployee"));
const BulkUploadEmployees = lazy(() => import("./pages/BulkUploadEmployees"));
const Payroll = lazy(() => import("./pages/Payroll"));
const NewPayrollRun = lazy(() => import("./pages/NewPayrollRun"));
const PayrollDetail = lazy(() => import("./pages/PayrollDetail"));
const Payslip = lazy(() => import("./pages/Payslip"));
const PayrollApproval = lazy(() => import("./pages/PayrollApproval"));
const Advances = lazy(() => import("./pages/Advances"));
const ZRACompliance = lazy(() => import("./pages/ZRACompliance"));
const TaxCalculator = lazy(() => import("./pages/TaxCalculator"));
const Customers = lazy(() => import("./pages/Customers"));
const SalesOrders = lazy(() => import("./pages/SalesOrders"));
const NewQuotation = lazy(() => import("./pages/NewQuotation"));
const Estimates = lazy(() => import("./pages/Estimates"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Bills = lazy(() => import("./pages/Bills"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const Expenses = lazy(() => import("./pages/Expenses"));
const CompanySettings = lazy(() => import("./pages/CompanySettings"));
const Inventory = lazy(() => import("./pages/Inventory"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectExpenses = lazy(() => import("./pages/ProjectExpenses"));
const ProjectActivityLog = lazy(() => import("./pages/ProjectActivityLog"));
const Donors = lazy(() => import("./pages/Donors"));
const AccountsPayable = lazy(() => import("./pages/AccountsPayable"));
const AccountsReceivable = lazy(() => import("./pages/AccountsReceivable"));
const FixedAssets = lazy(() => import("./pages/FixedAssets"));
const AssetDepreciation = lazy(() => import("./pages/AssetDepreciation"));
const FinancialPeriods = lazy(() => import("./pages/FinancialPeriods"));
const EmployeePayrollSetupPage = lazy(() => import("./pages/EmployeePayrollSetupPage"));
const PayrollSettings = lazy(() => import("./pages/PayrollSettings"));
const Products = lazy(() => import("./pages/Products"));
const OpeningBalances = lazy(() => import("./pages/OpeningBalances"));
const HROperations = lazy(() => import("./pages/HROperations"));
const FinancialReports = lazy(() => import("./pages/FinancialReports"));
const PayrollReports = lazy(() => import("./pages/PayrollReports"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const JournalEntries = lazy(() => import("./pages/JournalEntries"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const lazyPageFallback = (
  <div className="py-10">
    <LoadingState message="Loading page..." />
  </div>
);

const withPageFallback = (page: JSX.Element) => (
  <Suspense fallback={lazyPageFallback}>{page}</Suspense>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
              <Route path="/setup" element={<ProtectedRoute><CompanySetup /></ProtectedRoute>} />

              <Route path="/dashboard" element={<ProtectedRoute><AppLayout>{withPageFallback(<Dashboard />)}</AppLayout></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Invoices />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<NewInvoice />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />

              <Route path="/customers" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Customers />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/estimates" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Estimates />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/quotations/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<NewQuotation />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/sales-orders" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<SalesOrders />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/vendors" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Vendors />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/bills" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Bills />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<PurchaseOrders />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Expenses />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Products />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Inventory />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/bank-accounts" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<BankAccounts />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/reconciliation" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Reconciliation />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Employees />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<NewEmployee />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/:id/edit" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<EditEmployee />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/bulk-upload" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<BulkUploadEmployees />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/:id/payroll-setup" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<EmployeePayrollSetupPage />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Payroll />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<NewPayrollRun />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/:id" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<PayrollDetail />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/:id/approve" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<PayrollApproval />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/:runId/payslip/:employeeId" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Payslip />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/advances" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Advances />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/time-tracking" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<TimeTracking />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/hr-operations" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<HROperations />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Projects />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/expenses" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<ProjectExpenses />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/activity-log" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<ProjectActivityLog />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/donors" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<Donors />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/accounts-payable" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<AccountsPayable />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/accounts-receivable" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<AccountsReceivable />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/company-settings" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin"]}>{withPageFallback(<CompanySettings />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<FinancialReports />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll-reports" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<PayrollReports />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/zra-compliance" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<ZRACompliance />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/tax-calculator" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<TaxCalculator />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll-settings" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin"]}>{withPageFallback(<PayrollSettings />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<CompanySettings />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin"]}>{withPageFallback(<UserManagement />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin", "auditor"]}>{withPageFallback(<AuditLogs />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/fixed-assets" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<FixedAssets />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/asset-depreciation" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<AssetDepreciation />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/financial-periods" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin", "financial_manager", "accountant", "assistant_accountant", "finance_officer", "bookkeeper"]}>{withPageFallback(<FinancialPeriods />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/journal-entries" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<JournalEntries />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/chart-of-accounts" element={<ProtectedRoute><AppLayout><RoleProtectedRoute>{withPageFallback(<ChartOfAccounts />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/opening-balances" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin", "financial_manager", "accountant"]}>{withPageFallback(<OpeningBalances />)}</RoleProtectedRoute></AppLayout></ProtectedRoute>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
