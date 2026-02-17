import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Filter, Search, X } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { projectActivityService } from "@/services/firebase/projectActivityService";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ProjectDetails {
  id: string;
  name: string;
  budget: number;
  spent: number;
}

interface FilterState {
  roles: string[];
  assignees: string[];
  phases: string[];
  disciplines: string[];
  approvalStatuses: string[];
  appliedSections: string[];
  statuses: string[];
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 20;

const emptyFilters: FilterState = {
  roles: [],
  assignees: [],
  phases: [],
  disciplines: [],
  approvalStatuses: [],
  appliedSections: [],
  statuses: [],
  startDate: "",
  endDate: "",
};

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const toggleOption = (value: string, checked: boolean | "indeterminate") => {
    if (checked) {
      onChange(Array.from(new Set([...selected, value])));
      return;
    }
    onChange(selected.filter((item) => item !== value));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 justify-between gap-2",
            selected.length > 0 && "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          <span className="truncate text-left">{label}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {selected.length || "All"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {selected.length > 0 && (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onChange([]);
              }}
            >
              Clear selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.length === 0 ? (
          <DropdownMenuItem disabled>No options</DropdownMenuItem>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={(checked) => toggleOption(option, checked)}
            >
              {option}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())))).sort((a, b) =>
    a.localeCompare(b),
  );

const normalizeDate = (value: string) => value.slice(0, 10);

const statusClass = (status: string | null) => {
  const normalized = (status || "").toLowerCase();
  if (["approved", "completed", "implemented", "done"].includes(normalized)) {
    return "border-success/30 bg-success/10 text-success";
  }
  if (["pending", "in_progress", "in progress"].includes(normalized)) {
    return "border-warning/30 bg-warning/15 text-warning";
  }
  if (["behind", "rejected", "blocked"].includes(normalized)) {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/40 text-muted-foreground";
};

export default function ProjectActivityLog() {
  const { user } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [fullText, setFullText] = useState<{ label: string; value: string } | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);

  const { data: companyId } = useQuery({
    queryKey: ["project-activity-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: project } = useQuery({
    queryKey: ["project-summary", companyId, projectId],
    queryFn: async () => {
      if (!projectId || !companyId) return null;
      const snap = await getDoc(doc(firestore, COLLECTIONS.PROJECTS, projectId));
      if (!snap.exists()) return null;

      const row = snap.data() as Record<string, unknown>;
      if (String(row.companyId ?? "") !== companyId) return null;

      return {
        id: snap.id,
        name: String(row.name ?? "Project"),
        budget: Number(row.budget ?? 0),
        spent: Number(row.spent ?? 0),
      } satisfies ProjectDetails;
    },
    enabled: Boolean(companyId && projectId),
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["project-activity-log", companyId, projectId],
    queryFn: async () => {
      if (!companyId || !projectId) return [];
      return projectActivityService.listByProject(companyId, projectId, { limitCount: 3000 });
    },
    enabled: Boolean(companyId && projectId),
    refetchInterval: 15000,
  });

  const options = useMemo(
    () => ({
      roles: uniqueValues(logs.map((log) => log.role)),
      assignees: uniqueValues(logs.map((log) => log.assignedTo)),
      phases: uniqueValues(logs.map((log) => log.phase)),
      disciplines: uniqueValues(logs.map((log) => log.discipline)),
      approvalStatuses: uniqueValues(logs.map((log) => log.approvalStatus)),
      appliedSections: uniqueValues(logs.map((log) => log.appliedToSection)),
      statuses: uniqueValues(logs.map((log) => log.status)),
    }),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const createdAtDate = normalizeDate(log.createdAt);
      if (filters.startDate && createdAtDate < filters.startDate) return false;
      if (filters.endDate && createdAtDate > filters.endDate) return false;

      if (filters.roles.length > 0 && !filters.roles.includes(log.role || "")) return false;
      if (filters.assignees.length > 0 && !filters.assignees.includes(log.assignedTo || "")) return false;
      if (filters.phases.length > 0 && !filters.phases.includes(log.phase || "")) return false;
      if (filters.disciplines.length > 0 && !filters.disciplines.includes(log.discipline || "")) return false;
      if (filters.approvalStatuses.length > 0 && !filters.approvalStatuses.includes(log.approvalStatus || "")) return false;
      if (filters.appliedSections.length > 0 && !filters.appliedSections.includes(log.appliedToSection || "")) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(log.status || "")) return false;

      if (!needle) return true;

      const searchableFields = [
        log.activity,
        log.description,
        log.source,
        log.role,
        log.assignedTo,
        log.phase,
        log.discipline,
        log.approvalStatus,
        log.appliedToSection,
        log.status,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return searchableFields.some((value) => value.includes(needle));
    });
  }, [logs, filters, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pagedLogs = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(from, from + PAGE_SIZE);
  }, [filteredLogs, page]);

  const hasActiveFilters = Boolean(
    searchTerm
      || filters.roles.length
      || filters.assignees.length
      || filters.phases.length
      || filters.disciplines.length
      || filters.approvalStatuses.length
      || filters.appliedSections.length
      || filters.statuses.length
      || filters.startDate
      || filters.endDate,
  );

  const clearAllFilters = () => {
    setFilters(emptyFilters);
    setSearchTerm("");
    setPage(1);
  };

  const activeFilterChips = [
    ...filters.roles.map((value) => ({
      key: `role-${value}`,
      label: `Role: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, roles: prev.roles.filter((item) => item !== value) })),
    })),
    ...filters.assignees.map((value) => ({
      key: `assigned-${value}`,
      label: `Assigned: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, assignees: prev.assignees.filter((item) => item !== value) })),
    })),
    ...filters.phases.map((value) => ({
      key: `phase-${value}`,
      label: `Phase: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, phases: prev.phases.filter((item) => item !== value) })),
    })),
    ...filters.disciplines.map((value) => ({
      key: `discipline-${value}`,
      label: `Discipline: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, disciplines: prev.disciplines.filter((item) => item !== value) })),
    })),
    ...filters.approvalStatuses.map((value) => ({
      key: `approval-${value}`,
      label: `Approval: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, approvalStatuses: prev.approvalStatuses.filter((item) => item !== value) })),
    })),
    ...filters.appliedSections.map((value) => ({
      key: `section-${value}`,
      label: `Section: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, appliedSections: prev.appliedSections.filter((item) => item !== value) })),
    })),
    ...filters.statuses.map((value) => ({
      key: `status-${value}`,
      label: `Status: ${value}`,
      clear: () => setFilters((prev) => ({ ...prev, statuses: prev.statuses.filter((item) => item !== value) })),
    })),
    ...(filters.startDate
      ? [
          {
            key: "start-date",
            label: `From: ${filters.startDate}`,
            clear: () => setFilters((prev) => ({ ...prev, startDate: "" })),
          },
        ]
      : []),
    ...(filters.endDate
      ? [
          {
            key: "end-date",
            label: `To: ${filters.endDate}`,
            clear: () => setFilters((prev) => ({ ...prev, endDate: "" })),
          },
        ]
      : []),
  ];

  const healthStats = projectActivityService.getProjectHealthStats(filteredLogs);

  const renderFullTextCell = (
    value: string | null | undefined,
    label: string,
    widthClass = "max-w-[220px]",
  ) => {
    const text = value && value.trim() ? value.trim() : "-";
    const clickable = text !== "-";

    return (
      <button
        type="button"
        className={cn(
          "truncate text-left text-sm",
          widthClass,
          clickable ? "cursor-pointer hover:text-warning" : "cursor-default text-muted-foreground",
        )}
        onClick={() => {
          if (!clickable) return;
          setFullText({ label, value: text });
        }}
      >
        {text}
      </button>
    );
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full space-y-6">
      <ProjectWorkspaceHeader
        projectId={projectId}
        projectName={project ? `${project.name} - Activity Log` : "Project Activity Log"}
        subtitle={
          project
            ? `Budget: ${formatCurrency(project.budget)} | Spent: ${formatCurrency(project.spent)}`
            : "Track project activities, approvals, and implementation progress"
        }
        activeTab="activity-log"
        actions={<Badge variant="outline">{filteredLogs.length} records</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Implemented</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.implementedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Signal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.completion}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Advanced Filters
          </CardTitle>
          <Button variant="outline" onClick={clearAllFilters} disabled={!hasActiveFilters}>
            Clear All
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search activity, description, role, source..."
                />
              </div>
            </div>
            <MultiSelectFilter
              label="Role"
              options={options.roles}
              selected={filters.roles}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, roles: values }));
                setPage(1);
              }}
            />
            <MultiSelectFilter
              label="Assigned To"
              options={options.assignees}
              selected={filters.assignees}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, assignees: values }));
                setPage(1);
              }}
            />
            <MultiSelectFilter
              label="Phase"
              options={options.phases}
              selected={filters.phases}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, phases: values }));
                setPage(1);
              }}
            />
            <MultiSelectFilter
              label="Discipline"
              options={options.disciplines}
              selected={filters.disciplines}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, disciplines: values }));
                setPage(1);
              }}
            />
            <MultiSelectFilter
              label="Approval Status"
              options={options.approvalStatuses}
              selected={filters.approvalStatuses}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, approvalStatuses: values }));
                setPage(1);
              }}
            />
            <MultiSelectFilter
              label="Applied To Section"
              options={options.appliedSections}
              selected={filters.appliedSections}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, appliedSections: values }));
                setPage(1);
              }}
            />
            <MultiSelectFilter
              label="Status"
              options={options.statuses}
              selected={filters.statuses}
              onChange={(values) => {
                setFilters((prev) => ({ ...prev, statuses: values }));
                setPage(1);
              }}
            />
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, startDate: event.target.value }));
                setPage(1);
              }}
              placeholder="Start date"
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, endDate: event.target.value }));
                setPage(1);
              }}
              placeholder="End date"
            />
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <Badge key={chip.key} variant="outline" className="gap-1 border-warning/40 bg-warning/10 text-warning">
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => {
                      chip.clear();
                      setPage(1);
                    }}
                    className="rounded-full p-0.5 hover:bg-warning/20"
                    aria-label={`Clear ${chip.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Project Activity Log</CardTitle>
          <Badge variant="outline">
            Page {page} of {totalPages}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Approval Status</TableHead>
                  <TableHead>Applied To</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                      No activity records matched the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>{renderFullTextCell(log.activity, "Activity")}</TableCell>
                      <TableCell>{renderFullTextCell(log.description || "-", "Description", "max-w-[300px]")}</TableCell>
                      <TableCell>
                        {renderFullTextCell(
                          `${log.source}${log.sourceType ? ` (${log.sourceType})` : ""}`,
                          "Source",
                        )}
                      </TableCell>
                      <TableCell>{renderFullTextCell(log.role || "-", "Role", "max-w-[160px]")}</TableCell>
                      <TableCell>{renderFullTextCell(log.assignedTo || "-", "Assigned To", "max-w-[180px]")}</TableCell>
                      <TableCell>{renderFullTextCell(log.phase || "-", "Phase", "max-w-[140px]")}</TableCell>
                      <TableCell>{renderFullTextCell(log.discipline || "-", "Discipline", "max-w-[160px]")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(log.approvalStatus)}>
                          {log.approvalStatus || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{renderFullTextCell(log.appliedToSection || "-", "Applied To Section", "max-w-[220px]")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(log.status)}>
                          {log.status || "-"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Showing {filteredLogs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              -{Math.min(page * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(fullText)} onOpenChange={(open) => !open && setFullText(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{fullText?.label || "Details"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {fullText?.value}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

