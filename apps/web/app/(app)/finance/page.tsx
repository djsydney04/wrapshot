"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";
import type { Budget, BudgetStatus } from "@/lib/mock-data";

export default function FinancePage() {
  const router = useRouter();
  const { projects } = useProjectStore();

  // Mock budgets for now - will be replaced with real data
  const budgets: Budget[] = [];

  // Default to first project for now
  const defaultProjectId = projects[0]?.id || "proj-1";

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

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="grain-page" />

      <Header
        breadcrumbs={[{ label: "Finance" }]}
        actions={
          <Button size="sm" onClick={() => router.push("/finance/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Budget
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {budgets.length > 0 ? (
          <div className="space-y-6">
            {/* Budget Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {budgets.map((budget) => {
                const percentSpent = budget.totalEstimated > 0
                  ? (budget.totalActual / budget.totalEstimated) * 100
                  : 0;
                const remaining = budget.totalEstimated - budget.totalActual;

                return (
                  <div
                    key={budget.id}
                    className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-all hover:border-foreground/20 hover:shadow-md"
                    onClick={() => router.push(`/finance/${budget.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{budget.versionName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Version {budget.version}
                        </p>
                      </div>
                      <Badge className={cn("text-xs", getStatusBadge(budget.status))}>
                        {budget.status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Total Budget</span>
                          <span className="text-lg font-semibold">
                            {formatCurrency(budget.totalEstimated)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Spent</span>
                          <span className={cn("font-medium", getHealthColor(percentSpent))}>
                            {formatCurrency(budget.totalActual)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-muted-foreground">Remaining</span>
                          <span className="font-medium">
                            {formatCurrency(remaining)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className={cn("font-medium", getHealthColor(percentSpent))}>
                            {percentSpent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              percentSpent >= 100
                                ? "bg-red-500"
                                : percentSpent >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(percentSpent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/finance/${budget.id}/dashboard`);
                        }}
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                        Dashboard
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/finance/${budget.id}/detail`);
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex items-center justify-center min-h-[600px]">
            <div className="text-center max-w-md">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <DollarSign className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                No budgets yet
              </h2>
              <p className="text-muted-foreground mb-6">
                Create your first budget to start tracking expenses and managing your production finances in real-time.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={() => router.push("/finance/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Budget
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push("/finance/templates")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Browse Templates
                </Button>
              </div>

              {/* Feature Highlights */}
              <div className="mt-12 grid gap-4 text-left">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-0.5">Real-time Tracking</h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor spending and budget health as expenses happen
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-0.5">Schedule Integration</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically calculate crew costs from your shooting schedule
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-0.5">Smart Alerts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when departments are trending over budget
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
