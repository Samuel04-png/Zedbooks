import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardList, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProjectWorkspaceTab = "expenses" | "activity-log";

interface ProjectWorkspaceHeaderProps {
  projectId?: string;
  projectName?: string;
  subtitle?: string;
  activeTab: ProjectWorkspaceTab;
  actions?: ReactNode;
}

const tabButtonClass = (active: boolean) =>
  cn(
    "h-9 gap-2 px-3 text-xs sm:text-sm",
    active
      ? "bg-warning/15 text-warning hover:bg-warning/20"
      : "text-muted-foreground hover:text-foreground",
  );

export function ProjectWorkspaceHeader({
  projectId,
  projectName,
  subtitle,
  activeTab,
  actions,
}: ProjectWorkspaceHeaderProps) {
  const expensesHref = projectId ? `/projects/${projectId}/expenses` : "/projects";
  const activityLogHref = projectId ? `/projects/${projectId}/activity-log` : "/projects";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Link to="/projects">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {projectName || "Project Workspace"}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1">
        <Link to={expensesHref}>
          <Button
            type="button"
            variant={activeTab === "expenses" ? "secondary" : "ghost"}
            className={tabButtonClass(activeTab === "expenses")}
          >
            <Receipt className="h-4 w-4" />
            Expenses
          </Button>
        </Link>
        <Link to={activityLogHref}>
          <Button
            type="button"
            variant={activeTab === "activity-log" ? "secondary" : "ghost"}
            className={tabButtonClass(activeTab === "activity-log")}
            title="Project Activity Log"
          >
            <ClipboardList className="h-4 w-4" />
            Activity Log
          </Button>
        </Link>
      </div>
    </div>
  );
}

