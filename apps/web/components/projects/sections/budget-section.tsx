"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  DollarSign,
  Loader2,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Lock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createBudget,
  deleteBudget,
  getBudgetCategories,
  getBudgetLineItems,
  getBudgetsForProject,
  updateBudgetStatus,
  type Budget,
  type BudgetCategory,
  type BudgetLineItem,
  type BudgetStatus,
} from "@/lib/actions/budgets";
import {
  getBudgetRequestPermissions,
  setProjectFinancialHead,
  type BudgetRequestPermissions,
} from "@/lib/actions/budget-requests";
import { getBudgetTemplates } from "@/lib/actions/budget-templates";
import { getProjectMembers } from "@/lib/actions/project-members";
import { type BudgetTemplate } from "@/lib/types";

interface BudgetSectionProps {
  projectId: string;
}

export interface ProjectMemberOption {
  userId: string;
  name: string;
  email: string;
}

const BudgetBuilder = dynamic(
  () => import("@/components/budget/budget-builder").then((mod) => mod.BudgetBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl border border-border py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export function BudgetSection({ projectId }: BudgetSectionProps) {
  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = React.useState<string | null>(null);

  const [categories, setCategories] = React.useState<BudgetCategory[]>([]);
  const [lineItems, setLineItems] = React.useState<BudgetLineItem[]>([]);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [newBudgetName, setNewBudgetName] = React.useState("");
  const [templateId, setTemplateId] = React.useState("__scratch");
  const [templates, setTemplates] = React.useState<BudgetTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = React.useState(false);

  const [deletingBudgetId, setDeletingBudgetId] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState<BudgetStatus | null>(null);
  const [budgetPermissions, setBudgetPermissions] =
    React.useState<BudgetRequestPermissions | null>(null);
  const [projectMembers, setProjectMembers] = React.useState<ProjectMemberOption[]>([]);
  const [financialHeadUserId, setFinancialHeadUserId] = React.useState<string>("");
  const [savingFinancialHead, setSavingFinancialHead] = React.useState(false);

  const selectedBudget = React.useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) || null,
    [budgets, selectedBudgetId]
  );

  const nextVersion = React.useMemo(() => {
    if (budgets.length === 0) return 1;
    return Math.max(...budgets.map((budget) => budget.version)) + 1;
  }, [budgets]);

  // Check if all departments with assigned heads are approved
  const allDepartmentsApproved = React.useMemo(() => {
    const topLevelCategories = categories.filter((c) => !c.parentCategoryId);
    if (topLevelCategories.length === 0) return false;
    const assignedDepartments = topLevelCategories.filter((c) => c.assignedUserId);
    // If no departments are assigned, finance manager controls everything directly
    if (assignedDepartments.length === 0) return true;
    return assignedDepartments.every((c) => c.departmentStatus === "APPROVED");
  }, [categories]);

  const loadBudgets = React.useCallback(
    async ({
      preferredBudgetId,
      showSpinner = true,
    }: {
      preferredBudgetId?: string;
      showSpinner?: boolean;
    } = {}) => {
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await getBudgetsForProject(projectId);
        setBudgets(data);
        setSelectedBudgetId((current) => {
          if (preferredBudgetId && data.some((budget) => budget.id === preferredBudgetId)) {
            return preferredBudgetId;
          }
          if (current && data.some((budget) => budget.id === current)) {
            return current;
          }
          return data[0]?.id || null;
        });
      } catch (loadError) {
        console.error("Error loading budgets:", loadError);
        setError("Failed to load budgets");
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [projectId]
  );

  const loadFinanceContext = React.useCallback(async () => {
    try {
      const [permissions, members] = await Promise.all([
        getBudgetRequestPermissions(projectId),
        getProjectMembers(projectId),
      ]);
      setBudgetPermissions(permissions);
      setFinancialHeadUserId(permissions.financialHeadUserId ?? "");
      setProjectMembers(
        members.map((member) => ({
          userId: member.userId,
          name: member.name,
          email: member.email,
        }))
      );
    } catch (contextError) {
      console.error("Error loading budget request context:", contextError);
      setBudgetPermissions(null);
      setProjectMembers([]);
      setFinancialHeadUserId("");
    }
  }, [projectId]);

  React.useEffect(() => {
    setSelectedBudgetId(null);
    setCategories([]);
    setLineItems([]);
    void loadBudgets();
    void loadFinanceContext();
  }, [loadBudgets, loadFinanceContext]);

  const loadBudgetDetails = React.useCallback(async (budgetId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const [categoriesData, lineItemsData] = await Promise.all([
        getBudgetCategories(budgetId),
        getBudgetLineItems(budgetId),
      ]);
      setCategories(categoriesData);
      setLineItems(lineItemsData);
    } catch (loadError) {
      console.error("Error loading budget details:", loadError);
      setDetailsError("Failed to load budget details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedBudgetId) {
      setCategories([]);
      setLineItems([]);
      return;
    }

    void loadBudgetDetails(selectedBudgetId);
  }, [loadBudgetDetails, selectedBudgetId]);

  React.useEffect(() => {
    if (!showCreateDialog || templates.length > 0 || templatesLoading) return;

    async function loadTemplates() {
      setTemplatesLoading(true);
      try {
        const data = await getBudgetTemplates();
        setTemplates(data);
      } catch (loadError) {
        console.error("Error loading budget templates:", loadError);
      } finally {
        setTemplatesLoading(false);
      }
    }

    void loadTemplates();
  }, [showCreateDialog, templates.length, templatesLoading]);

  const handleOpenCreateDialog = () => {
    setNewBudgetName(`Budget v${nextVersion}`);
    setTemplateId("__scratch");
    setShowCreateDialog(true);
  };

  const handleCreateBudget = async () => {
    const trimmedName = newBudgetName.trim();
    if (!trimmedName) {
      toast.error("Budget name is required");
      return;
    }

    setCreateLoading(true);
    try {
      const created = await createBudget({
        projectId,
        versionName: trimmedName,
        templateId: templateId === "__scratch" ? undefined : templateId,
      });
      toast.success("Budget created");
      setShowCreateDialog(false);
      await loadBudgets({ preferredBudgetId: created.id, showSpinner: false });
    } catch (createError) {
      console.error("Error creating budget:", createError);
      toast.error(
        createError instanceof Error ? createError.message : "Failed to create budget"
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    if (
      !confirm(`Delete "${budget.versionName}"? This will remove all categories and line items.`)
    ) {
      return;
    }

    setDeletingBudgetId(budget.id);
    try {
      await deleteBudget(budget.id);
      toast.success("Budget deleted");
      await loadBudgets({
        preferredBudgetId:
          selectedBudgetId === budget.id ? undefined : selectedBudgetId || undefined,
        showSpinner: false,
      });
    } catch (deleteError) {
      console.error("Error deleting budget:", deleteError);
      toast.error("Failed to delete budget");
    } finally {
      setDeletingBudgetId(null);
    }
  };

  const handleStatusChange = async (status: BudgetStatus) => {
    if (!selectedBudget) return;

    setUpdatingStatus(status);
    try {
      await updateBudgetStatus(selectedBudget.id, status);
      toast.success(`Budget status updated to ${status.replace(/_/g, " ")}`);
      await loadBudgets({
        preferredBudgetId: selectedBudget.id,
        showSpinner: false,
      });
    } catch (statusError) {
      console.error("Error updating budget status:", statusError);
      toast.error("Failed to update budget status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleBuilderRefresh = React.useCallback(async () => {
    if (!selectedBudgetId) return;
    await Promise.all([
      loadBudgetDetails(selectedBudgetId),
      loadFinanceContext(),
      loadBudgets({ preferredBudgetId: selectedBudgetId, showSpinner: false }),
    ]);
  }, [loadBudgetDetails, loadFinanceContext, loadBudgets, selectedBudgetId]);

  const handleSaveFinancialHead = async () => {
    if (!budgetPermissions?.canAssignFinancialHead) return;

    setSavingFinancialHead(true);
    try {
      await setProjectFinancialHead(projectId, financialHeadUserId || null);
      toast.success("Financial head updated");
      await loadFinanceContext();
    } catch (updateError) {
      console.error("Error updating financial head:", updateError);
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update financial head"
      );
    } finally {
      setSavingFinancialHead(false);
    }
  };

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

  // Finance managers can edit when budget is not locked
  const canEditSelectedBudget =
    selectedBudget?.status !== "LOCKED" &&
    Boolean(budgetPermissions?.canManageRequests);

  // Department heads can also edit their assigned departments (handled in BudgetBuilder)
  const hasDeptEditRights =
    (budgetPermissions?.assignedDepartmentCategoryIds?.length ?? 0) > 0;

  const templateOptions = [
    { value: "__scratch", label: "Start from scratch" },
    ...templates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
  ];

  const selectedTemplate = templates.find((template) => template.id === templateId) || null;
  const financialHeadOptions = [
    { value: "", label: "Unassigned" },
    ...projectMembers.map((member) => ({
      value: member.userId,
      label: `${member.name || member.email} (${member.email})`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Budget</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage project budgets and track expenses
          </p>
        </div>
        {budgetPermissions?.canManageRequests && (
          <Button variant="skeuo" onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Budget
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <p className="text-sm font-medium">Line Producer / UPM</p>
            <p className="text-xs text-muted-foreground">
              Reviews and approves department budgets. Can manage overall budget.
            </p>
          </div>
          {budgetPermissions?.canAssignFinancialHead ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="w-full sm:w-96">
                <Select
                  value={financialHeadUserId}
                  onChange={(event) => setFinancialHeadUserId(event.target.value)}
                  options={financialHeadOptions}
                  disabled={savingFinancialHead}
                />
              </div>
              <Button
                variant="outline"
                disabled={savingFinancialHead}
                onClick={() => void handleSaveFinancialHead()}
              >
                {savingFinancialHead ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          ) : (
            <Badge variant="outline">
              {budgetPermissions?.financialHeadUserId
                ? projectMembers.find((member) => member.userId === budgetPermissions.financialHeadUserId)?.name ||
                  "Assigned"
                : "Unassigned"}
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {budgets.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
          <div className="space-y-3">
            {budgets.map((budget) => {
              const percentSpent =
                budget.totalEstimated > 0
                  ? (budget.totalActual / budget.totalEstimated) * 100
                  : 0;
              const remaining = budget.totalEstimated - budget.totalActual;
              const isSelected = budget.id === selectedBudgetId;

              return (
                <button
                  key={budget.id}
                  type="button"
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    "hover:border-foreground/20 hover:bg-muted/30",
                    isSelected && "border-primary/50 bg-primary/5"
                  )}
                  onClick={() => setSelectedBudgetId(budget.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{budget.versionName}</p>
                        <p className="text-xs text-muted-foreground">
                          Version {budget.version}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("text-xs", getStatusBadge(budget.status))}>
                      {budget.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-medium">{formatCurrency(budget.totalEstimated)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Spent</p>
                      <p className={cn("font-medium", getHealthColor(percentSpent))}>
                        {formatCurrency(budget.totalActual)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className={cn("font-medium", remaining < 0 && "text-red-600")}>
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(budget.createdAt).toLocaleDateString()}
                    </p>
                    {budget.status === "DRAFT" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingBudgetId === budget.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteBudget(budget);
                        }}
                      >
                        {deletingBudgetId === budget.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {selectedBudget ? (
              <>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedBudget.versionName}</h3>
                      <p className="text-xs text-muted-foreground">
                        Version {selectedBudget.version} • Last updated{" "}
                        {new Date(selectedBudget.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={cn("text-xs", getStatusBadge(selectedBudget.status))}>
                      {selectedBudget.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {budgetPermissions?.canManageRequests &&
                      selectedBudget.status === "DRAFT" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingStatus !== null || !allDepartmentsApproved}
                        title={
                          !allDepartmentsApproved
                            ? "All assigned departments must be approved first"
                            : undefined
                        }
                        onClick={() => void handleStatusChange("PENDING_APPROVAL")}
                      >
                        {updatingStatus === "PENDING_APPROVAL" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Submit for Approval
                      </Button>
                    )}
                    {budgetPermissions?.canManageRequests &&
                      selectedBudget.status === "PENDING_APPROVAL" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingStatus !== null}
                          onClick={() => void handleStatusChange("APPROVED")}
                        >
                          {updatingStatus === "APPROVED" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatingStatus !== null}
                          onClick={() => void handleStatusChange("DRAFT")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Revert to Draft
                        </Button>
                      </>
                    )}
                    {budgetPermissions?.canManageRequests &&
                      selectedBudget.status === "APPROVED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingStatus !== null}
                        onClick={() => void handleStatusChange("LOCKED")}
                      >
                        {updatingStatus === "LOCKED" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        Lock Budget
                      </Button>
                    )}
                  </div>
                </div>

                {detailsLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-border py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : detailsError ? (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {detailsError}
                  </div>
                ) : (
                  <BudgetBuilder
                    budgetId={selectedBudget.id}
                    categories={categories}
                    lineItems={lineItems}
                    onRefresh={handleBuilderRefresh}
                    canEdit={canEditSelectedBudget || hasDeptEditRights}
                    budgetPermissions={budgetPermissions}
                    projectMembers={projectMembers}
                    budgetStatus={selectedBudget.status}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16 text-sm text-muted-foreground">
                Select a budget to start editing
              </div>
            )}
          </div>
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
          {budgetPermissions?.canManageRequests && (
            <Button variant="skeuo" onClick={handleOpenCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Budget
            </Button>
          )}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent onClose={() => setShowCreateDialog(false)}>
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
            <DialogDescription>
              Start from scratch or use a template to pre-fill categories and line items.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Budget name</label>
              <Input
                value={newBudgetName}
                onChange={(event) => setNewBudgetName(event.target.value)}
                placeholder={`Budget v${nextVersion}`}
                disabled={createLoading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Template</label>
              <Select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                options={templateOptions}
                disabled={templatesLoading || createLoading}
              />
              {templatesLoading && (
                <p className="mt-1 text-xs text-muted-foreground">Loading templates...</p>
              )}
              {selectedTemplate?.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              variant="skeuo-outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button variant="skeuo" onClick={() => void handleCreateBudget()} disabled={createLoading}>
              {createLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Budget
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
