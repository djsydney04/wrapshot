"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign, Loader2, FileText, MoreHorizontal } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBudget, type Budget, type BudgetStatus } from "@/lib/actions/budgets";

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const budgetId = params.budgetId as string;

  const [budget, setBudget] = React.useState<Budget | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadBudget() {
      try {
        const data = await getBudget(budgetId);
        if (!data) {
          setError("Budget not found");
        } else {
          setBudget(data);
        }
      } catch (err) {
        console.error("Error loading budget:", err);
        setError("Failed to load budget");
      } finally {
        setLoading(false);
      }
    }

    loadBudget();
  }, [budgetId]);

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

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <Header breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Loading..." }]} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div className="flex h-full flex-col bg-background">
        <Header breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Error" }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Budget Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || "This budget doesn't exist or you don't have access."}</p>
            <Button onClick={() => router.push("/finance")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Finance
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const percentSpent = budget.totalEstimated > 0
    ? (budget.totalActual / budget.totalEstimated) * 100
    : 0;
  const remaining = budget.totalEstimated - budget.totalActual;

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: budget.versionName },
        ]}
        actions={
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Budget Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold">{budget.versionName}</h1>
                <Badge className={cn("text-xs", getStatusBadge(budget.status))}>
                  {budget.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Version {budget.version} • Created {new Date(budget.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Budget Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Total Budget</span>
            </div>
            <p className="text-3xl font-semibold">{formatCurrency(budget.totalEstimated)}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Spent</span>
            </div>
            <p className={cn(
              "text-3xl font-semibold",
              percentSpent >= 100 ? "text-red-600" : percentSpent >= 80 ? "text-amber-600" : "text-emerald-600"
            )}>
              {formatCurrency(budget.totalActual)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {percentSpent.toFixed(1)}% of budget
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Remaining</span>
            </div>
            <p className={cn(
              "text-3xl font-semibold",
              remaining < 0 ? "text-red-600" : ""
            )}>
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>

        {/* Placeholder for budget categories/line items */}
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Budget Details Coming Soon</h3>
            <p className="text-sm">
              Line items, categories, and transaction tracking will appear here.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
