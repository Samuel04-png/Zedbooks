import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
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

export default function Products() {
  const [activeTab, setActiveTab] = useState("catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isPriceListDialogOpen, setIsPriceListDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingPriceList, setEditingPriceList] = useState<Partial<PriceList> | null>(null);
  const queryClient = useQueryClient();

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products", searchTerm, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("products_services")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch price lists
  const { data: priceLists, isLoading: priceListsLoading } = useQuery({
    queryKey: ["priceLists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PriceList[];
    },
  });

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async (product: Partial<Product>) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const productData = {
        name: product.name || "",
        sku: product.sku,
        description: product.description,
        type: product.type || "product",
        category: product.category,
        unit_of_measure: product.unit_of_measure,
        selling_price: product.selling_price,
        cost_price: product.cost_price,
        track_inventory: product.track_inventory,
        quantity_on_hand: product.quantity_on_hand,
        reorder_point: product.reorder_point,
        is_taxable: product.is_taxable,
        tax_rate: product.tax_rate,
        is_active: product.is_active,
        company_id: profile.company_id,
      };

      if (product.id) {
        const { error } = await supabase
          .from("products_services")
          .update(productData)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products_services")
          .insert(productData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      toast.success(editingProduct?.id ? "Product updated" : "Product created");
    },
    onError: (error) => {
      toast.error("Failed to save product: " + error.message);
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products_services")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete product: " + error.message);
    },
  });

  // Save price list mutation
  const savePriceListMutation = useMutation({
    mutationFn: async (priceList: Partial<PriceList>) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const priceListData = {
        name: priceList.name || "",
        description: priceList.description,
        currency: priceList.currency,
        is_default: priceList.is_default,
        is_active: priceList.is_active,
        valid_from: priceList.valid_from,
        valid_to: priceList.valid_to,
        company_id: profile.company_id,
      };

      if (priceList.id) {
        const { error } = await supabase
          .from("price_lists")
          .update(priceListData)
          .eq("id", priceList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("price_lists")
          .insert(priceListData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priceLists"] });
      setIsPriceListDialogOpen(false);
      setEditingPriceList(null);
      toast.success(editingPriceList?.id ? "Price list updated" : "Price list created");
    },
    onError: (error) => {
      toast.error("Failed to save price list: " + error.message);
    },
  });

  // Delete price list mutation
  const deletePriceListMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("price_lists")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priceLists"] });
      toast.success("Price list deleted");
    },
    onError: (error) => {
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
          ) : !products?.length ? (
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
                  {products.map((product) => (
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteProductMutation.mutate(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletePriceListMutation.mutate(priceList.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
