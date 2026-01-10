import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Clock, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, differenceInDays, isAfter, isBefore, addDays } from "date-fns";

interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  spent: number | null;
  donor_name: string | null;
}

export function ProjectTimeline() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-timeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as Project[];
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const getProjectProgress = (project: Project) => {
    if (!project.start_date || !project.end_date) return 0;
    const start = new Date(project.start_date);
    const end = new Date(project.end_date);
    const now = new Date();
    
    if (isBefore(now, start)) return 0;
    if (isAfter(now, end)) return 100;
    
    const totalDays = differenceInDays(end, start);
    const elapsedDays = differenceInDays(now, start);
    return Math.round((elapsedDays / totalDays) * 100);
  };

  const getTimelineStatus = (project: Project) => {
    if (!project.end_date) return { status: "no-date", label: "No end date", color: "secondary" as const };
    
    const now = new Date();
    const endDate = new Date(project.end_date);
    const daysRemaining = differenceInDays(endDate, now);
    
    if (project.status === "completed") {
      return { status: "completed", label: "Completed", color: "default" as const };
    }
    if (daysRemaining < 0) {
      return { status: "overdue", label: `${Math.abs(daysRemaining)} days overdue`, color: "destructive" as const };
    }
    if (daysRemaining <= 30) {
      return { status: "ending-soon", label: `${daysRemaining} days left`, color: "secondary" as const };
    }
    return { status: "on-track", label: `${daysRemaining} days left`, color: "outline" as const };
  };

  const getBudgetStatus = (project: Project) => {
    if (!project.budget) return null;
    const utilization = ((project.spent || 0) / project.budget) * 100;
    if (utilization > 100) return { label: "Over budget", variant: "destructive" as const };
    if (utilization > 80) return { label: "Near limit", variant: "secondary" as const };
    return { label: "On track", variant: "outline" as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Group projects by status
  const activeProjects = projects.filter(p => p.status === "active");
  const upcomingProjects = projects.filter(p => {
    if (p.status !== "active" && p.start_date) {
      return isAfter(new Date(p.start_date), new Date());
    }
    return false;
  });
  const completedProjects = projects.filter(p => p.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Project Timeline</h2>
          <p className="text-muted-foreground">Visual overview of project schedules and progress</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Ending Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter(p => {
                const status = getTimelineStatus(p);
                return status.status === "ending-soon" || status.status === "overdue";
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline View */}
      <Card>
        <CardHeader>
          <CardTitle>Active Projects Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {activeProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No active projects
                </p>
              ) : (
                activeProjects.map((project) => {
                  const progress = getProjectProgress(project);
                  const timelineStatus = getTimelineStatus(project);
                  const budgetStatus = getBudgetStatus(project);
                  const budgetUtilization = project.budget 
                    ? ((project.spent || 0) / project.budget) * 100 
                    : 0;

                  return (
                    <div
                      key={project.id}
                      className="relative border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{project.name}</h3>
                            {project.code && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {project.code}
                              </Badge>
                            )}
                          </div>
                          {project.donor_name && (
                            <p className="text-sm text-muted-foreground">
                              {project.donor_name}
                            </p>
                          )}
                        </div>
                        <Badge variant={timelineStatus.color}>
                          {timelineStatus.label}
                        </Badge>
                      </div>

                      {/* Date Range */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {project.start_date 
                            ? format(new Date(project.start_date), "MMM dd, yyyy")
                            : "No start date"
                          }
                        </div>
                        <span>→</span>
                        <div>
                          {project.end_date 
                            ? format(new Date(project.end_date), "MMM dd, yyyy")
                            : "No end date"
                          }
                        </div>
                      </div>

                      {/* Time Progress */}
                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Time Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {/* Budget Progress */}
                      {project.budget && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Budget: {formatCurrency(project.budget)}
                            </span>
                            <span className="flex items-center gap-2">
                              {budgetStatus && (
                                <Badge variant={budgetStatus.variant} className="text-xs">
                                  {budgetStatus.label}
                                </Badge>
                              )}
                              <span className="font-medium">{budgetUtilization.toFixed(0)}% used</span>
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(budgetUtilization, 100)} 
                            className={`h-2 ${budgetUtilization > 100 ? '[&>div]:bg-destructive' : ''}`}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Spent: {formatCurrency(project.spent || 0)}</span>
                            <span>Remaining: {formatCurrency((project.budget || 0) - (project.spent || 0))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Completed & Upcoming */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Recently Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {completedProjects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No completed projects
                  </p>
                ) : (
                  completedProjects.slice(0, 5).map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.end_date && format(new Date(project.end_date), "MMM dd, yyyy")}
                        </p>
                      </div>
                      {project.budget && (
                        <span className="text-sm font-mono">
                          {formatCurrency(project.spent || 0)} / {formatCurrency(project.budget)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {upcomingProjects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No upcoming projects
                  </p>
                ) : (
                  upcomingProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Starts: {project.start_date && format(new Date(project.start_date), "MMM dd, yyyy")}
                        </p>
                      </div>
                      {project.budget && (
                        <Badge variant="outline">
                          {formatCurrency(project.budget)}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
