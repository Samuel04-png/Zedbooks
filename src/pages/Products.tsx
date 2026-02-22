import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Package,
  Wrench,
  Plus,
  Search,
  Edit,
  Trash2,
  Tags,
  TrendingUp,
  Archive,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: "product" | "service";
  category: string | null;
  unit_of_measure: string | null;
  selling_price: number;
  cost_price: number;
  track_inventory: boolean;
  quantity_on_hand: number;
  reorder_point: number;
  is_taxable: boolean;
  tax_rate: number;
  is_active: boolean;
  created_at: string | null;
}

interface PriceList {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
}

const defaultProduct: Partial<Product> = {
  name: "",
  sku: "",
  description: "",
  type: "product",
  category: "",
  unit_of_measure: "Unit",
  selling_price: 0,
  cost_price: 0,
  track_inventory: false,
  quantity_on_hand: 0,
  reorder_point: 0,
  is_taxable: true,
  tax_rate: 16,
  is_active: true,
};

const tsToIso = (value: unknown): string | null => {
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

export default function Products() {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const canDeleteMasterData = userRole === "super_admin" || userRole === "admin";
  const [activeTab, setActiveTab] = useState("catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isPriceListDialogOpen, setIsPriceListDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingPriceList, setEditingPriceList] = useState<Partial<PriceList> | null>(null);
  const queryClient = useQueryClient();
  const { data: companyId } = useQuery({
    queryKey: ["products-company", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Product[];

      const snapshot = await getDocs(
        query(collection(firestore, COLLECTIONS.PRODUCTS), where("companyId", "==", companyId)),
      );

      return snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;

        return {
          id: docSnap.id,
          name: String(row.name ?? ""),
          sku: (row.sku as string | null) ?? null,
          description: (row.description as string | null) ?? null,
          type: (row.type as "product" | "service") ?? "product",
          category: (row.category as string | null) ?? null,
          unit_of_measure: (row.unitOfMeasure as string | null) ?? (row.unit_of_measure as string | null) ?? null,
          selling_price: Number(row.sellingPrice ?? row.selling_price ?? 0),
          cost_price: Number(row.costPrice ?? row.cost_price ?? 0),
          track_inventory: Boolean(row.trackInventory ?? row.track_inventory),
          quantity_on_hand: Number(row.quantityOnHand ?? row.quantity_on_hand ?? 0),
          reorder_point: Number(row.reorderPoint ?? row.reorder_point ?? 0),
          is_taxable: Boolean(row.isTaxable ?? row.is_taxable),
          tax_rate: Number(row.taxRate ?? row.tax_rate ?? 16),
          is_active: row.isActive === undefined && row.is_active === undefined
            ? true
            : Boolean(row.isActive ?? row.is_active),
          created_at: tsToIso(row.createdAt ?? row.created_at),
        } satisfies Product;
      });
    },
    enabled: Boolean(companyId),
  });

  const { data: priceLists, isLoading: priceListsLoading } = useQuery({
    queryKey: ["priceLists", companyId],
    queryFn: async () => {
      if (!companyId) return [] as PriceList[];

      const snapshot = await getDocs(
        query(collection(firestore, COLLECTIONS.PRICE_LISTS), where("companyId", "==", companyId)),
      );

      return snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          name: String(row.name ?? ""),
          description: (row.description as string | null) ?? null,
          currency: String(row.currency ?? "ZMW"),
          is_default: Boolean(row.isDefault ?? row.is_default),
          is_active: row.isActive === undefined && row.is_active === undefined
            ? true
            : Boolean(row.isActive ?? row.is_active),
          valid_from: tsToIso(row.validFrom ?? row.valid_from),
          valid_to: tsToIso(row.validTo ?? row.valid_to),
        } satisfies PriceList;
      });
    },
    enabled: Boolean(companyId),
  });

  const saveProductMutation = useMutation({
    mutationFn: async (product: Partial<Product>) => {
      if (!companyId) throw new Error("No company found");

      const productData = {
        companyId,
        name: product.name || "",
        sku: product.sku || null,
        description: product.description || null,
        type: product.type || "product",
        category: product.category || null,
        unitOfMeasure: product.unit_of_measure || "Unit",
        sellingPrice: Number(product.selling_price || 0),
        costPrice: Number(product.cost_price || 0),
        trackInventory: Boolean(product.track_inventory),
        quantityOnHand: Number(product.quantity_on_hand || 0),
        reorderPoint: Number(product.reorder_point || 0),
        isTaxable: Boolean(product.is_taxable),
        taxRate: Number(product.tax_rate || 16),
        isActive: product.is_active === undefined ? true : Boolean(product.is_active),
        updatedAt: serverTimestamp(),
      };

      if (product.id) {
        await updateDoc(doc(firestore, COLLECTIONS.PRODUCTS, product.id), productData);
      } else {
        await addDoc(collection(firestore, COLLECTIONS.PRODUCTS), {
          ...productData,
          createdAt: serverTimestamp(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      toast.success(editingProduct?.id ? "Product updated" : "Product created");
    },
    onError: (error: Error) => {
      toast.error("Failed to save product: " + error.message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canDeleteMasterData) {
        throw new Error("Only Admin users can delete products.");
      }
      await deleteDoc(doc(firestore, COLLECTIONS.PRODUCTS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete product: " + error.message);
    },
  });

  const savePriceListMutation = useMutation({
    mutationFn: async (priceList: Partial<PriceList>) => {
      if (!companyId) throw new Error("No company found");

      const priceListData = {
        companyId,
        name: priceList.name || "",
        description: priceList.description || null,
        currency: priceList.currency || "ZMW",
        isDefault: Boolean(priceList.is_default),
        isActive: priceList.is_active === undefined ? true : Boolean(priceList.is_active),
        validFrom: priceList.valid_from || null,
        validTo: priceList.valid_to || null,
        updatedAt: serverTimestamp(),
      };

      if (priceList.id) {
        await updateDoc(doc(firestore, COLLECTIONS.PRICE_LISTS, priceList.id), priceListData);
      } else {
        await addDoc(collection(firestore, COLLECTIONS.PRICE_LISTS), {
          ...priceListData,
          createdAt: serverTimestamp(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priceLists"] });
      setIsPriceListDialogOpen(false);
      setEditingPriceList(null);
      toast.success(editingPriceList?.id ? "Price list updated" : "Price list created");
    },
    onError: (error: Error) => {
      toast.error("Failed to save price list: " + error.message);
    },
  });

  const deletePriceListMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canDeleteMasterData) {
        throw new Error("Only Admin users can delete price lists.");
      }
      await deleteDoc(doc(firestore, COLLECTIONS.PRICE_LISTS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priceLists"] });
      toast.success("Price list deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete price list: " + error.message);
    },
  });

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct({ ...defaultProduct });
    setIsProductDialogOpen(true);
  };

  const handleEditPriceList = (priceList: PriceList) => {
    setEditingPriceList(priceList);
    setIsPriceListDialogOpen(true);
  };

  const handleNewPriceList = () => {
    setEditingPriceList({
      name: "",
      description: "",
      currency: "ZMW",
      is_default: false,
      is_active: true,
    });
    setIsPriceListDialogOpen(true);
  };

  const totalProducts = products?.filter((p) => p.type === "product").length || 0;
  const totalServices = products?.filter((p) => p.type === "service").length || 0;
  const lowStockItems = products?.filter(
    (p) => p.track_inventory && p.quantity_on_hand <= p.reorder_point
  ).length || 0;
  const filteredProducts = (products || []).filter((product) => {
    const text = `${product.name} ${product.sku || ""}`.toLowerCase();
    const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || product.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products & Services</h1>
          <p className="text-muted-foreground">
            Manage your product catalog, inventory, and pricing
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Archive className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{lowStockItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Price Lists</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{priceLists?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
          <TabsTrigger value="pricing">Price Lists</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        {/* Product Catalog Tab */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="product">Products</SelectItem>
                  <SelectItem value="service">Services</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleNewProduct}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product/Service
            </Button>
          </div>

          {productsLoading ? (
            <LoadingState message="Loading products..." />
          ) : !filteredProducts.length ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="No products or services"
              description="Add your first product or service to get started"
              actionLabel="Add Product/Service"
              onAction={handleNewProduct}
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={product.type === "product" ? "default" : "secondary"}>
                          {product.type === "product" ? (
                            <Package className="h-3 w-3 mr-1" />
                          ) : (
                            <Wrench className="h-3 w-3 mr-1" />
                          )}
                          {product.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell className="text-right">
                        K{product.selling_price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        K{product.cost_price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.track_inventory ? (
                          <span
                            className={
                              product.quantity_on_hand <= product.reorder_point
                                ? "text-orange-500 font-medium"
                                : ""
                            }
                          >
                            {product.quantity_on_hand}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDeleteMasterData && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteProductMutation.mutate(product.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Price Lists Tab */}
        <TabsContent value="pricing" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={handleNewPriceList}>
              <Plus className="h-4 w-4 mr-2" />
              Create Price List
            </Button>
          </div>

          {priceListsLoading ? (
            <LoadingState message="Loading price lists..." />
          ) : !priceLists?.length ? (
            <EmptyState
              icon={<Tags className="h-8 w-8 text-muted-foreground" />}
              title="No price lists"
              description="Create price lists to offer different pricing tiers"
              actionLabel="Create Price List"
              onAction={handleNewPriceList}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {priceLists.map((priceList) => (
                <Card key={priceList.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">{priceList.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {priceList.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {priceList.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      <Badge variant={priceList.is_active ? "default" : "secondary"}>
                        {priceList.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>Currency: {priceList.currency}</span>
                      {priceList.valid_from && (
                        <span>
                          Valid: {new Date(priceList.valid_from).toLocaleDateString()}
                          {priceList.valid_to && ` - ${new Date(priceList.valid_to).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEditPriceList(priceList)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {canDeleteMasterData && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePriceListMutation.mutate(priceList.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Inventory Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <LoadingState message="Loading inventory..." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products
                      ?.filter((p) => p.track_inventory)
                      .map((product) => {
                        const isLowStock = product.quantity_on_hand <= product.reorder_point;
                        const totalValue = product.quantity_on_hand * product.cost_price;
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.sku || "-"}</TableCell>
                            <TableCell className="text-right">
                              <span className={isLowStock ? "text-orange-500 font-medium" : ""}>
                                {product.quantity_on_hand}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{product.reorder_point}</TableCell>
                            <TableCell className="text-right">
                              K{product.cost_price.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              K{totalValue.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={isLowStock ? "destructive" : "default"}
                                className={isLowStock ? "bg-orange-500" : ""}
                              >
                                {isLowStock ? "Low Stock" : "In Stock"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {!products?.filter((p) => p.track_inventory).length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No products with inventory tracking enabled
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product/Service Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct?.id ? "Edit" : "New"} Product/Service
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={editingProduct.name || ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                    placeholder="Product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={editingProduct.sku || ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sku: e.target.value })
                    }
                    placeholder="Stock keeping unit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={editingProduct.type}
                    onValueChange={(value: "product" | "service") =>
                      setEditingProduct({ ...editingProduct, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={editingProduct.category || ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    placeholder="Category"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingProduct.description || ""}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  placeholder="Product description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="selling_price">Selling Price (K)</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    value={editingProduct.selling_price || 0}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        selling_price: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price (K)</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    value={editingProduct.cost_price || 0}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        cost_price: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                  <Input
                    id="unit_of_measure"
                    value={editingProduct.unit_of_measure || "Unit"}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unit_of_measure: e.target.value })
                    }
                  />
                </div>
              </div>

              {editingProduct.type === "product" && (
                <>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="track_inventory"
                      checked={editingProduct.track_inventory || false}
                      onCheckedChange={(checked) =>
                        setEditingProduct({ ...editingProduct, track_inventory: checked })
                      }
                    />
                    <Label htmlFor="track_inventory">Track Inventory</Label>
                  </div>

                  {editingProduct.track_inventory && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity_on_hand">Quantity on Hand</Label>
                        <Input
                          id="quantity_on_hand"
                          type="number"
                          value={editingProduct.quantity_on_hand || 0}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              quantity_on_hand: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reorder_point">Reorder Point</Label>
                        <Input
                          id="reorder_point"
                          type="number"
                          value={editingProduct.reorder_point || 0}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              reorder_point: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_taxable"
                    checked={editingProduct.is_taxable || false}
                    onCheckedChange={(checked) =>
                      setEditingProduct({ ...editingProduct, is_taxable: checked })
                    }
                  />
                  <Label htmlFor="is_taxable">Taxable (VAT)</Label>
                </div>
                {editingProduct.is_taxable && (
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      value={editingProduct.tax_rate || 16}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          tax_rate: parseFloat(e.target.value) || 16,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={editingProduct.is_active || false}
                  onCheckedChange={(checked) =>
                    setEditingProduct({ ...editingProduct, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveProductMutation.mutate(editingProduct)}
                  disabled={!editingProduct.name || saveProductMutation.isPending}
                >
                  {saveProductMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Price List Dialog */}
      <Dialog open={isPriceListDialogOpen} onOpenChange={setIsPriceListDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPriceList?.id ? "Edit" : "New"} Price List
            </DialogTitle>
          </DialogHeader>
          {editingPriceList && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pl_name">Name *</Label>
                <Input
                  id="pl_name"
                  value={editingPriceList.name || ""}
                  onChange={(e) =>
                    setEditingPriceList({ ...editingPriceList, name: e.target.value })
                  }
                  placeholder="Price list name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pl_description">Description</Label>
                <Textarea
                  id="pl_description"
                  value={editingPriceList.description || ""}
                  onChange={(e) =>
                    setEditingPriceList({ ...editingPriceList, description: e.target.value })
                  }
                  placeholder="Description"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pl_currency">Currency</Label>
                  <Select
                    value={editingPriceList.currency || "ZMW"}
                    onValueChange={(value) =>
                      setEditingPriceList({ ...editingPriceList, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZMW">ZMW</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="pl_is_default"
                    checked={editingPriceList.is_default || false}
                    onCheckedChange={(checked) =>
                      setEditingPriceList({ ...editingPriceList, is_default: checked })
                    }
                  />
                  <Label htmlFor="pl_is_default">Default Price List</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pl_valid_from">Valid From</Label>
                  <Input
                    id="pl_valid_from"
                    type="date"
                    value={editingPriceList.valid_from || ""}
                    onChange={(e) =>
                      setEditingPriceList({ ...editingPriceList, valid_from: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pl_valid_to">Valid To</Label>
                  <Input
                    id="pl_valid_to"
                    type="date"
                    value={editingPriceList.valid_to || ""}
                    onChange={(e) =>
                      setEditingPriceList({ ...editingPriceList, valid_to: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="pl_is_active"
                  checked={editingPriceList.is_active || false}
                  onCheckedChange={(checked) =>
                    setEditingPriceList({ ...editingPriceList, is_active: checked })
                  }
                />
                <Label htmlFor="pl_is_active">Active</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsPriceListDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => savePriceListMutation.mutate(editingPriceList)}
                  disabled={!editingPriceList.name || savePriceListMutation.isPending}
                >
                  {savePriceListMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
