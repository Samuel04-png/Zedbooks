import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import NewInvoice from "./pages/NewInvoice";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/invoices" element={<AppLayout><Invoices /></AppLayout>} />
          <Route path="/invoices/new" element={<AppLayout><NewInvoice /></AppLayout>} />
          
          <Route path="/customers" element={<AppLayout><ComingSoon title="Customers" description="Manage your customer contacts and relationships" /></AppLayout>} />
          <Route path="/estimates" element={<AppLayout><ComingSoon title="Estimates" /></AppLayout>} />
          <Route path="/sales-orders" element={<AppLayout><ComingSoon title="Sales Orders" /></AppLayout>} />
          <Route path="/vendors" element={<AppLayout><ComingSoon title="Vendors" /></AppLayout>} />
          <Route path="/bills" element={<AppLayout><ComingSoon title="Bills" /></AppLayout>} />
          <Route path="/purchase-orders" element={<AppLayout><ComingSoon title="Purchase Orders" /></AppLayout>} />
          <Route path="/expenses" element={<AppLayout><ComingSoon title="Expenses" /></AppLayout>} />
          <Route path="/products" element={<AppLayout><ComingSoon title="Products & Services" /></AppLayout>} />
          <Route path="/inventory" element={<AppLayout><ComingSoon title="Inventory" /></AppLayout>} />
          <Route path="/bank-accounts" element={<AppLayout><ComingSoon title="Bank Accounts" /></AppLayout>} />
          <Route path="/reconciliation" element={<AppLayout><ComingSoon title="Reconciliation" /></AppLayout>} />
          <Route path="/payroll" element={<AppLayout><ComingSoon title="Payroll" description="Zambian payroll with PAYE, NAPSA, and NHIMA compliance" /></AppLayout>} />
          <Route path="/time-tracking" element={<AppLayout><ComingSoon title="Time & Contractors" /></AppLayout>} />
          <Route path="/projects" element={<AppLayout><ComingSoon title="Projects" /></AppLayout>} />
          <Route path="/donors" element={<AppLayout><ComingSoon title="Donors & Grants" /></AppLayout>} />
          <Route path="/reports" element={<AppLayout><ComingSoon title="Reports" /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><ComingSoon title="Settings" /></AppLayout>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
