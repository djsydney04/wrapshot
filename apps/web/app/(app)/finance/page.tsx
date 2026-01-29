"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, DollarSign, Film, ChevronRight, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuth } from "@/components/providers/auth-provider";
import { projectRoleHasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getBudgetsByProject, type Budget, type BudgetStatus } from "@/lib/actions/budgets";

export default function FinancePage() {
  const router = useRouter();
  const { projects } = useProjectStore();
  const { projectRoles, loading: authLoading } = useAuth();

  // State for budgets
  const [budgetsByProject, setBudgetsByProject] = React.useState<Record<string, Budget[]>>({});
  const [budgetsLoading, setBudgetsLoading] = React.useState(true);

  // Filter projects to only show those where user has budget:read permission
  const projectsWithBudgetAccess = React.useMemo(() => {
    return projects.filter((project) => {
      const role = projectRoles[project.id];
      return projectRoleHasPermission(role, "budget:read");
    });
  }, [projects, projectRoles]);

  // Fetch budgets
  React.useEffect(() => {
    async function loadBudgets() {
      try {
        const budgets = await getBudgetsByProject();
        setBudgetsByProject(budgets);
      } catch (error) {
        console.error("Error loading budgets:", error);
      } finally {
        setBudgetsLoading(false);
      }
    }

    if (!authLoading) {
      loadBudgets();
    }
  }, [authLoading]);

  const getStatusBadge = (status: BudgetStatus) => {
    const variants: Record<BudgetStatus, string> = {
      DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
      PENDING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      LOCKED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return variants[status];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getHealthColor = (percentSpent: number) => {
    if (percentSpent >= 100) return "text-red-600 dark:text-red-400";
    if (percentSpent >= 80) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DEVELOPMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      PRE_PRODUCTION: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      PRODUCTION: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      POST_PRODUCTION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      COMPLETED: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400",
      ON_HOLD: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[status] || colors.DEVELOPMENT;
  };

  // Loading state
  if (authLoading || budgetsLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <Header breadcrumbs={[{ label: "Finance" }]} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="grain-page" />

      <Header
        breadcrumbs={[{ label: "Finance" }]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage budgets for your projects
          </p>
        </div>

        {projectsWithBudgetAccess.length > 0 ? (
          <div className="space-y-4">
            {projectsWithBudgetAccess.map((project) => {
              const projectBudgets = budgetsByProject[project.id] || [];
              const hasBudgets = projectBudgets.length > 0;

              return (
                <div
                  key={project.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Project Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Film className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={cn("text-xs", getStatusColor(project.status))}>
                            {project.status.replace(/_/g, " ")}
                          </Badge>
                          {project.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {project.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/finance/new?projectId=${project.id}`)}
                    >
                      <Plus className="h-4 w-4" />
                      Create Budget
                    </Button>
                  </div>

                  {/* Project Budgets */}
                  <div className="p-4">
                    {hasBudgets ? (
                      <div className="space-y-3">
                        {projectBudgets.map((budget) => {
                          const percentSpent = budget.totalEstimated > 0
                            ? (budget.totalActual / budget.totalEstimated) * 100
                            : 0;
                          const remaining = budget.totalEstimated - budget.totalActual;

                          return (
                            <div
                              key={budget.id}
                              className="group flex items-center justify-between p-4 rounded-lg border border-border hover:border-foreground/20 hover:bg-muted/50 cursor-pointer transition-all"
                              onClick={() => router.push(`/finance/${budget.id}`)}
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{budget.versionName}</h4>
                                    <Badge className={cn("text-xs", getStatusBadge(budget.status))}>
                                      {budget.status.replace(/_/g, " ")}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Version {budget.version}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">Budget</p>
                                  <p className="font-semibold">{formatCurrency(budget.totalEstimated)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">Spent</p>
                                  <p className={cn("font-semibold", getHealthColor(percentSpent))}>
                                    {formatCurrency(budget.totalActual)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">Remaining</p>
                                  <p className="font-semibold">{formatCurrency(remaining)}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-center">
                        <div>
                          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                            <DollarSign className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            No budgets yet for this project
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Create a budget to start tracking expenses
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : projects.length > 0 ? (
          /* User has projects but no budget access */
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Budget Access</h2>
              <p className="text-muted-foreground">
                You don&apos;t have permission to view budgets for your projects. Contact a project admin to get access.
              </p>
            </div>
          </div>
        ) : (
          /* No projects at all */
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Film className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Create a Project First</h2>
              <p className="text-muted-foreground mb-6">
                You need to create a project before you can set up a budget for it.
              </p>
              <Button size="lg" onClick={() => router.push("/projects/new")}>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
