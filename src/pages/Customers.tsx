import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Pencil, Trash2, FileText, ClipboardList, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { ImportColumn, transformers } from "@/utils/importFromExcel";
import { exportToCSV, ExportColumn } from "@/utils/exportToExcel";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tpin: string | null;
  contact_person: string | null;
  notes: string | null;
  project_id: string | null;
  grant_reference: string | null;
}

const customerImportColumns: ImportColumn[] = [
  { header: "Name", key: "name", required: true, transform: transformers.trim },
  { header: "Email", key: "email", transform: transformers.trim },
  { header: "Phone", key: "phone", transform: transformers.trim },
  { header: "Address", key: "address", transform: transformers.trim },
  { header: "TPIN", key: "tpin", transform: transformers.trim },
  { header: "Contact Person", key: "contact_person", transform: transformers.trim },
  { header: "Notes", key: "notes", transform: transformers.trim },
  { header: "Grant Reference", key: "grant_reference", transform: transformers.trim },
];

const customerExportColumns: ExportColumn[] = [
  { header: "Name", key: "name" },
  { header: "Email", key: "email" },
  { header: "Phone", key: "phone" },
  { header: "TPIN", key: "tpin" },
  { header: "Contact Person", key: "contact_person" },
  { header: "Address", key: "address" },
  { header: "Grant Reference", key: "grant_reference" },
  { header: "Notes", key: "notes" },
];

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tpin: "",
    contact_person: "",
    notes: "",
    project_id: "",
    grant_reference: "",
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("customers").insert({
        ...data,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create customer: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("customers")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update customer: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete customer: " + error.message);
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
      project_id: "",
      grant_reference: "",
    });
    setEditingCustomer(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      tpin: customer.tpin || "",
      contact_person: customer.contact_person || "",
      notes: customer.notes || "",
      project_id: customer.project_id || "",
      grant_reference: customer.grant_reference || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCustomers = customers?.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery)
  );

  const handleImport = async (data: Record<string, unknown>[]) => {
    for (const item of data) {
      const insertData = {
        name: item.name as string,
        email: item.email as string || null,
        phone: item.phone as string || null,
        address: item.address as string || null,
        tpin: item.tpin as string || null,
        contact_person: item.contact_person as string || null,
        notes: item.notes as string || null,
        grant_reference: item.grant_reference as string || null,
        user_id: user?.id as string,
      };
      await supabase.from("customers").insert(insertData);
    }
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    toast.success(`Imported ${data.length} customers`);
  };

  const handleExport = () => {
    if (!customers || customers.length === 0) {
      toast.error("No customers to export");
      return;
    }
    exportToCSV(customers as any, customerExportColumns, "customers-export");
    toast.success("Customers exported");
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customers and their information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_person: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpin">TPIN</Label>
                  <Input
                    id="tpin"
                    value={formData.tpin}
                    onChange={(e) =>
                      setFormData({ ...formData, tpin: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project Reference</Label>
                  <Input
                    id="project_id"
                    value={formData.project_id}
                    onChange={(e) =>
                      setFormData({ ...formData, project_id: e.target.value })
                    }
                    placeholder="For NGO project tracking"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grant_reference">Grant Reference</Label>
                  <Input
                    id="grant_reference"
                    value={formData.grant_reference}
                    onChange={(e) =>
                      setFormData({ ...formData, grant_reference: e.target.value })
                    }
                    placeholder="For donor/grant tracking"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCustomer ? "Update" : "Create"} Customer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Customers"
        description="Upload a CSV file to import customers in bulk"
        columns={customerImportColumns}
        onImport={handleImport}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
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
              {filteredCustomers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.contact_person || "-"}</TableCell>
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>{customer.phone || "-"}</TableCell>
                  <TableCell>{customer.tpin || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/quotations/new?customer=${customer.id}`)}
                        title="Create Quotation"
                      >
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/invoices/new?customer=${customer.id}`)}
                        title="Create Invoice"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
