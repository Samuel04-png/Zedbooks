import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { format } from "date-fns";

export default function Payroll() {
  const navigate = useNavigate();

  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ["payrollRuns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("run_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Manage payroll runs and employee payments</p>
        </div>
        <Button onClick={() => navigate("/payroll/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Payroll Run
        </Button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Gross</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Total Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns?.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">
                    {format(new Date(run.run_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(new Date(run.period_start), "dd MMM")} -{" "}
                    {format(new Date(run.period_end), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{formatZMW(Number(run.total_gross))}</TableCell>
                  <TableCell>{formatZMW(Number(run.total_deductions))}</TableCell>
                  <TableCell>{formatZMW(Number(run.total_net))}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      run.status === 'completed' || run.status === 'approved'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : run.status === 'pending_approval'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {run.status === 'pending_approval' ? 'Pending Approval' : run.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {run.status === 'pending_approval' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/payroll/${run.id}/approve`)}
                      >
                        Review & Approve
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/payroll/${run.id}`)}
                      >
                        View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {payrollRuns?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No payroll runs found. Create your first payroll run to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
