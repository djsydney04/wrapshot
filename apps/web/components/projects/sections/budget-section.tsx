"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, DollarSign, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBudgetsForProject, type Budget, type BudgetStatus } from "@/lib/actions/budgets";

interface BudgetSectionProps {
  projectId: string;
}

export function BudgetSection({ projectId }: BudgetSectionProps) {
  const router = useRouter();
  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadBudgets() {
      try {
        const data = await getBudgetsForProject(projectId);
        setBudgets(data);
      } catch (error) {
        console.error("Error loading budgets:", error);
      } finally {
        setLoading(false);
      }
    }
    loadBudgets();
  }, [projectId]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Budget</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage project budgets and track expenses
          </p>
        </div>
        <Button onClick={() => router.push(`/finance/new?projectId=${projectId}`)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Budget
        </Button>
      </div>

      {/* Budget List */}
      {budgets.length > 0 ? (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const percentSpent = budget.totalEstimated > 0
              ? (budget.totalActual / budget.totalEstimated) * 100
              : 0;
            const remaining = budget.totalEstimated - budget.totalActual;

            return (
              <div
                key={budget.id}
                className="group flex items-center justify-between p-4 rounded-xl border border-border hover:border-foreground/20 hover:bg-muted/50 cursor-pointer transition-all"
                onClick={() => router.push(`/finance/${budget.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <DollarSign className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{budget.versionName}</h3>
                      <Badge className={cn("text-xs", getStatusBadge(budget.status))}>
                        {budget.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Version {budget.version} • Created {new Date(budget.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="font-semibold">{formatCurrency(budget.totalEstimated)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className={cn("font-semibold", getHealthColor(percentSpent))}>
                      {formatCurrency(budget.totalActual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className={cn("font-semibold", remaining < 0 ? "text-red-600" : "")}>
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No budgets yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Create a budget to start tracking expenses for this project.
          </p>
          <Button onClick={() => router.push(`/finance/new?projectId=${projectId}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Budget
          </Button>
        </div>
      )}
    </div>
  );
}
