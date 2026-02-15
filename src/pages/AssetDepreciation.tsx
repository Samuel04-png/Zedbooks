import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingDown, Calculator, Play, CheckCircle, Loader2, AlertTriangle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useDepreciationRunner } from "@/hooks/useDepreciationRunner";

export default function AssetDepreciation() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), "yyyy-MM"));
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [postToGL, setPostToGL] = useState(true);
  const { runDepreciation, isRunning, lastResult } = useDepreciationRunner();

  const { data: companyId } = useQuery({
    queryKey: ["asset-depreciation-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: depreciationRecords, isLoading } = useQuery({
    queryKey: ["asset-depreciation", companyId, selectedMonth],
    queryFn: async () => {
      if (!companyId) return [];
      const startDate = startOfMonth(new Date(selectedMonth + "-01"));
      const endDate = endOfMonth(startDate);
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endDate, "yyyy-MM-dd");

      const [entriesSnapshot, assetsSnapshot] = await Promise.all([
        getDocs(query(collection(firestore, COLLECTIONS.DEPRECIATION_ENTRIES), where("companyId", "==", companyId))),
        getDocs(query(collection(firestore, COLLECTIONS.FIXED_ASSETS), where("companyId", "==", companyId))),
      ]);

      const assetsMap = new Map<string, { asset_number: string; name: string; purchase_cost: number; depreciation_method: string }>();
      assetsSnapshot.docs.forEach((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        assetsMap.set(docSnap.id, {
          asset_number: String(row.assetNumber ?? row.asset_number ?? ""),
          name: String(row.name ?? ""),
          purchase_cost: Number(row.purchaseCost ?? row.purchase_cost ?? 0),
          depreciation_method: String(row.depreciationMethod ?? row.depreciation_method ?? "straight_line"),
        });
      });

      return entriesSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const periodStart = String(row.periodStart ?? row.period_start ?? "");
          const periodEnd = String(row.periodEnd ?? row.period_end ?? "");
          return {
            id: docSnap.id,
            asset_id: String(row.assetId ?? row.asset_id ?? ""),
            depreciation_amount: Number(row.depreciationAmount ?? row.depreciation_amount ?? 0),
            accumulated_depreciation: Number(row.accumulatedDepreciation ?? row.accumulated_depreciation ?? 0),
            net_book_value: Number(row.netBookValue ?? row.net_book_value ?? 0),
            is_posted: Boolean(row.isPosted ?? row.is_posted ?? false),
            period_start: periodStart,
            period_end: periodEnd,
            created_at: String(row.createdAt ?? row.created_at ?? ""),
            fixed_assets: assetsMap.get(String(row.assetId ?? row.asset_id ?? "")) ?? null,
          };
        })
        .filter((record) => record.period_start >= start && record.period_end <= end)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },
    enabled: Boolean(companyId),
  });

  const { data: assets } = useQuery({
    queryKey: ["depreciable-assets", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const snapshot = await getDocs(
        query(
          collection(firestore, COLLECTIONS.FIXED_ASSETS),
          where("companyId", "==", companyId),
          where("status", "==", "active"),
        ),
      );

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            status: String(row.status ?? "active"),
            is_deleted: Boolean(row.isDeleted ?? row.is_deleted ?? false),
          };
        })
        .filter((asset) => !asset.is_deleted);
    },
    enabled: Boolean(companyId),
  });

  const handleRunDepreciation = async () => {
    try {
      await runDepreciation.mutateAsync({
        periodMonth: selectedMonth,
        postToGL: postToGL,
      });
      setIsRunDialogOpen(false);
    } catch (e) {
      // Error handled by hook
    }
  };

  const totalDepreciation = depreciationRecords?.reduce(
    (sum, rec) => sum + Number(rec.depreciation_amount || 0), 0
  ) || 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Asset Depreciation</h1>
          <p className="text-muted-foreground">Run and view depreciation calculations</p>
        </div>
        <Button onClick={() => setIsRunDialogOpen(true)}>
          <Play className="h-4 w-4 mr-2" />
          Run Depreciation
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Active Assets
            </CardDescription>
            <CardTitle className="text-2xl">{assets?.filter(a => a.status === "active").length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Records This Period</CardDescription>
            <CardTitle className="text-2xl">{depreciationRecords?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Total Depreciation
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatZMW(totalDepreciation)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardDescription>Posted to GL</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {depreciationRecords?.filter(r => r.is_posted).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-4">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Depreciation Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Depreciation Records</CardTitle>
          <CardDescription>Monthly depreciation entries for {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : depreciationRecords && depreciationRecords.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Depreciation</TableHead>
                    <TableHead className="text-right">Accum. Dep.</TableHead>
                    <TableHead className="text-right">NBV</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depreciationRecords.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.fixed_assets?.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {record.fixed_assets?.asset_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {record.fixed_assets?.depreciation_method?.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatZMW(Number(record.depreciation_amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatZMW(Number(record.accumulated_depreciation))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatZMW(Number(record.net_book_value))}
                      </TableCell>
                      <TableCell>
                        {record.is_posted ? (
                          <Badge className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Posted
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No depreciation records for this period</p>
              <p className="text-sm">Run depreciation to calculate monthly values</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Depreciation Dialog */}
      <AlertDialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Run Monthly Depreciation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will calculate depreciation for all active fixed assets for:</p>
              <p className="font-medium text-foreground">
                {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm mt-4">
                <li>Calculate depreciation based on each asset's method</li>
                <li>Update accumulated depreciation and net book value</li>
                <li>Create journal entries for the GL</li>
                <li>Mark fully depreciated assets</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Post to General Ledger</p>
                  <p className="text-xs text-muted-foreground">Create journal entries automatically</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={postToGL}
                onChange={(e) => setPostToGL(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRunDepreciation}
              disabled={isRunning}
            >
              {isRunning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run Depreciation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Last Run Results */}
      {lastResult && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Last Run: {lastResult.period}
            </CardTitle>
            <CardDescription>
              {lastResult.assets_processed} assets processed, K{lastResult.total_depreciation.toFixed(2)} total
              {lastResult.posted_to_gl && " (Posted to GL)"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
