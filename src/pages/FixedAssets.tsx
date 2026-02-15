import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Package, TrendingDown, Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export default function FixedAssets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_number: "",
    name: "",
    description: "",
    category_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_cost: "",
    residual_value: "0",
    useful_life_months: "60",
    depreciation_method: "straight_line",
    location: "",
    serial_number: "",
  });

  const { data: companyId } = useQuery({
    queryKey: ["fixed-assets-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: assets, isLoading } = useQuery({
    queryKey: ["fixed-assets", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const assetsRef = collection(firestore, COLLECTIONS.FIXED_ASSETS);
      const categoriesRef = collection(firestore, COLLECTIONS.ASSET_CATEGORIES);
      const [assetsSnapshot, categoriesSnapshot] = await Promise.all([
        getDocs(query(assetsRef, where("companyId", "==", companyId))),
        getDocs(query(categoriesRef, where("companyId", "==", companyId))),
      ]);

      const categoryMap = new Map<string, { name: string; depreciation_method: string | null; useful_life_years: number | null }>();
      categoriesSnapshot.docs.forEach((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        categoryMap.set(docSnap.id, {
          name: String(row.name ?? ""),
          depreciation_method: (row.depreciationMethod ?? row.depreciation_method ?? null) as string | null,
          useful_life_years: Number(row.usefulLifeYears ?? row.useful_life_years ?? 0) || null,
        });
      });

      return assetsSnapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const createdAt = row.createdAt ?? row.created_at;
          const createdAtIso = typeof createdAt === "string"
            ? createdAt
            : (createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? "";
          const categoryId = (row.categoryId ?? row.category_id ?? null) as string | null;
          return {
            id: docSnap.id,
            user_id: String(row.userId ?? row.user_id ?? ""),
            company_id: String(row.companyId ?? row.company_id ?? ""),
            asset_number: String(row.assetNumber ?? row.asset_number ?? ""),
            name: String(row.name ?? ""),
            description: (row.description ?? null) as string | null,
            category_id: categoryId,
            purchase_date: String(row.purchaseDate ?? row.purchase_date ?? ""),
            purchase_cost: Number(row.purchaseCost ?? row.purchase_cost ?? 0),
            residual_value: Number(row.residualValue ?? row.residual_value ?? 0),
            useful_life_months: Number(row.usefulLifeMonths ?? row.useful_life_months ?? 0),
            depreciation_method: String(row.depreciationMethod ?? row.depreciation_method ?? "straight_line"),
            location: (row.location ?? null) as string | null,
            serial_number: (row.serialNumber ?? row.serial_number ?? null) as string | null,
            net_book_value: Number(row.netBookValue ?? row.net_book_value ?? row.purchaseCost ?? row.purchase_cost ?? 0),
            accumulated_depreciation: Number(row.accumulatedDepreciation ?? row.accumulated_depreciation ?? 0),
            status: String(row.status ?? "active"),
            is_deleted: Boolean(row.isDeleted ?? row.is_deleted ?? false),
            created_at: createdAtIso,
            asset_categories: categoryId ? categoryMap.get(categoryId) ?? null : null,
          };
        })
        .filter((asset) => !asset.is_deleted)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    enabled: Boolean(companyId),
  });

  const { data: categories } = useQuery({
    queryKey: ["asset-categories", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const categoriesRef = collection(firestore, COLLECTIONS.ASSET_CATEGORIES);
      const snapshot = await getDocs(query(categoriesRef, where("companyId", "==", companyId)));
      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(companyId),
  });

  const createAssetMutation = useMutation({
    mutationFn: async () => {
      if (!user || !companyId) throw new Error("Not authenticated");

      const purchaseCost = parseFloat(newAsset.purchase_cost);
      const residualValue = parseFloat(newAsset.residual_value) || 0;
      const usefulLifeMonths = parseInt(newAsset.useful_life_months, 10);
      const monthlyDepreciation = usefulLifeMonths > 0
        ? Math.max(0, (purchaseCost - residualValue) / usefulLifeMonths)
        : 0;

      await addDoc(collection(firestore, COLLECTIONS.FIXED_ASSETS), {
        userId: user.id,
        companyId,
        assetNumber: newAsset.asset_number,
        name: newAsset.name,
        description: newAsset.description || null,
        categoryId: newAsset.category_id || null,
        purchaseDate: newAsset.purchase_date,
        purchaseCost: purchaseCost,
        residualValue: residualValue,
        usefulLifeMonths: usefulLifeMonths,
        depreciationMethod: newAsset.depreciation_method,
        location: newAsset.location || null,
        serialNumber: newAsset.serial_number || null,
        monthlyDepreciation,
        netBookValue: purchaseCost,
        accumulatedDepreciation: 0,
        status: "active",
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets", companyId] });
      toast.success("Asset created successfully");
      setIsDialogOpen(false);
      setNewAsset({
        asset_number: "",
        name: "",
        description: "",
        category_id: "",
        purchase_date: new Date().toISOString().split("T")[0],
        purchase_cost: "",
        residual_value: "0",
        useful_life_months: "60",
        depreciation_method: "straight_line",
        location: "",
        serial_number: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create asset");
    },
  });

  const filteredAssets = assets?.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.asset_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAssetValue = assets?.reduce((sum, asset) => sum + Number(asset.purchase_cost || 0), 0) || 0;
  const totalAccumulatedDepreciation = assets?.reduce((sum, asset) => sum + Number(asset.accumulated_depreciation || 0), 0) || 0;
  const totalNetBookValue = assets?.reduce((sum, asset) => sum + Number(asset.net_book_value || asset.purchase_cost || 0), 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600">Active</Badge>;
      case "disposed":
        return <Badge variant="destructive">Disposed</Badge>;
      case "fully_depreciated":
        return <Badge variant="secondary">Fully Depreciated</Badge>;
      case "under_maintenance":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fixed Assets</h1>
          <p className="text-muted-foreground">Manage your organization's fixed assets and depreciation</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Fixed Asset</DialogTitle>
              <DialogDescription>Enter the details of the new asset</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Number *</Label>
                  <Input
                    value={newAsset.asset_number}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_number: e.target.value })}
                    placeholder="FA-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Asset Name *</Label>
                  <Input
                    value={newAsset.name}
                    onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                    placeholder="Office Computer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                  placeholder="Asset description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={newAsset.category_id}
                    onValueChange={(value) => setNewAsset({ ...newAsset, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purchase Date *</Label>
                  <Input
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Cost (ZMW) *</Label>
                  <Input
                    type="number"
                    value={newAsset.purchase_cost}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Residual Value (ZMW)</Label>
                  <Input
                    type="number"
                    value={newAsset.residual_value}
                    onChange={(e) => setNewAsset({ ...newAsset, residual_value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Useful Life (Months)</Label>
                  <Input
                    type="number"
                    value={newAsset.useful_life_months}
                    onChange={(e) => setNewAsset({ ...newAsset, useful_life_months: e.target.value })}
                    placeholder="60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Depreciation Method</Label>
                  <Select
                    value={newAsset.depreciation_method}
                    onValueChange={(value) => setNewAsset({ ...newAsset, depreciation_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">Straight Line</SelectItem>
                      <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                      <SelectItem value="units_of_production">Units of Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={newAsset.location}
                    onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                    placeholder="Head Office"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={newAsset.serial_number}
                  onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                  placeholder="SN-12345"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createAssetMutation.mutate()}
                disabled={!newAsset.asset_number || !newAsset.name || !newAsset.purchase_cost || createAssetMutation.isPending}
              >
                {createAssetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Asset
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
              <Package className="h-4 w-4" />
              Total Assets
            </CardDescription>
            <CardTitle className="text-2xl">{assets?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Asset Value</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatZMW(totalAssetValue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Accumulated Depreciation
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatZMW(totalAccumulatedDepreciation)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Net Book Value
            </CardDescription>
            <CardTitle className="text-2xl text-primary">{formatZMW(totalNetBookValue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Register</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredAssets && filteredAssets.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Accum. Dep.</TableHead>
                    <TableHead className="text-right">NBV</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono">{asset.asset_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          {asset.serial_number && (
                            <p className="text-sm text-muted-foreground">SN: {asset.serial_number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{asset.asset_categories?.name || "-"}</TableCell>
                      <TableCell>{format(new Date(asset.purchase_date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">{formatZMW(Number(asset.purchase_cost))}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatZMW(Number(asset.accumulated_depreciation || 0))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatZMW(Number(asset.net_book_value || asset.purchase_cost))}
                      </TableCell>
                      <TableCell>{getStatusBadge(asset.status || "active")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fixed assets found</p>
              <p className="text-sm">Add your first asset to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
