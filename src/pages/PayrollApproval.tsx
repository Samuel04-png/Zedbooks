import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Mail, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

export default function PayrollApproval() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [isSendingEmails, setIsSendingEmails] = useState(false);

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
            id,
            full_name,
            employee_number,
            position,
            department,
            email,
            bank_account_number
          )
        `)
        .eq("payroll_run_id", id);

      if (error) throw error;
      return data;
    },
  });

  const { data: payrollAdditions } = useQuery({
    queryKey: ["payrollAdditions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_additions")
        .select(`
          *,
          employees (
            full_name,
            employee_number
          )
        `)
        .eq("payroll_run_id", id);

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("payroll_runs")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Payroll approved successfully!");
    },
    onError: () => {
      toast.error("Failed to approve payroll");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payroll_runs")
        .update({
          status: "draft",
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRun", id] });
      toast.success("Payroll rejected and returned to draft");
      navigate("/payroll");
    },
    onError: () => {
      toast.error("Failed to reject payroll");
    },
  });

  const handleBulkEmailPayslips = async () => {
    if (!payrollItems || payrollItems.length === 0) {
      toast.error("No payroll items to email");
      return;
    }

    const employeesWithEmail = payrollItems.filter(
      (item: any) => item.employees?.email && item.employees?.bank_account_number
    );

    if (employeesWithEmail.length === 0) {
      toast.error("No employees have email addresses configured");
      return;
    }

    setIsSendingEmails(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of employeesWithEmail) {
      try {
        const { error } = await supabase.functions.invoke("send-payslip-email", {
          body: {
            employeeEmail: item.employees.email,
            employeeName: item.employees.full_name,
            payPeriod: `${format(new Date(payrollRun!.period_start), "dd MMM")} - ${format(new Date(payrollRun!.period_end), "dd MMM yyyy")}`,
            basicSalary: item.basic_salary,
            housingAllowance: item.housing_allowance,
            transportAllowance: item.transport_allowance,
            otherAllowances: item.other_allowances,
            grossSalary: item.gross_salary,
            napsaEmployee: item.napsa_employee,
            nhimaEmployee: item.nhima_employee,
            paye: item.paye,
            advancesDeducted: item.advances_deducted,
            totalDeductions: item.total_deductions,
            netSalary: item.net_salary,
            bankAccountNumber: item.employees.bank_account_number,
          },
        });

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error(`Failed to send email to ${item.employees.email}:`, error);
        failCount++;
      }
    }

    setIsSendingEmails(false);

    if (successCount > 0) {
      toast.success(`Successfully sent ${successCount} payslip email(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} email(s)`);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!payrollRun) {
    return <div>Payroll run not found</div>;
  }

  const isApproved = payrollRun.status === "approved" || payrollRun.status === "completed";

  // Group additions by type
  const additionsByType = payrollAdditions?.reduce((acc: any, addition: any) => {
    const type = addition.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(addition);
    return acc;
  }, {}) || {};

  const totalAdditions = payrollAdditions?.reduce(
    (sum: number, a: any) => sum + (a.type !== "advance" ? Number(a.amount) : 0),
    0
  ) || 0;

  const totalAdvances = payrollAdditions?.reduce(
    (sum: number, a: any) => sum + (a.type === "advance" ? Number(a.amount) : 0),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Payroll Approval</h1>
          <p className="text-muted-foreground">
            Review and approve payroll for{" "}
            {format(new Date(payrollRun.period_start), "dd MMM")} -{" "}
            {format(new Date(payrollRun.period_end), "dd MMM yyyy")}
          </p>
        </div>
        {isApproved && (
          <Button onClick={handleBulkEmailPayslips} disabled={isSendingEmails}>
            {isSendingEmails ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {isSendingEmails ? "Sending..." : "Email All Payslips"}
          </Button>
        )}
      </div>

      {/* Status Banner */}
      {isApproved && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              This payroll has been approved
            </p>
            {payrollRun.approved_at && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Approved on {format(new Date(payrollRun.approved_at), "dd MMM yyyy 'at' HH:mm")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employees</CardDescription>
            <CardTitle className="text-2xl">{payrollItems?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gross Pay</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatZMW(Number(payrollRun.total_gross || 0))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deductions</CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {formatZMW(Number(payrollRun.total_deductions || 0))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>Total Net Pay</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatZMW(Number(payrollRun.total_net || 0))}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Payroll Additions Summary */}
      {payrollAdditions && payrollAdditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Additions & Advances</CardTitle>
            <CardDescription>
              Custom earnings, bonuses, overtime, and advance deductions for this payroll run
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Additional Earnings</p>
                <p className="text-xl font-bold text-primary">{formatZMW(totalAdditions)}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Advance Deductions</p>
                <p className="text-xl font-bold text-destructive">{formatZMW(totalAdvances)}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Additions</p>
                <p className="text-xl font-bold">{payrollAdditions.length}</p>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollAdditions.map((addition: any) => (
                    <TableRow key={addition.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{addition.employees?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {addition.employees?.employee_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={addition.type === "advance" ? "destructive" : "default"}>
                          {addition.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{addition.name}</TableCell>
                      <TableCell className={`text-right font-medium ${addition.type === "advance" ? "text-destructive" : "text-primary"}`}>
                        {addition.type === "advance" ? "-" : ""}{formatZMW(Number(addition.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Breakdown</CardTitle>
          <CardDescription>Review individual payroll calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NAPSA</TableHead>
                  <TableHead className="text-right">NHIMA</TableHead>
                  <TableHead className="text-right">Advances</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollItems?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.employees.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.employees.employee_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{item.employees.department || "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.gross_salary))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.paye))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.napsa_employee))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatZMW(Number(item.nhima_employee))}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatZMW(Number(item.advances_deducted || 0))}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatZMW(Number(item.total_deductions))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatZMW(Number(item.net_salary))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {payrollRun.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{payrollRun.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      {!isApproved && (
        <div className="flex justify-end gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive">
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject Payroll?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will return the payroll to draft status for corrections. The payroll will need to be resubmitted for approval.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => rejectMutation.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Reject Payroll
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Payroll
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve Payroll?</AlertDialogTitle>
                <AlertDialogDescription>
                  By approving this payroll, you confirm that all calculations are correct and payments can proceed.
                  <br /><br />
                  <strong>Total Net Pay: {formatZMW(Number(payrollRun.total_net || 0))}</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => approveMutation.mutate()}>
                  Approve Payroll
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}