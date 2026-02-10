import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, TrendingDown, ClipboardList, BookOpen, CreditCard } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function AssistantAccountantDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["assistant-accountant-dashboard-stats"],
    queryFn: async () => {
      const [invoices, expenses, bills, journalEntries, customers, vendors] = await Promise.all([
        supabase.from("invoices").select("total, status"),
        supabase.from("expenses").select("amount, category, expense_date"),
        supabase.from("bills").select("total, status, due_date"),
        supabase.from("journal_entries").select("id, is_posted, entry_date"),
        supabase.from("customers").select("id"),
        supabase.from("vendors").select("id"),
      ]);

      return {
        draftInvoices: invoices.data?.filter(i => i.status === 'draft').length || 0,
        pendingInvoices: invoices.data?.filter(i => i.status === 'pending').length || 0,
        recentExpenses: expenses.data?.length || 0,
        totalExpenses: expenses.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
        unpaidBills: bills.data?.filter(b => b.status !== 'paid').length || 0,
        unpaidBillsAmount: bills.data?.filter(b => b.status !== 'paid').reduce((s, b) => s + (b.total || 0), 0) || 0,
        unpostedJournals: journalEntries.data?.filter(j => !j.is_posted).length || 0,
        totalCustomers: customers.data?.length || 0,
        totalVendors: vendors.data?.length || 0,
      };
    },
  });

  const metrics = [
    { title: "Draft Invoices", value: stats?.draftInvoices || 0, subtitle: `${stats?.pendingInvoices || 0} pending`, icon: FileText },
    { title: "Unpaid Bills", value: stats?.unpaidBills || 0, subtitle: formatZMW(stats?.unpaidBillsAmount || 0), icon: Receipt },
    { title: "Total Expenses", value: formatZMW(stats?.totalExpenses || 0), subtitle: `${stats?.recentExpenses || 0} records`, icon: TrendingDown },
    { title: "Unposted Journals", value: stats?.unpostedJournals || 0, subtitle: "Awaiting review", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assistant Accountant Dashboard</h1>
        <p className="text-muted-foreground">Data entry tasks and bookkeeping overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Daily Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Record new expenses</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.recentExpenses || 0} total</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Process draft invoices</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.draftInvoices || 0} drafts</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Review unposted journals</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.unpostedJournals || 0} unposted</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Process vendor bills</span>
              <span className="text-xs bg-muted px-2 py-1 rounded">{stats?.unpaidBills || 0} unpaid</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customers</span>
              <span className="font-medium">{stats?.totalCustomers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Vendors</span>
              <span className="font-medium">{stats?.totalVendors || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
