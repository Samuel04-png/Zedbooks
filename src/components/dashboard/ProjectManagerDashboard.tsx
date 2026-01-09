import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BriefcaseIcon, DollarSign, Clock, AlertCircle, TrendingUp, Users } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export function ProjectManagerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["project-manager-dashboard-stats"],
    queryFn: async () => {
      const [projects, projectExpenses, timeEntries] = await Promise.all([
        supabase.from("projects").select("*"),
        supabase.from("project_expenses").select("amount, project_id"),
        supabase.from("time_entries").select("hours_worked, total_amount, status"),
      ]);

      const activeProjects = projects.data?.filter(p => p.status === 'active') || [];
      const completedProjects = projects.data?.filter(p => p.status === 'completed') || [];
      
      const totalBudget = activeProjects.reduce((s, p) => s + (p.budget || 0), 0);
      const totalSpent = activeProjects.reduce((s, p) => s + (p.spent || 0), 0);
      
      const projectsNearBudget = activeProjects.filter(p => {
        const budget = p.budget || 0;
        const spent = p.spent || 0;
        return budget > 0 && (spent / budget) >= 0.8;
      });

      const pendingTimeEntries = timeEntries.data?.filter(t => t.status === 'pending') || [];
      const totalHours = timeEntries.data?.reduce((s, t) => s + (t.hours_worked || 0), 0) || 0;

      return {
        totalProjects: projects.data?.length || 0,
        activeProjects: activeProjects.length,
        completedProjects: completedProjects.length,
        totalBudget,
        totalSpent,
        budgetUtilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
        projectsNearBudget,
        pendingTimeEntries: pendingTimeEntries.length,
        totalHoursLogged: totalHours,
        topProjects: activeProjects.slice(0, 5),
      };
    },
  });

  const metrics = [
    { title: "Active Projects", value: stats?.activeProjects || 0, icon: BriefcaseIcon, color: "text-primary" },
    { title: "Total Budget", value: formatZMW(stats?.totalBudget || 0), icon: DollarSign, color: "text-green-500" },
    { title: "Total Spent", value: formatZMW(stats?.totalSpent || 0), icon: TrendingUp, color: "text-orange-500" },
    { title: "Hours Logged", value: stats?.totalHoursLogged?.toFixed(1) || "0", icon: Clock, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Manager Dashboard</h1>
        <p className="text-muted-foreground">Project portfolio and resource overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Budget Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Utilization</span>
                <span className="font-medium">{(stats?.budgetUtilization || 0).toFixed(1)}%</span>
              </div>
              <Progress value={stats?.budgetUtilization || 0} className="h-2" />
            </div>
            <div className="pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Budget</span>
                <span className="font-medium">{formatZMW(stats?.totalBudget || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spent to Date</span>
                <span className="font-medium text-orange-500">{formatZMW(stats?.totalSpent || 0)}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold text-green-600">
                  {formatZMW((stats?.totalBudget || 0) - (stats?.totalSpent || 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              Projects Near Budget Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.projectsNearBudget && stats.projectsNearBudget.length > 0 ? (
              <div className="space-y-4">
                {stats.projectsNearBudget.map((project: any) => {
                  const utilization = project.budget > 0 ? (project.spent / project.budget) * 100 : 0;
                  return (
                    <div key={project.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate max-w-[200px]">{project.name}</span>
                        <span className={utilization >= 100 ? "text-destructive" : "text-warning"}>
                          {utilization.toFixed(0)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(utilization, 100)} 
                        className={`h-2 ${utilization >= 100 ? '[&>div]:bg-destructive' : '[&>div]:bg-warning'}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatZMW(project.spent || 0)} spent</span>
                        <span>{formatZMW(project.budget || 0)} budget</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4">No projects approaching budget limit</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BriefcaseIcon className="h-5 w-5 text-primary" />
            Active Projects Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.topProjects && stats.topProjects.length > 0 ? (
            <div className="space-y-4">
              {stats.topProjects.map((project: any) => {
                const utilization = project.budget > 0 ? (project.spent / project.budget) * 100 : 0;
                return (
                  <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="space-y-1">
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.donor_name || 'No donor'} • {project.grant_reference || 'No reference'}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-medium">{formatZMW(project.spent || 0)}</p>
                      <p className="text-xs text-muted-foreground">of {formatZMW(project.budget || 0)}</p>
                    </div>
                    <div className="w-20">
                      <Progress value={Math.min(utilization, 100)} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4">No active projects</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
