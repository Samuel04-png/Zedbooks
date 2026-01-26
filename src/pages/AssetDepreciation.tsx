import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), "yyyy-MM"));
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [postToGL, setPostToGL] = useState(true);
  const { runDepreciation, isRunning, lastResult } = useDepreciationRunner();

  const { data: depreciationRecords, isLoading } = useQuery({
    queryKey: ["asset-depreciation", selectedMonth],
    queryFn: async () => {
      const startDate = startOfMonth(new Date(selectedMonth + "-01"));
      const endDate = endOfMonth(startDate);
      
      const { data, error } = await supabase
        .from("asset_depreciation")
        .select(`
          *,
          fixed_assets (
            asset_number,
            name,
            purchase_cost,
            depreciation_method
          )
        `)
        .gte("period_start", format(startDate, "yyyy-MM-dd"))
        .lte("period_end", format(endDate, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: assets } = useQuery({
    queryKey: ["depreciable-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*")
        .eq("is_deleted", false)
        .eq("status", "active");

      if (error) throw error;
      return data;
    },
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
