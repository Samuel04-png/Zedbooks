import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
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
import { addMonths, endOfMonth, format, getYear, startOfMonth } from "date-fns";

interface FinancialYear {
  id: string;
  companyId: string;
  yearName: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface FinancialPeriod {
  id: string;
  companyId: string;
  financialYearId: string;
  periodNumber: number;
  periodName: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string | null;
  closedBy: string | null;
}

const toIsoString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString();
    }
  }
  return null;
};

const toDateOnly = (value: unknown): string => {
  const iso = toIsoString(value);
  if (!iso) return "";
  return iso.slice(0, 10);
};

const parseFinancialYear = (id: string, row: Record<string, unknown>): FinancialYear => ({
  id,
  companyId: String(row.companyId ?? row.company_id ?? ""),
  yearName: String(row.yearName ?? row.year_name ?? ""),
  startDate: toDateOnly(row.startDate ?? row.start_date),
  endDate: toDateOnly(row.endDate ?? row.end_date),
  status: String(row.status ?? "open"),
});

const parseFinancialPeriod = (id: string, row: Record<string, unknown>): FinancialPeriod => ({
  id,
  companyId: String(row.companyId ?? row.company_id ?? ""),
  financialYearId: String(row.financialYearId ?? row.financial_year_id ?? ""),
  periodNumber: Number(row.periodNumber ?? row.period_number ?? 0),
  periodName: String(row.periodName ?? row.period_name ?? ""),
  startDate: toDateOnly(row.startDate ?? row.start_date),
  endDate: toDateOnly(row.endDate ?? row.end_date),
  status: String(row.status ?? "open"),
  closedAt: toIsoString(row.closedAt ?? row.closed_at),
  closedBy: (row.closedBy ?? row.closed_by ?? null) as string | null,
});

export default function FinancialPeriods() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isYearDialogOpen, setIsYearDialogOpen] = useState(false);
  const [closePeriodId, setClosePeriodId] = useState<string | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  const [newYear, setNewYear] = useState({
    year_name: `FY ${getYear(new Date())}`,
    start_date: `${getYear(new Date())}-01-01`,
    end_date: `${getYear(new Date())}-12-31`,
  });

  const companyQuery = useQuery({
    queryKey: ["financial-periods-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const companyId = companyQuery.data ?? null;

  const { data: financialYears, isLoading: yearsLoading } = useQuery({
    queryKey: ["financial-years", companyId],
    queryFn: async () => {
      if (!companyId) return [] as FinancialYear[];

      const yearsRef = collection(firestore, COLLECTIONS.FINANCIAL_YEARS);
      const snapshot = await getDocs(query(yearsRef, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => parseFinancialYear(docSnap.id, docSnap.data() as Record<string, unknown>))
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
    },
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (!selectedYearId && financialYears && financialYears.length > 0) {
      setSelectedYearId(financialYears[0].id);
    }
  }, [financialYears, selectedYearId]);

  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ["financial-periods", companyId, selectedYearId],
    queryFn: async () => {
      if (!companyId || !selectedYearId) return [] as FinancialPeriod[];

      const periodsRef = collection(firestore, COLLECTIONS.FINANCIAL_PERIODS);
      const snapshot = await getDocs(
        query(
          periodsRef,
          where("companyId", "==", companyId),
          where("financialYearId", "==", selectedYearId),
        ),
      );

      return snapshot.docs
        .map((docSnap) => parseFinancialPeriod(docSnap.id, docSnap.data() as Record<string, unknown>))
        .sort((a, b) => a.periodNumber - b.periodNumber);
    },
    enabled: Boolean(companyId && selectedYearId),
  });

  const closeTarget = useMemo(
    () => periods?.find((period) => period.id === closePeriodId) ?? null,
    [periods, closePeriodId],
  );

  const createYearMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!companyId) throw new Error("No company profile found for your account");
      if (!newYear.year_name.trim()) throw new Error("Year name is required");
      if (newYear.start_date > newYear.end_date) throw new Error("Start date must be before end date");

      const startDate = new Date(newYear.start_date);
      const batch = writeBatch(firestore);
      const yearRef = doc(collection(firestore, COLLECTIONS.FINANCIAL_YEARS));

      batch.set(yearRef, {
        companyId,
        yearName: newYear.year_name.trim(),
        startDate: newYear.start_date,
        endDate: newYear.end_date,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (let i = 0; i < 12; i += 1) {
        const periodStart = addMonths(startOfMonth(startDate), i);
        const periodEnd = endOfMonth(periodStart);
        const periodRef = doc(collection(firestore, COLLECTIONS.FINANCIAL_PERIODS));

        batch.set(periodRef, {
          companyId,
          financialYearId: yearRef.id,
          periodNumber: i + 1,
          periodName: format(periodStart, "MMMM yyyy"),
          startDate: format(periodStart, "yyyy-MM-dd"),
          endDate: format(periodEnd, "yyyy-MM-dd"),
          status: "open",
          closedAt: null,
          closedBy: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-years", companyId] });
      queryClient.invalidateQueries({ queryKey: ["financial-periods", companyId] });
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
    mutationFn: async (period: FinancialPeriod) => {
      if (!user) throw new Error("Not authenticated");

      await updateDoc(doc(firestore, COLLECTIONS.FINANCIAL_PERIODS, period.id), {
        status: "closed",
        closedAt: serverTimestamp(),
        closedBy: user.id,
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(firestore, COLLECTIONS.PERIOD_LOCKS, `${period.companyId}_${period.id}`),
        {
          companyId: period.companyId,
          periodId: period.id,
          financialYearId: period.financialYearId,
          periodName: period.periodName,
          startDate: period.startDate,
          endDate: period.endDate,
          status: "closed",
          lockedBy: user.id,
          lockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-periods", companyId, selectedYearId] });
      toast.success("Period closed successfully");
      setClosePeriodId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to close period");
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: async (period: FinancialPeriod) => {
      if (!user) throw new Error("Not authenticated");

      await updateDoc(doc(firestore, COLLECTIONS.FINANCIAL_PERIODS, period.id), {
        status: "open",
        closedAt: null,
        closedBy: null,
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(firestore, COLLECTIONS.PERIOD_LOCKS, `${period.companyId}_${period.id}`),
        {
          companyId: period.companyId,
          periodId: period.id,
          status: "open",
          unlockedBy: user.id,
          unlockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-periods", companyId, selectedYearId] });
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

  const currentYear = financialYears?.find((year) => year.status === "open");
  const openPeriods = periods?.filter((period) => period.status === "open") ?? [];
  const closedPeriods = periods?.filter((period) => period.status === "closed") ?? [];

  const isLoadingContext = companyQuery.isLoading || yearsLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Periods</h1>
          <p className="text-muted-foreground">Manage financial years and accounting periods</p>
        </div>
        <Dialog open={isYearDialogOpen} onOpenChange={setIsYearDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              New Financial Year
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Financial Year</DialogTitle>
              <DialogDescription>
                This creates a new financial year with 12 monthly periods.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Year Name</Label>
                <Input
                  value={newYear.year_name}
                  onChange={(event) => setNewYear({ ...newYear, year_name: event.target.value })}
                  placeholder="FY 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newYear.start_date}
                    onChange={(event) => setNewYear({ ...newYear, start_date: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={newYear.end_date}
                    onChange={(event) => setNewYear({ ...newYear, end_date: event.target.value })}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Current Year
            </CardDescription>
            <CardTitle className="text-xl">{currentYear?.yearName || "Not Set"}</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Financial Years</CardTitle>
          <CardDescription>Select a year to view its periods</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingContext ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !companyId ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No company profile found for your account</p>
            </div>
          ) : financialYears && financialYears.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {financialYears.map((year) => (
                <Card
                  key={year.id}
                  className={`cursor-pointer transition-colors ${selectedYearId === year.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}
                  onClick={() => setSelectedYearId(year.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{year.yearName}</p>
                        <p className="text-sm text-muted-foreground">
                          {year.startDate ? format(new Date(year.startDate), "dd MMM yyyy") : "-"}{" "}
                          -{" "}
                          {year.endDate ? format(new Date(year.endDate), "dd MMM yyyy") : "-"}
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

      {selectedYearId && (
        <Card>
          <CardHeader>
            <CardTitle>Accounting Periods</CardTitle>
            <CardDescription>
              Manage period status. Closed periods prevent back-dated entries.
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
                        <TableCell className="font-mono">P{period.periodNumber}</TableCell>
                        <TableCell className="font-medium">{period.periodName}</TableCell>
                        <TableCell>{period.startDate ? format(new Date(period.startDate), "dd MMM yyyy") : "-"}</TableCell>
                        <TableCell>{period.endDate ? format(new Date(period.endDate), "dd MMM yyyy") : "-"}</TableCell>
                        <TableCell>{getStatusBadge(period.status || "open")}</TableCell>
                        <TableCell>
                          {period.closedAt ? format(new Date(period.closedAt), "dd MMM yyyy HH:mm") : "-"}
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
                              onClick={() => reopenPeriodMutation.mutate(period)}
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
                <li>Prevent new entries dated within this period</li>
                <li>Block modifications to existing entries in this period</li>
                <li>Lock payroll postings for this period</li>
              </ul>
              <p className="mt-4 font-medium">You can reopen the period later if needed.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeTarget && closePeriodMutation.mutate(closeTarget)}
              disabled={closePeriodMutation.isPending || !closeTarget}
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
