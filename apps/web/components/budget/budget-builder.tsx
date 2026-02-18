"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Plus,
  Lock,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Send,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BudgetCategory, BudgetLineItem } from "@/lib/actions/budgets";
import type { BudgetRequestPermissions } from "@/lib/actions/budget-requests";
import {
  reorderBudgetCategories,
  assignDepartmentHead,
  submitDepartmentBudget,
  reviewDepartmentBudget,
  reopenDepartmentBudget,
} from "@/lib/actions/budget-categories";
import { reorderLineItems, moveLineItemToCategory } from "@/lib/actions/budget-line-items";
import { toast } from "sonner";
import { DEPARTMENT_BUDGET_STATUS_LABELS, type DepartmentBudgetStatus } from "@/lib/types";
import {
  SortableBudgetCategoryCard,
  CategoryOverlay,
} from "./budget-category-card";
import { LineItemOverlay } from "./budget-line-item-row";
import { AddCategoryForm } from "./add-category-form";
import { AddLineItemForm } from "./add-line-item-form";

interface BudgetBuilderProps {
  budgetId: string;
  categories: BudgetCategory[];
  lineItems: BudgetLineItem[];
  onRefresh: () => void;
  canEdit: boolean;
  budgetPermissions: BudgetRequestPermissions | null;
  projectMembers: { userId: string; name: string; email: string }[];
  budgetStatus: string;
}

type DragItem =
  | { type: "category"; category: BudgetCategory }
  | { type: "lineitem"; lineItem: BudgetLineItem };

const STATUS_DOT_COLOR: Record<DepartmentBudgetStatus, string> = {
  NOT_STARTED: "bg-neutral-300 dark:bg-neutral-600",
  IN_PROGRESS: "bg-blue-500",
  SUBMITTED: "bg-amber-500",
  REVISION_REQUESTED: "bg-orange-500",
  APPROVED: "bg-emerald-500",
};

export function BudgetBuilder({
  budgetId,
  categories,
  lineItems,
  onRefresh,
  canEdit,
  budgetPermissions,
  projectMembers,
  budgetStatus,
}: BudgetBuilderProps) {
  const isFinanceManager = Boolean(budgetPermissions?.canManageRequests);
  const assignedDeptIds = React.useMemo(
    () => new Set(budgetPermissions?.assignedDepartmentCategoryIds ?? []),
    [budgetPermissions?.assignedDepartmentCategoryIds]
  );

  // Expanded state
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    () => new Set(categories.map((c) => c.id))
  );
  const [expandedDepartments, setExpandedDepartments] = React.useState<Set<string>>(
    () => new Set(categories.filter((c) => !c.parentCategoryId).map((c) => c.id))
  );

  // Drag state
  const [activeItem, setActiveItem] = React.useState<DragItem | null>(null);
  const [isApplyingChange, setIsApplyingChange] = React.useState(false);

  // Form states
  const [showCategoryForm, setShowCategoryForm] = React.useState(false);
  const [editCategory, setEditCategory] = React.useState<BudgetCategory | null>(null);
  const [defaultParentCategoryId, setDefaultParentCategoryId] = React.useState<string | null>(null);
  const [showLineItemForm, setShowLineItemForm] = React.useState(false);
  const [activeLineItemCategoryId, setActiveLineItemCategoryId] = React.useState<string | null>(null);
  const [editLineItem, setEditLineItem] = React.useState<BudgetLineItem | null>(null);

  // Dialog states
  const [assignDialogDept, setAssignDialogDept] = React.useState<BudgetCategory | null>(null);
  const [assignUserId, setAssignUserId] = React.useState("");
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [revisionDialogDept, setRevisionDialogDept] = React.useState<BudgetCategory | null>(null);
  const [revisionNotes, setRevisionNotes] = React.useState("");
  const [workflowLoading, setWorkflowLoading] = React.useState<string | null>(null);

  // Sorted/grouped categories
  const sortedCategories = React.useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const categoriesById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const parentCategories = React.useMemo(
    () => sortedCategories.filter((c) => !c.parentCategoryId),
    [sortedCategories]
  );

  const childCategoriesByParent = React.useMemo(() => {
    const grouped = new Map<string, BudgetCategory[]>();
    for (const category of sortedCategories) {
      if (!category.parentCategoryId) continue;
      const list = grouped.get(category.parentCategoryId) || [];
      list.push(category);
      grouped.set(category.parentCategoryId, list);
    }
    return grouped;
  }, [sortedCategories]);

  const orphanCategories = React.useMemo(
    () =>
      sortedCategories.filter(
        (c) => c.parentCategoryId && !categoriesById.has(c.parentCategoryId)
      ),
    [sortedCategories, categoriesById]
  );

  React.useEffect(() => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      parentCategories.forEach((c) => next.add(c.id));
      return next;
    });
  }, [parentCategories]);

  React.useEffect(() => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      categories.forEach((c) => next.add(c.id));
      return next;
    });
  }, [categories]);

  const lineItemsByCategory = React.useMemo(() => {
    const grouped: Record<string, BudgetLineItem[]> = {};
    for (const category of categories) {
      grouped[category.id] = lineItems.filter((li) => li.categoryId === category.id);
    }
    return grouped;
  }, [categories, lineItems]);

  // Per-department editability
  const canEditDepartment = React.useCallback(
    (department: BudgetCategory): boolean => {
      if (budgetStatus === "LOCKED") return false;
      if (isFinanceManager) return department.departmentStatus !== "APPROVED";
      if (assignedDeptIds.has(department.id)) {
        return ["NOT_STARTED", "IN_PROGRESS", "REVISION_REQUESTED"].includes(
          department.departmentStatus
        );
      }
      return false;
    },
    [budgetStatus, isFinanceManager, assignedDeptIds]
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    if (activeId.startsWith("category-")) {
      const category = categories.find((c) => c.id === activeId.replace("category-", ""));
      if (category) setActiveItem({ type: "category", category });
    } else if (activeId.startsWith("lineitem-")) {
      const lineItem = lineItems.find((li) => li.id === activeId.replace("lineitem-", ""));
      if (lineItem) setActiveItem({ type: "lineitem", lineItem });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith("category-") && overId.startsWith("category-")) {
      const activeCategoryId = activeId.replace("category-", "");
      const overCategoryId = overId.replace("category-", "");
      const activeCategory = categoriesById.get(activeCategoryId);
      const overCategory = categoriesById.get(overCategoryId);
      if (!activeCategory || !overCategory) return;
      if (activeCategory.parentCategoryId !== overCategory.parentCategoryId) return;

      const siblings = activeCategory.parentCategoryId
        ? childCategoriesByParent.get(activeCategory.parentCategoryId) || []
        : parentCategories;
      const sorted = [...siblings].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIdx = sorted.findIndex((c) => c.id === activeCategoryId);
      const newIdx = sorted.findIndex((c) => c.id === overCategoryId);

      if (oldIdx !== -1 && newIdx !== -1) {
        const newOrder = arrayMove(sorted, oldIdx, newIdx);
        try {
          setIsApplyingChange(true);
          await reorderBudgetCategories(budgetId, newOrder.map((c) => c.id));
          toast.success("Category order updated");
          onRefresh();
        } catch {
          toast.error("Failed to reorder categories");
        } finally {
          setIsApplyingChange(false);
        }
      }
    }

    if (activeId.startsWith("lineitem-") && overId.startsWith("lineitem-")) {
      const activeLineItemId = activeId.replace("lineitem-", "");
      const overLineItemId = overId.replace("lineitem-", "");
      const activeLineItem = lineItems.find((li) => li.id === activeLineItemId);
      const overLineItem = lineItems.find((li) => li.id === overLineItemId);

      if (activeLineItem && overLineItem) {
        if (activeLineItem.categoryId === overLineItem.categoryId) {
          const items = lineItemsByCategory[activeLineItem.categoryId] || [];
          const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
          const oldIdx = sorted.findIndex((li) => li.id === activeLineItemId);
          const newIdx = sorted.findIndex((li) => li.id === overLineItemId);
          if (oldIdx !== -1 && newIdx !== -1) {
            const newOrder = arrayMove(sorted, oldIdx, newIdx);
            try {
              setIsApplyingChange(true);
              await reorderLineItems(activeLineItem.categoryId, newOrder.map((li) => li.id));
              toast.success("Line item order updated");
              onRefresh();
            } catch {
              toast.error("Failed to reorder line items");
            } finally {
              setIsApplyingChange(false);
            }
          }
        } else {
          const targetItems = lineItemsByCategory[overLineItem.categoryId] || [];
          const sorted = [...targetItems].sort((a, b) => a.sortOrder - b.sortOrder);
          const overIdx = sorted.findIndex((li) => li.id === overLineItemId);
          try {
            setIsApplyingChange(true);
            await moveLineItemToCategory(activeLineItemId, overLineItem.categoryId, overIdx);
            toast.success("Line item moved");
            onRefresh();
          } catch {
            toast.error("Failed to move line item");
          } finally {
            setIsApplyingChange(false);
          }
        }
      }
    }

    if (activeId.startsWith("lineitem-") && overId.startsWith("category-")) {
      const activeLineItemId = activeId.replace("lineitem-", "");
      const targetCategoryId = overId.replace("category-", "");
      const activeLineItem = lineItems.find((li) => li.id === activeLineItemId);
      if (activeLineItem && activeLineItem.categoryId !== targetCategoryId) {
        const targetItems = lineItemsByCategory[targetCategoryId] || [];
        try {
          setIsApplyingChange(true);
          await moveLineItemToCategory(activeLineItemId, targetCategoryId, targetItems.length);
          toast.success("Line item moved");
          onRefresh();
        } catch {
          toast.error("Failed to move line item");
        } finally {
          setIsApplyingChange(false);
        }
      }
    }
  };

  const handleDragCancel = () => setActiveItem(null);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleDepartment = (categoryId: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const handleEditCategory = (category: BudgetCategory) => {
    setEditCategory(category);
    setDefaultParentCategoryId(null);
    setShowCategoryForm(true);
  };

  const handleAddLineItem = (categoryId: string) => {
    setActiveLineItemCategoryId(categoryId);
    setEditLineItem(null);
    setShowLineItemForm(true);
  };

  const handleCategoryFormClose = (open: boolean) => {
    setShowCategoryForm(open);
    if (!open) {
      setEditCategory(null);
      setDefaultParentCategoryId(null);
    }
  };

  const handleLineItemFormClose = (open: boolean) => {
    setShowLineItemForm(open);
    if (!open) {
      setEditLineItem(null);
      setActiveLineItemCategoryId(null);
    }
  };

  // Workflow actions
  const handleAssignHead = async () => {
    if (!assignDialogDept) return;
    setAssignLoading(true);
    try {
      await assignDepartmentHead(assignDialogDept.id, assignUserId || null);
      toast.success(assignUserId ? "Department head assigned" : "Department head unassigned");
      setAssignDialogDept(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSubmitDept = async (dept: BudgetCategory) => {
    setWorkflowLoading(dept.id);
    try {
      await submitDepartmentBudget(dept.id);
      toast.success("Department submitted for review");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setWorkflowLoading(null);
    }
  };

  const handleApproveDept = async (dept: BudgetCategory) => {
    setWorkflowLoading(dept.id);
    try {
      await reviewDepartmentBudget(dept.id, "APPROVE");
      toast.success("Department approved");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setWorkflowLoading(null);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionDialogDept) return;
    setWorkflowLoading(revisionDialogDept.id);
    try {
      await reviewDepartmentBudget(revisionDialogDept.id, "REQUEST_REVISION", revisionNotes);
      toast.success("Revision requested");
      setRevisionDialogDept(null);
      setRevisionNotes("");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request revision");
    } finally {
      setWorkflowLoading(null);
    }
  };

  const handleReopenDept = async (dept: BudgetCategory) => {
    setWorkflowLoading(dept.id);
    try {
      await reopenDepartmentBudget(dept.id);
      toast.success("Department reopened for edits");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reopen");
    } finally {
      setWorkflowLoading(null);
    }
  };

  // Totals
  const { totalEstimated, totalActual } = React.useMemo(() => {
    const estimated = lineItems.reduce((sum, li) => sum + li.estimatedTotal, 0);
    const actual = lineItems.reduce((sum, li) => sum + li.actualCost, 0);
    return { totalEstimated: estimated, totalActual: actual };
  }, [lineItems]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const anyCanEdit = canEdit || assignedDeptIds.size > 0;

  const memberOptions = [
    { value: "", label: "Unassigned" },
    ...projectMembers.map((m) => ({
      value: m.userId,
      label: m.name || m.email,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Budget Builder</h2>
          {isApplyingChange && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </div>
          )}
          {budgetStatus === "LOCKED" && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-md">
              <Lock className="h-3.5 w-3.5" />
              Read-only
            </div>
          )}
        </div>
        {isFinanceManager && budgetStatus !== "LOCKED" && (
          <Button
            onClick={() => {
              setEditCategory(null);
              setDefaultParentCategoryId(null);
              setShowCategoryForm(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Department
          </Button>
        )}
      </div>

      {/* Totals */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex-1">
          <span className="text-xs text-muted-foreground">Estimated</span>
          <p className="text-xl font-semibold">{formatCurrency(totalEstimated)}</p>
        </div>
        <div className="flex-1">
          <span className="text-xs text-muted-foreground">Actual</span>
          <p
            className={cn(
              "text-xl font-semibold",
              totalActual > totalEstimated ? "text-red-600" : "text-emerald-600"
            )}
          >
            {formatCurrency(totalActual)}
          </p>
        </div>
      </div>

      {/* Departments List */}
      {sortedCategories.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="space-y-3">
            {parentCategories.map((department) => {
              const childCats = childCategoriesByParent.get(department.id) || [];
              const deptLineItems = childCats.flatMap(
                (cat) => lineItemsByCategory[cat.id] || []
              );
              const deptEstimated = deptLineItems.reduce(
                (sum, li) => sum + li.estimatedTotal,
                0
              );
              const categoryIds = childCats.map((c) => `category-${c.id}`);
              const deptCanEdit = canEditDepartment(department);
              const isAssignedHead = assignedDeptIds.has(department.id);
              const isLoading = workflowLoading === department.id;

              const canSubmit =
                (isAssignedHead || isFinanceManager) &&
                ["NOT_STARTED", "IN_PROGRESS", "REVISION_REQUESTED"].includes(
                  department.departmentStatus
                );
              const canReview =
                isFinanceManager && department.departmentStatus === "SUBMITTED";
              const canReopen =
                isFinanceManager && department.departmentStatus === "APPROVED";
              const hasActions =
                deptCanEdit || canSubmit || canReview || canReopen || isFinanceManager;

              const assigneeName = department.assignedUserId
                ? projectMembers.find((m) => m.userId === department.assignedUserId)?.name ||
                  "Assigned"
                : null;

              return (
                <div key={department.id} className="rounded-xl border border-border bg-card">
                  {/* Department header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-3 min-w-0 text-left"
                      onClick={() => toggleDepartment(department.id)}
                    >
                      {expandedDepartments.has(department.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full shrink-0", STATUS_DOT_COLOR[department.departmentStatus])}
                        title={DEPARTMENT_BUDGET_STATUS_LABELS[department.departmentStatus]}
                      />
                      <span className="font-semibold truncate">{department.name}</span>
                      {assigneeName && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          {assigneeName}
                        </span>
                      )}
                      <span className="ml-auto text-sm font-medium tabular-nums shrink-0">
                        {formatCurrency(deptEstimated)}
                      </span>
                    </button>

                    {hasActions && budgetStatus !== "LOCKED" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {deptCanEdit && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditCategory(null);
                                setDefaultParentCategoryId(department.id);
                                setShowCategoryForm(true);
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Category
                            </DropdownMenuItem>
                          )}
                          {isFinanceManager && (
                            <DropdownMenuItem
                              onClick={() => {
                                setAssignUserId(department.assignedUserId ?? "");
                                setAssignDialogDept(department);
                              }}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Assign Department Head
                            </DropdownMenuItem>
                          )}
                          {(deptCanEdit || canSubmit || canReview || canReopen) && isFinanceManager && (
                            <DropdownMenuSeparator />
                          )}
                          {canSubmit && (
                            <DropdownMenuItem
                              onClick={() => void handleSubmitDept(department)}
                              disabled={isLoading}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Submit for Review
                            </DropdownMenuItem>
                          )}
                          {canReview && (
                            <>
                              <DropdownMenuItem
                                onClick={() => void handleApproveDept(department)}
                                disabled={isLoading}
                              >
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRevisionNotes("");
                                  setRevisionDialogDept(department);
                                }}
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Request Revision
                              </DropdownMenuItem>
                            </>
                          )}
                          {canReopen && (
                            <DropdownMenuItem
                              onClick={() => void handleReopenDept(department)}
                              disabled={isLoading}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reopen for Edits
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Revision notes banner */}
                  {department.departmentStatus === "REVISION_REQUESTED" &&
                    department.reviewNotes && (
                      <div className="mx-4 mt-1 mb-2 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-sm dark:border-orange-900/50 dark:bg-orange-900/10">
                        <MessageSquare className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                        <p className="text-orange-800 dark:text-orange-300">
                          {department.reviewNotes}
                        </p>
                      </div>
                    )}

                  {/* Expanded content */}
                  {expandedDepartments.has(department.id) && (
                    <div className="px-4 pb-4 pt-2 space-y-3">
                      {childCats.length > 0 ? (
                        <SortableContext
                          items={categoryIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {childCats.map((category) => (
                              <SortableBudgetCategoryCard
                                key={category.id}
                                category={category}
                                lineItems={lineItemsByCategory[category.id] || []}
                                isExpanded={expandedCategories.has(category.id)}
                                canEdit={deptCanEdit}
                                onToggle={() => toggleCategory(category.id)}
                                onEdit={() => handleEditCategory(category)}
                                onDelete={onRefresh}
                                onAddLineItem={() => handleAddLineItem(category.id)}
                                onRefresh={onRefresh}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                          No categories yet.
                          {deptCanEdit && " Use the menu to add one."}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {orphanCategories.length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
                  <span className="font-semibold">Unassigned Categories</span>
                </div>
                <div className="p-4 space-y-3">
                  {orphanCategories.map((category) => (
                    <SortableBudgetCategoryCard
                      key={category.id}
                      category={category}
                      lineItems={lineItemsByCategory[category.id] || []}
                      isExpanded={expandedCategories.has(category.id)}
                      canEdit={isFinanceManager && budgetStatus !== "LOCKED"}
                      onToggle={() => toggleCategory(category.id)}
                      onEdit={() => handleEditCategory(category)}
                      onDelete={onRefresh}
                      onAddLineItem={() => handleAddLineItem(category.id)}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeItem?.type === "category" && (
              <CategoryOverlay
                category={activeItem.category}
                lineItems={lineItemsByCategory[activeItem.category.id] || []}
              />
            )}
            {activeItem?.type === "lineitem" && (
              <LineItemOverlay lineItem={activeItem.lineItem} />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="border border-dashed border-border rounded-xl px-4 py-12 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No categories yet</p>
          {anyCanEdit && (
            <p className="text-sm text-muted-foreground mt-1">
              Click &quot;Add Department&quot; to start building your budget
            </p>
          )}
        </div>
      )}

      {/* Category Form Modal */}
      <AddCategoryForm
        budgetId={budgetId}
        categories={categories}
        open={showCategoryForm}
        onOpenChange={handleCategoryFormClose}
        onSuccess={onRefresh}
        editCategory={editCategory}
        defaultParentCategoryId={defaultParentCategoryId}
      />

      {/* Line Item Form Modal */}
      {activeLineItemCategoryId && (
        <AddLineItemForm
          categoryId={activeLineItemCategoryId}
          open={showLineItemForm}
          onOpenChange={handleLineItemFormClose}
          onSuccess={onRefresh}
          editLineItem={editLineItem}
        />
      )}

      {/* Assign Department Head Dialog */}
      <Dialog
        open={assignDialogDept !== null}
        onOpenChange={(open) => {
          if (!open) setAssignDialogDept(null);
        }}
      >
        <DialogContent onClose={() => setAssignDialogDept(null)}>
          <DialogHeader>
            <DialogTitle>Assign Department Head</DialogTitle>
            <DialogDescription>
              Choose a team member to lead {assignDialogDept?.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              options={memberOptions}
              disabled={assignLoading}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogDept(null)}
              disabled={assignLoading}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleAssignHead()} disabled={assignLoading}>
              {assignLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revision Dialog */}
      <Dialog
        open={revisionDialogDept !== null}
        onOpenChange={(open) => {
          if (!open) setRevisionDialogDept(null);
        }}
      >
        <DialogContent onClose={() => setRevisionDialogDept(null)}>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              Add notes for the department head of {revisionDialogDept?.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="What needs to be changed..."
              rows={3}
              disabled={workflowLoading !== null}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevisionDialogDept(null)}
              disabled={workflowLoading !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRequestRevision()}
              disabled={workflowLoading !== null}
            >
              {workflowLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
