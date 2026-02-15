import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, doc, documentId, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, CheckCircle, Clock, XCircle, Calendar, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

const advanceSchema = z.object({
  employee_id: z.string().min(1, "Employee is required"),
  amount: z.string().min(1, "Amount is required"),
  date_given: z.string().min(1, "Date given is required"),
  months_to_repay: z.string().min(1, "Months to repay is required"),
  reason: z.string().optional(),
});

type AdvanceFormData = z.infer<typeof advanceSchema>;

export default function Advances() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<AdvanceFormData>({
    resolver: zodResolver(advanceSchema),
    defaultValues: {
      employee_id: "",
      amount: "",
      date_given: format(new Date(), "yyyy-MM-dd"),
      months_to_repay: "1",
      reason: "",
    },
  });

  const watchAmount = form.watch("amount");
  const watchMonths = form.watch("months_to_repay");
  const monthlyDeduction = watchAmount && watchMonths 
    ? (parseFloat(watchAmount) / parseInt(watchMonths)).toFixed(2)
    : "0.00";

  const { data: companyId } = useQuery({
    queryKey: ["advances-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      if (!companyId) return [];
      const ref = collection(firestore, COLLECTIONS.EMPLOYEES);
      const snapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            full_name: String(row.fullName ?? row.full_name ?? ""),
            employee_number: (row.employeeNumber ?? row.employee_number ?? null) as string | null,
            department: (row.department ?? null) as string | null,
            employment_status: String(row.employmentStatus ?? row.employment_status ?? "active"),
          };
        })
        .filter((employee) => employee.employment_status === "active")
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: Boolean(companyId),
  });

  const { data: advances, isLoading } = useQuery({
    queryKey: ["advances", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const advancesRef = collection(firestore, COLLECTIONS.ADVANCES);
      const snapshot = await getDocs(query(advancesRef, where("companyId", "==", companyId)));
      const rows = snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        const dateGiven = row.dateGiven ?? row.date_given;
        const normalizedDate = typeof dateGiven === "string"
          ? dateGiven
          : (dateGiven as { toDate?: () => Date })?.toDate?.().toISOString().slice(0, 10) ?? "";

        return {
          id: docSnap.id,
          employee_id: String(row.employeeId ?? row.employee_id ?? ""),
          amount: Number(row.amount ?? 0),
          date_given: normalizedDate,
          reason: (row.reason ?? null) as string | null,
          status: String(row.status ?? "pending"),
          months_to_repay: Number(row.monthsToRepay ?? row.months_to_repay ?? 1),
          monthly_deduction: Number(row.monthlyDeduction ?? row.monthly_deduction ?? 0),
          remaining_balance: Number(row.remainingBalance ?? row.remaining_balance ?? row.amount ?? 0),
          months_deducted: Number(row.monthsDeducted ?? row.months_deducted ?? 0),
          created_at: String(row.createdAt ?? row.created_at ?? ""),
        };
      });

      const employeeIds = Array.from(new Set(rows.map((row) => row.employee_id).filter(Boolean)));
      const employeeMap = new Map<string, { full_name: string; employee_number: string | null; department: string | null }>();
      if (employeeIds.length > 0) {
        const employeesRef = collection(firestore, COLLECTIONS.EMPLOYEES);
        const snapshot = await getDocs(query(employeesRef, where(documentId(), "in", employeeIds.slice(0, 30))));
        snapshot.docs.forEach((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          employeeMap.set(docSnap.id, {
            full_name: String(row.fullName ?? row.full_name ?? ""),
            employee_number: (row.employeeNumber ?? row.employee_number ?? null) as string | null,
            department: (row.department ?? null) as string | null,
          });
        });
      }

      return rows
        .map((row) => ({
          ...row,
          employees: employeeMap.get(row.employee_id) ?? null,
        }))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },
    enabled: Boolean(companyId),
  });

  const createAdvance = useMutation({
    mutationFn: async (data: AdvanceFormData) => {
      if (!user || !companyId) throw new Error("Not authenticated");

      const amount = parseFloat(data.amount);
      const monthsToRepay = parseInt(data.months_to_repay);
      const monthlyDeductionAmount = amount / monthsToRepay;

      await addDoc(collection(firestore, COLLECTIONS.ADVANCES), {
        companyId,
        employeeId: data.employee_id,
        amount: amount,
        dateGiven: data.date_given,
        reason: data.reason || null,
        status: "pending",
        monthsToRepay: monthsToRepay,
        monthlyDeduction: monthlyDeductionAmount,
        remainingBalance: amount,
        monthsDeducted: 0,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances", companyId] });
      toast.success("Advance recorded successfully");
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to record advance: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await setDoc(doc(firestore, COLLECTIONS.ADVANCES, id), {
        status,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances", companyId] });
      toast.success("Advance status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const recordDeductionMutation = useMutation({
    mutationFn: async (advance: any) => {
      const newMonthsDeducted = (advance.months_deducted || 0) + 1;
      const newRemainingBalance = Number(advance.remaining_balance) - Number(advance.monthly_deduction);
      const isFullyRepaid = newMonthsDeducted >= advance.months_to_repay;

      await setDoc(doc(firestore, COLLECTIONS.ADVANCES, advance.id), {
        monthsDeducted: newMonthsDeducted,
        remainingBalance: Math.max(0, newRemainingBalance),
        status: isFullyRepaid ? "deducted" : "pending",
        updatedAt: serverTimestamp(),
      }, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances", companyId] });
      toast.success("Deduction recorded");
    },
    onError: () => {
      toast.error("Failed to record deduction");
    },
  });

  const onSubmit = (data: AdvanceFormData) => {
    createAdvance.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "deducted":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Fully Repaid</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate summary stats
  const totalAdvances = advances?.reduce((sum, a) => sum + Number(a.amount), 0) || 0;
  const pendingAdvances = advances?.filter((a) => a.status === "pending") || [];
  const pendingTotal = pendingAdvances.reduce((sum, a) => sum + Number(a.remaining_balance || a.amount), 0);
  const deductedTotal = advances?.filter((a) => a.status === "deducted").reduce((sum, a) => sum + Number(a.amount), 0) || 0;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Advances</h1>
          <p className="text-muted-foreground">Manage salary advances and repayment schedules</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Advance
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Advances</CardDescription>
            <CardTitle className="text-2xl">{advances?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Amount Issued</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatZMW(totalAdvances)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardDescription>Outstanding Balance</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {formatZMW(pendingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {pendingAdvances.length} active advance(s)
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription>Fully Repaid</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {formatZMW(deductedTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Advances Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            All Advances
          </CardTitle>
          <CardDescription>
            View and manage employee salary advances with repayment tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Repayment Schedule</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances?.map((advance: any) => {
                  const employee = advance.employees;
                  const monthsDeducted = advance.months_deducted || 0;
                  const monthsToRepay = advance.months_to_repay || 1;
                  const remainingBalance = advance.remaining_balance ?? advance.amount;
                  const progressPercent = (monthsDeducted / monthsToRepay) * 100;

                  return (
                    <TableRow key={advance.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee?.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {employee?.employee_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(advance.date_given), "dd MMM yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatZMW(Number(advance.amount))}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {monthsToRepay} month{monthsToRepay > 1 ? "s" : ""}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <TrendingDown className="h-3 w-3" />
                            {formatZMW(Number(advance.monthly_deduction || advance.amount))}/month
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <Progress value={progressPercent} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {monthsDeducted} of {monthsToRepay} payments
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-600">
                        {formatZMW(Number(remainingBalance))}
                      </TableCell>
                      <TableCell>{getStatusBadge(advance.status)}</TableCell>
                      <TableCell>
                        {advance.status === "pending" && (
                          <div className="flex flex-col gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  Record Deduction
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Record Monthly Deduction?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will record a deduction of {formatZMW(Number(advance.monthly_deduction || advance.amount))} for {employee?.full_name}.
                                    <br /><br />
                                    <strong>Current Progress:</strong> {monthsDeducted} of {monthsToRepay} payments
                                    <br />
                                    <strong>Remaining after this:</strong> {formatZMW(Math.max(0, Number(remainingBalance) - Number(advance.monthly_deduction || advance.amount)))}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => recordDeductionMutation.mutate(advance)}
                                  >
                                    Record Deduction
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  Cancel
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Advance?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will cancel the advance. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: advance.id,
                                        status: "cancelled",
                                      })
                                    }
                                  >
                                    Cancel Advance
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {advances?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No advances recorded</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by recording an employee advance
                      </p>
                      <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Record Advance
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Advance Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Employee Advance</DialogTitle>
            <DialogDescription>
              Enter the advance details and repayment schedule
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.employee_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount (ZMW)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_given"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Given</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="months_to_repay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Months to Repay</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select months" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 9, 12].map((month) => (
                          <SelectItem key={month} value={month.toString()}>
                            {month} month{month > 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Monthly deduction: <strong>{formatZMW(parseFloat(monthlyDeduction))}</strong>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter reason for advance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAdvance.isPending}>
                  {createAdvance.isPending ? "Recording..." : "Record Advance"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
