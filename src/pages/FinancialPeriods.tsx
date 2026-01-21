import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Calendar, Lock, Unlock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, startOfMonth, endOfMonth, getYear } from "date-fns";

export default function FinancialPeriods() {
  const queryClient = useQueryClient();
  const [isYearDialogOpen, setIsYearDialogOpen] = useState(false);
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
  const [closePeriodId, setClosePeriodId] = useState<string | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  
  const [newYear, setNewYear] = useState({
    year_name: `FY ${getYear(new Date())}`,
    start_date: `${getYear(new Date())}-01-01`,
    end_date: `${getYear(new Date())}-12-31`,
  });

  const { data: financialYears, isLoading: yearsLoading } = useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_years")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ["financial-periods", selectedYearId],
    queryFn: async () => {
      let query = supabase
        .from("financial_periods")
        .select("*, financial_years(year_name)")
        .order("period_number");

      if (selectedYearId) {
        query = query.eq("financial_year_id", selectedYearId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createYearMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      const { data: yearData, error: yearError } = await supabase
        .from("financial_years")
        .insert({
          company_id: profile?.company_id,
          year_name: newYear.year_name,
          start_date: newYear.start_date,
          end_date: newYear.end_date,
          status: "open",
        })
        .select()
        .single();

      if (yearError) throw yearError;

      // Auto-generate 12 monthly periods
      const startDate = new Date(newYear.start_date);
      const periodsToCreate = [];
      
      for (let i = 0; i < 12; i++) {
        const periodStart = addMonths(startOfMonth(startDate), i);
        const periodEnd = endOfMonth(periodStart);
        
        periodsToCreate.push({
          company_id: profile?.company_id,
          financial_year_id: yearData.id,
          period_number: i + 1,
          period_name: format(periodStart, "MMMM yyyy"),
          start_date: format(periodStart, "yyyy-MM-dd"),
          end_date: format(periodEnd, "yyyy-MM-dd"),
          status: i === 0 ? "open" : "open",
        });
      }

      const { error: periodsError } = await supabase
        .from("financial_periods")
        .insert(periodsToCreate);

      if (periodsError) throw periodsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-years"] });
      queryClient.invalidateQueries({ queryKey: ["financial-periods"] });
      toast.success("Financial year created with 12 monthly periods");
      setIsYearDialogOpen(false);
      setNewYear({
        year_name: `FY ${getYear(new Date()) + 1}`,
        start_date: `${getYear(new Date()) + 1}-01-01`,
        end_date: `${getYear(new Date()) + 1}-12-31`,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create financial year");
    },
  });

  const closePeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("financial_periods")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
        })
        .eq("id", periodId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-periods"] });
      toast.success("Period closed successfully");
      setClosePeriodId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to close period");
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const { error } = await supabase
        .from("financial_periods")
        .update({
          status: "open",
          closed_at: null,
          closed_by: null,
        })
        .eq("id", periodId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-periods"] });
      toast.success("Period reopened");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reopen period");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-600">Open</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const currentYear = financialYears?.find(y => y.status === "open");
  const openPeriods = periods?.filter(p => p.status === "open") || [];
  const closedPeriods = periods?.filter(p => p.status === "closed") || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Periods</h1>
          <p className="text-muted-foreground">Manage financial years and accounting periods</p>
        </div>
        <Dialog open={isYearDialogOpen} onOpenChange={setIsYearDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Financial Year
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Financial Year</DialogTitle>
              <DialogDescription>
                This will create a new financial year with 12 monthly periods
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Year Name</Label>
                <Input
                  value={newYear.year_name}
                  onChange={(e) => setNewYear({ ...newYear, year_name: e.target.value })}
                  placeholder="FY 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newYear.start_date}
                    onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={newYear.end_date}
                    onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsYearDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createYearMutation.mutate()}
                disabled={!newYear.year_name || createYearMutation.isPending}
              >
                {createYearMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Year
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Current Year
            </CardDescription>
            <CardTitle className="text-xl">{currentYear?.year_name || "Not Set"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Years</CardDescription>
            <CardTitle className="text-2xl">{financialYears?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-green-600" />
              Open Periods
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{openPeriods.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Closed Periods
            </CardDescription>
            <CardTitle className="text-2xl">{closedPeriods.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Financial Years */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Years</CardTitle>
          <CardDescription>Select a year to view its periods</CardDescription>
        </CardHeader>
        <CardContent>
          {yearsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : financialYears && financialYears.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {financialYears.map((year) => (
                <Card 
                  key={year.id}
                  className={`cursor-pointer transition-colors ${selectedYearId === year.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
                  onClick={() => setSelectedYearId(year.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{year.year_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(year.start_date), "dd MMM yyyy")} - {format(new Date(year.end_date), "dd MMM yyyy")}
                        </p>
                      </div>
                      {getStatusBadge(year.status || "open")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No financial years found</p>
              <p className="text-sm">Create your first financial year to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Periods Table */}
      {selectedYearId && (
        <Card>
          <CardHeader>
            <CardTitle>Accounting Periods</CardTitle>
            <CardDescription>
              Manage period status - closed periods prevent back-dated entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {periodsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : periods && periods.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Closed At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell className="font-mono">P{period.period_number}</TableCell>
                        <TableCell className="font-medium">{period.period_name}</TableCell>
                        <TableCell>{format(new Date(period.start_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{format(new Date(period.end_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(period.status || "open")}</TableCell>
                        <TableCell>
                          {period.closed_at ? format(new Date(period.closed_at), "dd MMM yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {period.status === "open" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setClosePeriodId(period.id)}
                            >
                              <Lock className="h-4 w-4 mr-2" />
                              Close
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reopenPeriodMutation.mutate(period.id)}
                              disabled={reopenPeriodMutation.isPending}
                            >
                              <Unlock className="h-4 w-4 mr-2" />
                              Reopen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No periods found for this year</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Close Period Confirmation */}
      <AlertDialog open={!!closePeriodId} onOpenChange={() => setClosePeriodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Close Accounting Period
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Closing this period will:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Prevent any new entries dated within this period</li>
                <li>Block modifications to existing entries in this period</li>
                <li>Lock all payroll runs for this period</li>
              </ul>
              <p className="mt-4 font-medium">You can reopen the period later if needed.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closePeriodId && closePeriodMutation.mutate(closePeriodId)}
              disabled={closePeriodMutation.isPending}
            >
              {closePeriodMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Close Period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
