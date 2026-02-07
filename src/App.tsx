import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { RoleProtectedRoute } from "./components/layout/RoleProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import NewInvoice from "./pages/NewInvoice";
import Employees from "./pages/Employees";
import NewEmployee from "./pages/NewEmployee";
import EditEmployee from "./pages/EditEmployee";
import BulkUploadEmployees from "./pages/BulkUploadEmployees";
import Payroll from "./pages/Payroll";
import NewPayrollRun from "./pages/NewPayrollRun";
import PayrollDetail from "./pages/PayrollDetail";
import Payslip from "./pages/Payslip";
import PayrollApproval from "./pages/PayrollApproval";
import Advances from "./pages/Advances";
import PayrollReports from "./pages/PayrollReports";
import ZRACompliance from "./pages/ZRACompliance";
import TaxCalculator from "./pages/TaxCalculator";
import Customers from "./pages/Customers";
import SalesOrders from "./pages/SalesOrders";
import NewQuotation from "./pages/NewQuotation";
import Estimates from "./pages/Estimates";
import Vendors from "./pages/Vendors";
import Bills from "./pages/Bills";
import PurchaseOrders from "./pages/PurchaseOrders";
import Expenses from "./pages/Expenses";
import CompanySettings from "./pages/CompanySettings";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";
import Inventory from "./pages/Inventory";
import BankAccounts from "./pages/BankAccounts";
import Reconciliation from "./pages/Reconciliation";
import TimeTracking from "./pages/TimeTracking";
import FinancialReports from "./pages/FinancialReports";
import UserManagement from "./pages/UserManagement";
import Projects from "./pages/Projects";
import ProjectExpenses from "./pages/ProjectExpenses";
import AuditLogs from "./pages/AuditLogs";
import CompanySetup from "./pages/CompanySetup";
import Landing from "./pages/Landing";
import Donors from "./pages/Donors";
import AccountsPayable from "./pages/AccountsPayable";
import AccountsReceivable from "./pages/AccountsReceivable";
import FixedAssets from "./pages/FixedAssets";
import AssetDepreciation from "./pages/AssetDepreciation";
import FinancialPeriods from "./pages/FinancialPeriods";
import JournalEntries from "./pages/JournalEntries";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import EmployeePayrollSetupPage from "./pages/EmployeePayrollSetupPage";
import PayrollSettings from "./pages/PayrollSettings";

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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup" element={<ProtectedRoute><CompanySetup /></ProtectedRoute>} />
              
              <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Invoices /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><NewInvoice /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              
              <Route path="/customers" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Customers /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/estimates" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Estimates /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/quotations/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><NewQuotation /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/sales-orders" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><SalesOrders /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/vendors" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Vendors /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/bills" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Bills /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><PurchaseOrders /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Expenses /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><AppLayout><ComingSoon title="Products & Services" /></AppLayout></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Inventory /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/bank-accounts" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><BankAccounts /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/reconciliation" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Reconciliation /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Employees /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><NewEmployee /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/:id/edit" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><EditEmployee /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/bulk-upload" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><BulkUploadEmployees /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/employees/:id/payroll-setup" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><EmployeePayrollSetupPage /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Payroll /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/new" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><NewPayrollRun /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/:id" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><PayrollDetail /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/:id/approve" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><PayrollApproval /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll/:runId/payslip/:employeeId" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Payslip /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/advances" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Advances /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/time-tracking" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><TimeTracking /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Projects /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/expenses" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><ProjectExpenses /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/donors" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><Donors /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/accounts-payable" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><AccountsPayable /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/accounts-receivable" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><AccountsReceivable /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/company-settings" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><CompanySettings /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><FinancialReports /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll-reports" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><PayrollReports /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/zra-compliance" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><ZRACompliance /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/tax-calculator" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><TaxCalculator /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/payroll-settings" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><PayrollSettings /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><CompanySettings /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><UserManagement /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin", "auditor"]}><AuditLogs /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/fixed-assets" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><FixedAssets /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/asset-depreciation" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><AssetDepreciation /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/financial-periods" element={<ProtectedRoute><AppLayout><RoleProtectedRoute allowedRoles={["super_admin", "admin", "accountant"]}><FinancialPeriods /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/journal-entries" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><JournalEntries /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              <Route path="/chart-of-accounts" element={<ProtectedRoute><AppLayout><RoleProtectedRoute><ChartOfAccounts /></RoleProtectedRoute></AppLayout></ProtectedRoute>} />
              
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
