"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, Loader2, FileText, MoreHorizontal, Plus, Receipt, LayoutGrid, FileSpreadsheet } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getBudget,
  getBudgetCategories,
  getBudgetLineItems,
  type Budget,
  type BudgetStatus,
  type BudgetCategory,
  type BudgetLineItem,
} from "@/lib/actions/budgets";
import { getTransactions, type Transaction } from "@/lib/actions/transactions";
import { TransactionList } from "@/components/finance/transaction-list";
import { AddTransactionForm } from "@/components/forms/add-transaction-form";
import { BudgetBuilder } from "@/components/budget/budget-builder";

type TabType = "overview" | "builder";

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const budgetId = params.budgetId as string;

  const [budget, setBudget] = React.useState<Budget | null>(null);
  const [categories, setCategories] = React.useState<BudgetCategory[]>([]);
  const [lineItems, setLineItems] = React.useState<BudgetLineItem[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = React.useState<TabType>("overview");

  // Transaction form state
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editTransaction, setEditTransaction] = React.useState<Transaction | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const [budgetData, categoriesData, lineItemsData, transactionsData] = await Promise.all([
        getBudget(budgetId),
        getBudgetCategories(budgetId),
        getBudgetLineItems(budgetId),
        getTransactions(budgetId),
      ]);

      if (!budgetData) {
        setError("Budget not found");
      } else {
        setBudget(budgetData);
        setCategories(categoriesData);
        setLineItems(lineItemsData);
        setTransactions(transactionsData);
      }
    } catch (err) {
      console.error("Error loading budget:", err);
      setError("Failed to load budget");
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = React.useCallback(() => {
    loadData();
  }, [loadData]);

  const handleEdit = React.useCallback((transaction: Transaction) => {
    setEditTransaction(transaction);
    setShowAddForm(true);
  }, []);

  const handleFormClose = React.useCallback((open: boolean) => {
    setShowAddForm(open);
    if (!open) {
      setEditTransaction(null);
    }
  }, []);

  const handleFormSuccess = React.useCallback(() => {
    handleRefresh();
    setEditTransaction(null);
  }, [handleRefresh]);

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

  // Calculate receipt stats
  const receiptStats = React.useMemo(() => {
    const pending = transactions.filter((t) => t.receiptStatus === "PENDING").length;
    const missing = transactions.filter((t) => t.receiptStatus === "MISSING").length;
    return { pending, missing };
  }, [transactions]);

  // Check if budget is editable
  const canEdit = budget?.status === "DRAFT" || budget?.status === "PENDING_APPROVAL";

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
        <div className="mb-6">
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

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "overview" ? "default" : "outline"}
            onClick={() => setActiveTab("overview")}
            size="sm"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === "builder" ? "default" : "outline"}
            onClick={() => setActiveTab("builder")}
            size="sm"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Build Budget
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" ? (
          <>
            {/* Budget Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Receipts</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold">{transactions.length}</p>
                  <span className="text-sm text-muted-foreground">expenses</span>
                </div>
                {(receiptStats.pending > 0 || receiptStats.missing > 0) && (
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    {receiptStats.pending > 0 && (
                      <span className="text-amber-600">{receiptStats.pending} pending</span>
                    )}
                    {receiptStats.pending > 0 && receiptStats.missing > 0 && (
                      <span className="text-muted-foreground">•</span>
                    )}
                    {receiptStats.missing > 0 && (
                      <span className="text-red-600">{receiptStats.missing} missing</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Expenses</h2>
                <Button onClick={() => setShowAddForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              </div>

              <TransactionList
                transactions={transactions}
                budgetId={budgetId}
                onEdit={handleEdit}
                onRefresh={handleRefresh}
                isAdmin={true}
              />
            </div>

            {/* Add/Edit Transaction Form */}
            <AddTransactionForm
              budgetId={budgetId}
              categories={categories}
              lineItems={lineItems}
              open={showAddForm}
              onOpenChange={handleFormClose}
              onSuccess={handleFormSuccess}
              editTransaction={editTransaction}
            />
          </>
        ) : (
          <BudgetBuilder
            budgetId={budgetId}
            categories={categories}
            lineItems={lineItems}
            onRefresh={handleRefresh}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
