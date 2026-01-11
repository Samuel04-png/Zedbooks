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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Download, Upload, Heart, DollarSign, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV } from "@/utils/exportToExcel";
import { ImportDialog } from "@/components/shared/ImportDialog";

interface Donor {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  organization_type: string | null;
  notes: string | null;
  total_donated: number;
  active_grants: number;
}

// We'll use the existing projects table to derive donors
export default function Donors() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  // Fetch unique donors from projects
  const { data: donorData = [], isLoading } = useQuery({
    queryKey: ["donors-from-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("donor_name, grant_reference, budget, spent, status")
        .order("donor_name");
      if (error) throw error;

      // Aggregate by donor name
      const donorMap = new Map<string, { grants: number; totalBudget: number; activeGrants: number }>();
      data.forEach((project: any) => {
        if (project.donor_name) {
          const existing = donorMap.get(project.donor_name) || { grants: 0, totalBudget: 0, activeGrants: 0 };
          donorMap.set(project.donor_name, {
            grants: existing.grants + 1,
            totalBudget: existing.totalBudget + (project.budget || 0),
            activeGrants: existing.activeGrants + (project.status === 'active' ? 1 : 0)
          });
        }
      });

      return Array.from(donorMap.entries()).map(([name, data]) => ({
        name,
        totalGrants: data.grants,
        totalBudget: data.totalBudget,
        activeGrants: data.activeGrants
      }));
    },
    enabled: !!user,
  });

  // Fetch all projects for the full list
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-donors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const filteredDonors = donorData.filter(
    (donor) => donor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDonations = donorData.reduce((sum, d) => sum + d.totalBudget, 0);
  const totalActiveGrants = donorData.reduce((sum, d) => sum + d.activeGrants, 0);
  const totalGrants = donorData.reduce((sum, d) => sum + d.totalGrants, 0);

  const exportDonors = () => {
    const columns = [
      { header: "Donor Name", key: "name" },
      { header: "Total Grants", key: "totalGrants" },
      { header: "Active Grants", key: "activeGrants" },
      { header: "Total Budget (ZMW)", key: "totalBudget" }
    ];
    exportToCSV(filteredDonors as any, columns, "donors-report");
  };

  const donorImportColumns = [
    { key: "name", header: "Project Name", required: true },
    { key: "donor_name", header: "Donor Name", required: true },
    { key: "grant_reference", header: "Grant Reference", required: false },
    { key: "budget", header: "Budget (ZMW)", required: false },
    { key: "start_date", header: "Start Date", required: false },
    { key: "end_date", header: "End Date", required: false }
  ];

  const handleDonorImport = async (data: any[]) => {
    for (const row of data) {
      const { error } = await supabase.from("projects").insert({
        name: row.name,
        donor_name: row.donor_name,
        grant_reference: row.grant_reference || null,
        budget: parseFloat(row.budget) || 0,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        status: "active",
        user_id: user?.id,
      });
      if (error) throw error;
    }
    queryClient.invalidateQueries({ queryKey: ["donors-from-projects"] });
    queryClient.invalidateQueries({ queryKey: ["projects-for-donors"] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Donors & Grants</h1>
          <p className="text-muted-foreground">
            Track donors and their grant contributions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={exportDonors}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Total Donors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{donorData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Total Grants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGrants}</div>
            <p className="text-xs text-muted-foreground">{totalActiveGrants} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Funding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDonations)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Avg. per Donor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(donorData.length > 0 ? totalDonations / donorData.length : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search donors..."
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
                <TableHead>Donor Name</TableHead>
                <TableHead className="text-right">Total Grants</TableHead>
                <TableHead className="text-right">Active Grants</TableHead>
                <TableHead className="text-right">Total Funding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonors.map((donor, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{donor.name}</TableCell>
                  <TableCell className="text-right">{donor.totalGrants}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={donor.activeGrants > 0 ? "default" : "secondary"}>
                      {donor.activeGrants}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(donor.totalBudget)}</TableCell>
                </TableRow>
              ))}
              {filteredDonors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No donors found. Add projects with donor information to see them here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Grants by Donor */}
      <Card>
        <CardHeader>
          <CardTitle>All Grants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grant Reference</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.filter(p => p.donor_name).map((project: any) => (
                <TableRow key={project.id}>
                  <TableCell className="font-mono">{project.grant_reference || "-"}</TableCell>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{project.donor_name}</TableCell>
                  <TableCell>
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(project.budget || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(project.spent || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleDonorImport}
        columns={donorImportColumns}
        title="Import Grants"
      />
    </div>
  );
}