import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { format } from "date-fns";
import { ClipboardList, DollarSign, Download, FolderOpen, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  PROJECT_PHASES,
  computeProjectProgressMap,
  projectActivityService,
  type ProjectProgressStatus,
} from "@/services/firebase/projectActivityService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface Project {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  spent: number | null;
  donor_name: string | null;
  grant_reference: string | null;
  current_phase: string | null;
  created_by: string | null;
  created_at: string;
}

const progressStatusStyles: Record<ProjectProgressStatus, { label: string; dotClass: string; badgeClass: string }> = {
  in_progress: {
    label: "In Progress",
    dotClass: "bg-warning",
    badgeClass: "border-warning/30 bg-warning/15 text-warning",
  },
  behind: {
    label: "Behind",
    dotClass: "bg-destructive",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  on_track: {
    label: "On Track",
    dotClass: "bg-success",
    badgeClass: "border-success/30 bg-success/10 text-success",
  },
  completed: {
    label: "Completed",
    dotClass: "bg-sky-600",
    badgeClass: "border-sky-300 bg-sky-50 text-sky-700",
  },
};

export default function Projects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    status: "active",
    start_date: "",
    end_date: "",
    budget: "",
    donor_name: "",
    grant_reference: "",
    current_phase: "Initiation",
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);

  const { data: companyId } = useQuery({
    queryKey: ["projects-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Project[];

      const ref = collection(firestore, COLLECTIONS.PROJECTS);
      const snapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const createdAt = row.createdAt ?? row.created_at;
          const createdAtIso = typeof createdAt === "string"
            ? createdAt
            : (createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString();

          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
            code: (row.code ?? null) as string | null,
            description: (row.description ?? null) as string | null,
            status: (row.status ?? "active") as string | null,
            start_date: (row.startDate ?? row.start_date ?? null) as string | null,
            end_date: (row.endDate ?? row.end_date ?? null) as string | null,
            budget: Number(row.budget ?? 0),
            spent: Number(row.spent ?? 0),
            donor_name: (row.donorName ?? row.donor_name ?? null) as string | null,
            grant_reference: (row.grantReference ?? row.grant_reference ?? null) as string | null,
            current_phase: (row.currentPhase ?? row.current_phase ?? null) as string | null,
            created_by: (row.createdBy ?? row.created_by ?? null) as string | null,
            created_at: createdAtIso,
          } satisfies Project;
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    enabled: Boolean(companyId),
    refetchInterval: 20000,
  });

  const { data: projectActivityLogs = [] } = useQuery({
    queryKey: ["project-activity-logs", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return projectActivityService.listByCompany(companyId, { limitCount: 3000 });
    },
    enabled: Boolean(companyId),
    refetchInterval: 15000,
  });

  const progressByProject = useMemo(
    () => computeProjectProgressMap(projects, projectActivityLogs),
    [projects, projectActivityLogs],
  );

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId || !user) throw new Error("No active company context");

      const createdProject = await addDoc(collection(firestore, COLLECTIONS.PROJECTS), {
        companyId,
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        status: data.status,
        currentPhase: data.current_phase || "Initiation",
        startDate: data.start_date || null,
        endDate: data.end_date || null,
        budget: data.budget ? Number.parseFloat(data.budget) : 0,
        spent: 0,
        donorName: data.donor_name || null,
        grantReference: data.grant_reference || null,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await projectActivityService.create({
        companyId,
        projectId: createdProject.id,
        activity: "Project Created",
        description: `${data.name} workspace created`,
        source: "Projects Dashboard",
        sourceType: COLLECTIONS.PROJECTS,
        sourceId: createdProject.id,
        phase: data.current_phase || "Initiation",
        status: "pending",
        approvalStatus: "pending",
        appliedToSection: "Project Setup",
        implemented: false,
        createdBy: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity-logs", companyId] });
      toast.success("Project created successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create project: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      if (!companyId || !user) throw new Error("No active company context");

      await setDoc(
        doc(firestore, COLLECTIONS.PROJECTS, id),
        {
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          status: data.status,
          currentPhase: data.current_phase || "Initiation",
          startDate: data.start_date || null,
          endDate: data.end_date || null,
          budget: data.budget ? Number.parseFloat(data.budget) : 0,
          donorName: data.donor_name || null,
          grantReference: data.grant_reference || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await projectActivityService.create({
        companyId,
        projectId: id,
        activity: "Project Updated",
        description: `${data.name} details updated`,
        source: "Projects Dashboard",
        sourceType: COLLECTIONS.PROJECTS,
        sourceId: id,
        phase: data.current_phase || "Initiation",
        status: data.status === "completed" ? "completed" : "implemented",
        approvalStatus: data.status === "completed" ? "approved" : null,
        appliedToSection: "Project Plan",
        milestoneName: data.status === "completed" ? "Project Completion" : null,
        milestoneAchieved: data.status === "completed",
        implemented: true,
        createdBy: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity-logs", companyId] });
      toast.success("Project updated successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update project: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (project: Project) => {
      if (!companyId || !user) throw new Error("No active company context");

      await projectActivityService.create({
        companyId,
        projectId: project.id,
        activity: "Project Removed",
        description: `${project.name} was removed from active projects`,
        source: "Projects Dashboard",
        sourceType: COLLECTIONS.PROJECTS,
        sourceId: project.id,
        phase: project.current_phase,
        status: "implemented",
        appliedToSection: "Project Setup",
        implemented: true,
        createdBy: user.id,
      });

      await deleteDoc(doc(firestore, COLLECTIONS.PROJECTS, project.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity-logs", companyId] });
      toast.success("Project deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete project: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      status: "active",
      start_date: "",
      end_date: "",
      budget: "",
      donor_name: "",
      grant_reference: "",
      current_phase: "Initiation",
    });
    setEditingProject(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      code: project.code || "",
      description: project.description || "",
      status: project.status || "active",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      budget: project.budget?.toString() || "",
      donor_name: project.donor_name || "",
      grant_reference: project.grant_reference || "",
      current_phase: project.current_phase || "Initiation",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: formData });
      return;
    }
    createMutation.mutate(formData);
  };

  const exportProjects = () => {
    if (projects.length === 0) return;

    const headers = [
      "Project Code",
      "Name",
      "Donor",
      "Grant Reference",
      "Status",
      "Current Phase",
      "Completion",
      "Progress Status",
      "Start Date",
      "End Date",
      "Budget",
      "Spent",
      "Remaining",
    ];

    const rows = projects.map((project) => {
      const progress = progressByProject.get(project.id);
      return [
        project.code || "",
        project.name,
        project.donor_name || "",
        project.grant_reference || "",
        project.status || "",
        progress?.currentPhase || project.current_phase || "Initiation",
        `${progress?.completion ?? 0}%`,
        progress ? progressStatusStyles[progress.status].label : "In Progress",
        project.start_date || "",
        project.end_date || "",
        project.budget || 0,
        project.spent || 0,
        (project.budget || 0) - (project.spent || 0),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "projects-grants.csv";
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const totalBudget = projects.reduce((sum, project) => sum + (project.budget || 0), 0);
  const totalSpent = projects.reduce((sum, project) => sum + (project.spent || 0), 0);
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const avgCompletion = projects.length
    ? Math.round(
        projects.reduce((sum, project) => sum + (progressByProject.get(project.id)?.completion || 0), 0)
          / projects.length,
      )
    : 0;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects & Grants</h1>
          <p className="text-muted-foreground">Manage donor-funded projects and track real-time progression</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportProjects} disabled={projects.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingProject ? "Edit Project" : "Add New Project"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Project Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project Code</Label>
                    <Input
                      value={formData.code}
                      onChange={(event) => setFormData({ ...formData, code: event.target.value })}
                      placeholder="e.g., PRJ-001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Donor Name</Label>
                    <Input
                      value={formData.donor_name}
                      onChange={(event) => setFormData({ ...formData, donor_name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grant Reference</Label>
                    <Input
                      value={formData.grant_reference}
                      onChange={(event) => setFormData({ ...formData, grant_reference: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Phase</Label>
                    <Select
                      value={formData.current_phase}
                      onValueChange={(value) => setFormData({ ...formData, current_phase: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_PHASES.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Budget (ZMW)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.budget}
                      onChange={(event) => setFormData({ ...formData, budget: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(event) => setFormData({ ...formData, start_date: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(event) => setFormData({ ...formData, end_date: event.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingProject ? "Update" : "Create"} Project</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FolderOpen className="h-4 w-4" />
              Total Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">{activeProjects} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Average Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCompletion}%</div>
            <Progress value={avgCompletion} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget - totalSpent)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Current Phase</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      No projects found. Create your first project to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => {
                    const progress = progressByProject.get(project.id) ?? {
                      completion: 0,
                      currentPhase: project.current_phase || "Initiation",
                      status: "in_progress" as ProjectProgressStatus,
                      metrics: {
                        completedActivities: 0,
                        totalActivities: 0,
                        approvedSections: 0,
                        totalSections: 0,
                        milestonesAchieved: 0,
                        totalMilestones: 0,
                        pendingCount: 0,
                        implementedCount: 0,
                      },
                    };
                    const statusStyle = progressStatusStyles[progress.status];

                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-mono">{project.code || "-"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{project.name}</p>
                            <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                              {project.description || "No description"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{project.donor_name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {progress.currentPhase}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-[240px] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{progress.completion}%</span>
                              <span className="text-muted-foreground">
                                {progress.metrics.completedActivities}/{Math.max(progress.metrics.totalActivities, progress.metrics.completedActivities)} done
                              </span>
                            </div>
                            <Progress value={progress.completion} className="h-2" />
                            <p className="text-[11px] text-muted-foreground">
                              {progress.metrics.implementedCount} implemented • {progress.metrics.pendingCount} pending • {progress.metrics.milestonesAchieved}/{Math.max(progress.metrics.totalMilestones, progress.metrics.milestonesAchieved)} milestones
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusStyle.dotClass}`} />
                            <Badge variant="outline" className={statusStyle.badgeClass}>
                              {statusStyle.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {project.start_date && project.end_date
                            ? `${format(new Date(project.start_date), "MMM yyyy")} - ${format(new Date(project.end_date), "MMM yyyy")}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(project.budget || 0)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link to={`/projects/${project.id}/expenses`}>
                              <Button variant="ghost" size="icon" title="View Expenses">
                                <Receipt className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/projects/${project.id}/activity-log`}>
                              <Button variant="ghost" size="icon" title="View Activity Log">
                                <ClipboardList className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(project)} title="Edit Project">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(project)}
                              title="Delete Project"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

