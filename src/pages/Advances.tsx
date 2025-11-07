import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

const advanceSchema = z.object({
  employee_id: z.string().min(1, "Employee is required"),
  amount: z.string().min(1, "Amount is required"),
  date_given: z.string().min(1, "Date given is required"),
  date_to_deduct: z.string().optional(),
  reason: z.string().optional(),
});

type AdvanceFormData = z.infer<typeof advanceSchema>;

export default function Advances() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<AdvanceFormData>({
    resolver: zodResolver(advanceSchema),
    defaultValues: {
      employee_id: "",
      amount: "",
      date_given: format(new Date(), "yyyy-MM-dd"),
      date_to_deduct: "",
      reason: "",
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("employment_status", "active")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: advances, isLoading } = useQuery({
    queryKey: ["advances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advances")
        .select(`
          *,
          employees (
            full_name,
            employee_number
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createAdvance = useMutation({
    mutationFn: async (data: AdvanceFormData) => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("advances").insert({
        employee_id: data.employee_id,
        amount: parseFloat(data.amount),
        date_given: data.date_given,
        date_to_deduct: data.date_to_deduct || null,
        reason: data.reason || null,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Advance recorded successfully");
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to record advance: " + error.message);
    },
  });

  const onSubmit = (data: AdvanceFormData) => {
    createAdvance.mutate(data);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Advances</h1>
          <p className="text-muted-foreground">Manage employee salary advances</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Advance
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date Given</TableHead>
              <TableHead>Date to Deduct</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances?.map((advance) => {
              const employee = advance.employees as any;
              return (
                <TableRow key={advance.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{employee?.full_name}</div>
                      <div className="text-sm text-muted-foreground">{employee?.employee_number}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatZMW(Number(advance.amount))}</TableCell>
                  <TableCell>{format(new Date(advance.date_given), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    {advance.date_to_deduct
                      ? format(new Date(advance.date_to_deduct), "dd MMM yyyy")
                      : "Not specified"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={advance.status === "deducted" ? "default" : "secondary"}>
                      {advance.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{advance.reason || "N/A"}</TableCell>
                </TableRow>
              );
            })}
            {advances?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No advances recorded yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Employee Advance</DialogTitle>
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
                    <FormLabel>Amount (ZMW)</FormLabel>
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
                name="date_to_deduct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date to Deduct (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAdvance.isPending}>
                  {createAdvance.isPending ? "Recording..." : "Record Advance"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
