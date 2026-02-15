import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, FileText, ClipboardList, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { exportToCSV } from "@/utils/exportToExcel";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tpin: string | null;
  contact_person: string | null;
  notes: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  payment_terms: string | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export default function Vendors() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tpin: "",
    contact_person: "",
    notes: "",
    bank_name: "",
    bank_account_number: "",
    payment_terms: "",
  });

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors", user?.id],
    queryFn: async () => {
      if (!user) return [] as Vendor[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as Vendor[];

      const vendorsRef = collection(firestore, COLLECTIONS.VENDORS);
      const snapshot = await getDocs(query(vendorsRef, where("companyId", "==", membership.companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
            email: (row.email as string | null) ?? null,
            phone: (row.phone as string | null) ?? null,
            address: (row.address as string | null) ?? null,
            tpin: (row.tpin as string | null) ?? null,
            contact_person: (row.contactPerson ?? row.contact_person ?? null) as string | null,
            notes: (row.notes as string | null) ?? null,
            bank_name: (row.bankName ?? row.bank_name ?? null) as string | null,
            bank_account_number: (row.bankAccountNumber ?? row.bank_account_number ?? null) as string | null,
            payment_terms: (row.paymentTerms ?? row.payment_terms ?? null) as string | null,
          } satisfies Vendor;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(user),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error("You must be logged in");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("No company profile found for your account");

      await addDoc(collection(firestore, COLLECTIONS.VENDORS), {
        companyId: membership.companyId,
        userId: user.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        tpin: data.tpin || null,
        contactPerson: data.contact_person || null,
        notes: data.notes || null,
        bankName: data.bank_name || null,
        bankAccountNumber: data.bank_account_number || null,
        paymentTerms: data.payment_terms || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors", user?.id] });
      toast.success("Vendor created successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create vendor: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await setDoc(
        doc(firestore, COLLECTIONS.VENDORS, id),
        {
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          tpin: data.tpin || null,
          contactPerson: data.contact_person || null,
          notes: data.notes || null,
          bankName: data.bank_name || null,
          bankAccountNumber: data.bank_account_number || null,
          paymentTerms: data.payment_terms || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors", user?.id] });
      toast.success("Vendor updated successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update vendor: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(firestore, COLLECTIONS.VENDORS, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors", user?.id] });
      toast.success("Vendor deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete vendor: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      tpin: "",
      contact_person: "",
      notes: "",
      bank_name: "",
      bank_account_number: "",
      payment_terms: "",
    });
    setEditingVendor(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      tpin: vendor.tpin || "",
      contact_person: vendor.contact_person || "",
      notes: vendor.notes || "",
      bank_name: vendor.bank_name || "",
      bank_account_number: vendor.bank_account_number || "",
      payment_terms: vendor.payment_terms || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredVendors = vendors?.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.phone?.includes(searchQuery),
  );

  const vendorImportColumns = [
    { key: "name", header: "Vendor Name", required: true },
    { key: "email", header: "Email", required: false },
    { key: "phone", header: "Phone", required: false },
    { key: "address", header: "Address", required: false },
    { key: "tpin", header: "TPIN", required: false },
    { key: "contact_person", header: "Contact Person", required: false },
    { key: "bank_name", header: "Bank Name", required: false },
    { key: "bank_account_number", header: "Bank Account", required: false },
    { key: "payment_terms", header: "Payment Terms", required: false },
  ];

  const handleVendorImport = async (data: Record<string, unknown>[]) => {
    if (!user) throw new Error("You must be logged in");

    const membership = await companyService.getPrimaryMembershipByUser(user.id);
    if (!membership?.companyId) throw new Error("No company profile found for your account");

    const payloads = data.map((row) => ({
      companyId: membership.companyId,
      userId: user.id,
      name: String(row.name || ""),
      email: (row.email as string) || null,
      phone: (row.phone as string) || null,
      address: (row.address as string) || null,
      tpin: (row.tpin as string) || null,
      contactPerson: (row.contact_person as string) || null,
      bankName: (row.bank_name as string) || null,
      bankAccountNumber: (row.bank_account_number as string) || null,
      paymentTerms: (row.payment_terms as string) || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    const vendorsRef = collection(firestore, COLLECTIONS.VENDORS);
    const batches = chunk(payloads, 400);

    for (const records of batches) {
      const batch = writeBatch(firestore);
      records.forEach((record) => {
        batch.set(doc(vendorsRef), record);
      });
      await batch.commit();
    }

    queryClient.invalidateQueries({ queryKey: ["vendors", user?.id] });
  };

  const exportVendors = () => {
    if (!filteredVendors?.length) return;
    const columns = [
      { header: "Vendor Name", key: "name" },
      { header: "Contact Person", key: "contact_person" },
      { header: "Email", key: "email" },
      { header: "Phone", key: "phone" },
      { header: "Address", key: "address" },
      { header: "TPIN", key: "tpin" },
      { header: "Bank Name", key: "bank_name" },
      { header: "Bank Account", key: "bank_account_number" },
      { header: "Payment Terms", key: "payment_terms" },
    ];
    exportToCSV(filteredVendors as Record<string, unknown>[], columns, "vendors-export");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">Manage your suppliers and vendors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={exportVendors}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVendor ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Vendor Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Person</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpin">TPIN</Label>
                    <Input
                      id="tpin"
                      value={formData.tpin}
                      onChange={(e) => setFormData({ ...formData, tpin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Input
                      id="payment_terms"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      placeholder="e.g., Net 30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Bank Account Number</Label>
                    <Input
                      id="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingVendor ? "Update" : "Create"} Vendor</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>TPIN</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors?.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>{vendor.contact_person || "-"}</TableCell>
                  <TableCell>{vendor.email || "-"}</TableCell>
                  <TableCell>{vendor.phone || "-"}</TableCell>
                  <TableCell>{vendor.tpin || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/purchase-orders`)} title="Create Purchase Order">
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/bills`)} title="Create Bill">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(vendor)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(vendor.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredVendors?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No vendors found. Add your first vendor!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleVendorImport}
        columns={vendorImportColumns}
        title="Import Vendors"
      />
    </div>
  );
}
