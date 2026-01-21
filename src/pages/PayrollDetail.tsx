import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Play, CheckCircle, RotateCcw, AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";

type PayrollStatus = "draft" | "trial" | "final";

export default function PayrollDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: payrollRun, isLoading } = useQuery({
    queryKey: ["payrollRun", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: payrollItems } = useQuery({
    queryKey: ["payrollItems", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_items")
        .select(`
          *,
          employees (
            full_name,
            employee_number,
            email,
            position,
            department,
            tpin,
            napsa_number,
            nhima_number,
            bank_name,
            bank_account_number
          )
        `)
        .eq("payroll_run_id", id);

      if (error) throw error;
      return data;
    },
  });

  const { data: glJournals } = useQuery({
    queryKey: ["payroll-journals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_journals")
        .select(`
          *,
          journal_entries (
            id,
            reference_number,
            entry_date,
            description,
            is_posted
          )
        `)
        .eq("payroll_run_id", id);

      if (error) throw error;
      return data;
    },
    enabled: payrollRun?.payroll_status === "final",
  });

  const runTrialMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payroll_runs")
        .update({
          payroll_status: "trial" as PayrollStatus,
          trial_run_at: new Date().toISOString(),
          trial_run_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Trial payroll run completed. Review the calculations before finalizing.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to run trial payroll");
    },
  });

  const revertToTrialMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payroll_runs")
        .update({
          payroll_status: "draft" as PayrollStatus,
          trial_run_at: null,
          trial_run_by: null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Payroll reverted to draft. You can make changes and re-run trial.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revert payroll");
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get profile for company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      // Generate payroll number
      const payrollNumber = `PR-${format(new Date(), "yyyyMM")}-${id?.slice(0, 4).toUpperCase()}`;

      // Create GL Journal Entry
      const { data: journalEntry, error: journalError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: user.id,
          company_id: profile?.company_id,
          entry_date: new Date().toISOString().split("T")[0],
          reference_number: `PAYROLL-${payrollNumber}`,
          description: `Payroll for period ${format(new Date(payrollRun!.period_start), "MMM yyyy")}`,
          is_posted: true,
          is_locked: true,
        })
        .select()
        .single();

      if (journalError) throw journalError;

      // Create payroll journal link
      await supabase.from("payroll_journals").insert({
        payroll_run_id: id,
        journal_entry_id: journalEntry.id,
        journal_type: "payroll_expense",
        description: "Monthly payroll GL posting",
      });

      // Finalize the payroll run
      const { error } = await supabase
        .from("payroll_runs")
        .update({
          payroll_status: "final" as PayrollStatus,
          status: "completed",
          finalized_at: new Date().toISOString(),
          finalized_by: user.id,
          is_locked: true,
          payroll_number: payrollNumber,
          gl_posted: true,
          gl_journal_id: journalEntry.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      queryClient.invalidateQueries({ queryKey: ["payroll-journals", id] });
      toast.success("Payroll finalized and posted to General Ledger!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to finalize payroll");
    },
  });

  const exportToCSV = () => {
    if (!payrollItems || !payrollRun) return;

    const headers = [
      "Employee Number",
      "Name",
      "Basic Salary",
      "Housing",
      "Transport",
      "Other Allowances",
      "Gross Salary",
      "Advances Deducted",
      "Net Salary",
      "PAYE (Employer)",
      "NAPSA Employee (Employer)",
      "NAPSA Employer",
      "NHIMA Employee (Employer)",
      "NHIMA Employer",
    ];

    const rows = payrollItems.map((item: any) => [
      item.employees.employee_number,
      item.employees.full_name,
      item.basic_salary,
      item.housing_allowance,
      item.transport_allowance,
      item.other_allowances,
      item.gross_salary,
      item.advances_deducted || 0,
      item.net_salary,
      item.paye,
      item.napsa_employee,
      item.napsa_employer,
      item.nhima_employee,
      item.nhima_employer,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${format(new Date(payrollRun.run_date), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Payroll exported successfully");
  };

  const viewPayslip = (employeeId: string) => {
    navigate(`/payroll/${id}/payslip/${employeeId}`);
  };

  const generateSecurePassword = (): string => {
    const length = 12;
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values)
      .map(x => charset[x % charset.length])
      .join('');
  };

  const sendPayslipEmails = async () => {
    if (!payrollItems || !payrollRun) return;
    
    const confirmSend = window.confirm(
      `Send payslips to ${payrollItems.length} employees via email?\n\nEach employee will receive a password-protected payslip with a secure random password.`
    );
    
    if (!confirmSend) return;

    toast.promise(
      async () => {
        for (const item of payrollItems) {
          const employee = item.employees;
          if (!employee.email) continue;

          const password = generateSecurePassword();

          await supabase.functions.invoke('send-payslip-email', {
            body: {
              employeeName: employee.full_name,
              employeeEmail: employee.email,
              period: `${new Date(payrollRun.period_start).toLocaleDateString()} - ${new Date(payrollRun.period_end).toLocaleDateString()}`,
              payslipData: {
                basicSalary: item.basic_salary,
                housingAllowance: item.housing_allowance,
                transportAllowance: item.transport_allowance,
                otherAllowances: item.other_allowances,
                grossSalary: item.gross_salary,
                napsa: item.napsa_employee,
                nhima: item.nhima_employee,
                paye: item.paye,
                totalDeductions: item.total_deductions,
                netSalary: item.net_salary,
                employeeNo: employee.employee_number,
                position: employee.position,
                department: employee.department,
                tpin: employee.tpin,
                napsaNo: employee.napsa_number,
                nhimaNo: employee.nhima_number,
                bankName: employee.bank_name,
                accountNumber: employee.bank_account_number,
              },
              password,
            },
          });
        }
      },
      {
        loading: 'Sending payslip emails...',
        success: 'Payslip emails sent successfully!',
        error: 'Failed to send some emails. Please check console for details.',
      }
    );
  };

  const downloadBatchPayslips = () => {
    if (!payrollItems || !payrollRun) return;
    
    let batchContent = `PAYSLIPS - ${new Date(payrollRun.period_start).toLocaleDateString()} to ${new Date(payrollRun.period_end).toLocaleDateString()}\n`;
    batchContent += '='.repeat(100) + '\n\n';

    payrollItems.forEach((item, index) => {
      const employee = item.employees;
      batchContent += `PAYSLIP ${index + 1}\n`;
      batchContent += '-'.repeat(100) + '\n';
      batchContent += `Employee: ${employee.full_name} (${employee.employee_number})\n`;
      batchContent += `Position: ${employee.position || 'N/A'}\n`;
      batchContent += `Department: ${employee.department || 'N/A'}\n`;
      batchContent += `TPIN: ${employee.tpin || 'N/A'}\n`;
      batchContent += `NAPSA: ${employee.napsa_number || 'N/A'}\n`;
      batchContent += `NHIMA: ${employee.nhima_number || 'N/A'}\n\n`;
      
      batchContent += `EARNINGS:\n`;
      batchContent += `  Basic Salary:        K${item.basic_salary.toFixed(2)}\n`;
      batchContent += `  Housing Allowance:   K${item.housing_allowance.toFixed(2)}\n`;
      batchContent += `  Transport Allowance: K${item.transport_allowance.toFixed(2)}\n`;
      batchContent += `  Other Allowances:    K${item.other_allowances.toFixed(2)}\n`;
      batchContent += `  Gross Salary:        K${item.gross_salary.toFixed(2)}\n\n`;
      
      batchContent += `DEDUCTIONS:\n`;
      batchContent += `  NAPSA (5%):          K${item.napsa_employee.toFixed(2)}\n`;
      batchContent += `  NHIMA (1%):          K${item.nhima_employee.toFixed(2)}\n`;
      batchContent += `  PAYE:                K${item.paye.toFixed(2)}\n`;
      batchContent += `  Total Deductions:    K${item.total_deductions.toFixed(2)}\n\n`;
      
      batchContent += `NET PAY:               K${item.net_salary.toFixed(2)}\n`;
      batchContent += `\nBank: ${employee.bank_name || 'N/A'}\n`;
      batchContent += `Account: ${employee.bank_account_number || 'N/A'}\n`;
      batchContent += '\n' + '='.repeat(100) + '\n\n';
    });

    const blob = new Blob([batchContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const month = new Date(payrollRun.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    a.download = `Payslips_${month.replace(' ', '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Batch payslips downloaded successfully!');
  };

  const getStatusBadge = (status: PayrollStatus | null) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Draft</Badge>;
      case "trial":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Trial Run</Badge>;
      case "final":
        return <Badge className="bg-green-600">Finalized</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const payrollStatus = payrollRun?.payroll_status as PayrollStatus | null;
  const isDraft = payrollStatus === "draft";
  const isTrial = payrollStatus === "trial";
  const isFinal = payrollStatus === "final";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Payroll Details</h1>
              {getStatusBadge(payrollStatus)}
              {payrollRun?.payroll_number && (
                <span className="text-sm text-muted-foreground font-mono">{payrollRun.payroll_number}</span>
              )}
            </div>
            <p className="text-muted-foreground">
              {payrollRun && (
                <>
                  {format(new Date(payrollRun.period_start), "dd MMM")} -{" "}
                  {format(new Date(payrollRun.period_end), "dd MMM yyyy")}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button 
              onClick={() => runTrialMutation.mutate()}
              disabled={runTrialMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {runTrialMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Trial Payroll
            </Button>
          )}
          {isTrial && (
            <>
              <Button 
                variant="outline"
                onClick={() => revertToTrialMutation.mutate()}
                disabled={revertToTrialMutation.isPending}
              >
                {revertToTrialMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Revert to Draft
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalize Payroll
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Finalize Payroll
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>This action will:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Lock the payroll permanently - no further edits allowed</li>
                        <li>Post journal entries to the General Ledger</li>
                        <li>Create statutory liability accounts (PAYE, NAPSA, NHIMA)</li>
                        <li>Generate payroll number for reference</li>
                      </ul>
                      <p className="font-medium mt-4">Are you sure you want to proceed?</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => finalizeMutation.mutate()}
                      disabled={finalizeMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {finalizeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Finalize & Post to GL
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {isFinal && (
            <>
              <Button onClick={sendPayslipEmails} variant="outline">
                Email Payslips
              </Button>
              <Button onClick={downloadBatchPayslips} variant="outline">
                Download All
              </Button>
            </>
          )}
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Status Warning for Trial */}
      {isTrial && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Trial Payroll Run</p>
                <p className="text-sm text-blue-700">
                  Review the calculations below. No GL entries have been posted. Click "Finalize Payroll" when ready.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GL Posting Info for Final */}
      {isFinal && glJournals && glJournals.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              General Ledger Postings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {glJournals.map((journal: any) => (
                <div key={journal.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{journal.journal_entries?.reference_number}</p>
                    <p className="text-sm text-muted-foreground">{journal.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {journal.journal_entries?.entry_date && 
                        format(new Date(journal.journal_entries.entry_date), "dd MMM yyyy")
                      }
                    </p>
                    <Badge variant="outline" className="text-green-600 border-green-600">Posted</Badge>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="link" 
              className="mt-2 p-0 h-auto text-green-700"
              onClick={() => navigate("/journal-entries")}
            >
              View all journal entries →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gross</CardDescription>
            <CardTitle className="text-2xl">{formatZMW(Number(payrollRun?.total_gross || 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deductions</CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatZMW(Number(payrollRun?.total_deductions || 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Net</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatZMW(Number(payrollRun?.total_net || 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employees</CardDescription>
            <CardTitle className="text-2xl">{payrollItems?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Payroll Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Items</CardTitle>
          <CardDescription>Individual employee payroll calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NAPSA</TableHead>
                  <TableHead className="text-right">NHIMA</TableHead>
                  <TableHead className="text-right">Total Ded.</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollItems?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.employees.full_name}</p>
                        <p className="text-sm text-muted-foreground">{item.employees.employee_number}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatZMW(Number(item.basic_salary))}</TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.housing_allowance || 0) + Number(item.transport_allowance || 0) + Number(item.other_allowances || 0))}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatZMW(Number(item.gross_salary))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.paye))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.napsa_employee))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.nhima_employee))}</TableCell>
                    <TableCell className="text-right text-destructive">{formatZMW(Number(item.total_deductions))}</TableCell>
                    <TableCell className="text-right font-medium text-primary">{formatZMW(Number(item.net_salary))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewPayslip(item.employee_id)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Payslip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
