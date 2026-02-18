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
  Send,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  UserCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BudgetCategory, BudgetLineItem } from "@/lib/actions/budgets";
import type { BudgetRequestPermissions } from "@/lib/actions/budget-requests";
import {
  reorderBudgetCategories,
  updateBudgetCategory,
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

const DEPT_STATUS_STYLES: Record<DepartmentBudgetStatus, string> = {
  NOT_STARTED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REVISION_REQUESTED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function DepartmentAllocationInput({
  department,
  onRefresh,
}: {
  department: BudgetCategory;
  onRefresh: () => void;
}) {
  const [value, setValue] = React.useState<string>(
    department.allocatedBudget?.toString() ?? ""
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setValue(department.allocatedBudget?.toString() ?? "");
  }, [department.allocatedBudget]);

  const handleSave = async () => {
    const parsed = parseFloat(value);
    const allocatedBudgetValue = Number.isFinite(parsed) ? parsed : 0;
    try {
      setIsSaving(true);
      await updateBudgetCategory(department.id, {
        allocatedBudget: allocatedBudgetValue,
      });
      toast.success("Department allocation saved");
      onRefresh();
    } catch (error) {
      console.error("Error updating department allocation:", error);
      toast.error("Failed to save allocation");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        min="0"
        className="w-24 bg-transparent border border-border rounded px-2 py-1 text-right text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

function DepartmentWorkflowActions({
  department,
  isFinanceManager,
  isAssignedHead,
  projectMembers,
  onRefresh,
}: {
  department: BudgetCategory;
  isFinanceManager: boolean;
  isAssignedHead: boolean;
  projectMembers: { userId: string; name: string; email: string }[];
  onRefresh: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [showRevisionNotes, setShowRevisionNotes] = React.useState(false);
  const [revisionNotes, setRevisionNotes] = React.useState("");
  const [assigningHead, setAssigningHead] = React.useState(false);

  const handleAssignHead = async (userId: string) => {
    setAssigningHead(true);
    try {
      await assignDepartmentHead(department.id, userId || null);
      toast.success(userId ? "Department head assigned" : "Department head unassigned");
      onRefresh();
    } catch (err) {
      console.error("Error assigning department head:", err);
      toast.error(err instanceof Error ? err.message : "Failed to assign department head");
    } finally {
      setAssigningHead(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitDepartmentBudget(department.id);
      toast.success("Department budget submitted for review");
      onRefresh();
    } catch (err) {
      console.error("Error submitting department budget:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await reviewDepartmentBudget(department.id, "APPROVE");
      toast.success("Department budget approved");
      onRefresh();
    } catch (err) {
      console.error("Error approving department budget:", err);
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRevision = async () => {
    setLoading(true);
    try {
      await reviewDepartmentBudget(department.id, "REQUEST_REVISION", revisionNotes);
      toast.success("Revision requested");
      setShowRevisionNotes(false);
      setRevisionNotes("");
      onRefresh();
    } catch (err) {
      console.error("Error requesting revision:", err);
      toast.error(err instanceof Error ? err.message : "Failed to request revision");
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    try {
      await reopenDepartmentBudget(department.id);
      toast.success("Department budget reopened for edits");
      onRefresh();
    } catch (err) {
      console.error("Error reopening department budget:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reopen");
    } finally {
      setLoading(false);
    }
  };

  const memberOptions = [
    { value: "", label: "Unassigned" },
    ...projectMembers.map((m) => ({
      value: m.userId,
      label: m.name || m.email,
    })),
  ];

  const canSubmit =
    (isAssignedHead || isFinanceManager) &&
    ["NOT_STARTED", "IN_PROGRESS", "REVISION_REQUESTED"].includes(department.departmentStatus);

  const canReview = isFinanceManager && department.departmentStatus === "SUBMITTED";
  const canReopen = isFinanceManager && department.departmentStatus === "APPROVED";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Department head assignment (finance managers only) */}
        {isFinanceManager && (
          <div className="flex items-center gap-1.5">
            <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="w-44">
              <Select
                value={department.assignedUserId ?? ""}
                onChange={(e) => void handleAssignHead(e.target.value)}
                options={memberOptions}
                disabled={assigningHead || loading}
              />
            </div>
          </div>
        )}

        {/* Show assigned head name for non-managers */}
        {!isFinanceManager && department.assignedUserId && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserCircle className="h-3.5 w-3.5" />
            {projectMembers.find((m) => m.userId === department.assignedUserId)?.name || "Assigned"}
          </div>
        )}

        {/* Submit for review */}
        {canSubmit && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Submit for Review
          </Button>
        )}

        {/* Approve / Request Revision */}
        {canReview && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleApprove}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => setShowRevisionNotes(!showRevisionNotes)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Request Revision
            </Button>
          </>
        )}

        {/* Reopen */}
        {canReopen && (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={handleReopen}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        )}
      </div>

      {/* Revision notes input */}
      {showRevisionNotes && (
        <div className="flex items-start gap-2">
          <Textarea
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            placeholder="Notes for the department head..."
            rows={2}
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={loading}
            onClick={handleRequestRevision}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
          </Button>
        </div>
      )}
    </div>
  );
}

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

  // Expanded state for categories
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(() => {
    return new Set(categories.map((c) => c.id));
  });
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

  // Sort categories by sortOrder
  const sortedCategories = React.useMemo(() => {
    return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories]);

  const categoriesById = React.useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const parentCategories = React.useMemo(() => {
    return sortedCategories.filter((category) => !category.parentCategoryId);
  }, [sortedCategories]);

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

  const orphanCategories = React.useMemo(() => {
    return sortedCategories.filter(
      (category) => category.parentCategoryId && !categoriesById.has(category.parentCategoryId)
    );
  }, [sortedCategories, categoriesById]);

  // Department approval progress
  const { approvedCount, totalAssigned } = React.useMemo(() => {
    const assigned = parentCategories.filter((c) => c.assignedUserId);
    const approved = assigned.filter((c) => c.departmentStatus === "APPROVED");
    return { approvedCount: approved.length, totalAssigned: assigned.length };
  }, [parentCategories]);

  React.useEffect(() => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      parentCategories.forEach((category) => next.add(category.id));
      return next;
    });
  }, [parentCategories]);

  React.useEffect(() => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      categories.forEach((category) => next.add(category.id));
      return next;
    });
  }, [categories]);

  // Group line items by category
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

      // Finance managers can edit when department is not approved
      if (isFinanceManager) {
        return department.departmentStatus !== "APPROVED";
      }

      // Assigned department heads can edit when department is in editable status
      if (assignedDeptIds.has(department.id)) {
        return ["NOT_STARTED", "IN_PROGRESS", "REVISION_REQUESTED"].includes(
          department.departmentStatus
        );
      }

      return false;
    },
    [budgetStatus, isFinanceManager, assignedDeptIds]
  );

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    if (activeId.startsWith("category-")) {
      const categoryId = activeId.replace("category-", "");
      const category = categories.find((c) => c.id === categoryId);
      if (category) {
        setActiveItem({ type: "category", category });
      }
    } else if (activeId.startsWith("lineitem-")) {
      const lineItemId = activeId.replace("lineitem-", "");
      const lineItem = lineItems.find((li) => li.id === lineItemId);
      if (lineItem) {
        setActiveItem({ type: "lineitem", lineItem });
      }
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

      const siblingCategories = activeCategory.parentCategoryId
        ? childCategoriesByParent.get(activeCategory.parentCategoryId) || []
        : parentCategories;
      const sortedSiblings = [...siblingCategories].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = sortedSiblings.findIndex((c) => c.id === activeCategoryId);
      const newIndex = sortedSiblings.findIndex((c) => c.id === overCategoryId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedSiblings, oldIndex, newIndex);
        try {
          setIsApplyingChange(true);
          await reorderBudgetCategories(budgetId, newOrder.map((c) => c.id));
          toast.success("Category order updated");
          onRefresh();
        } catch (error) {
          console.error("Failed to reorder categories:", error);
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
          const categoryItems = lineItemsByCategory[activeLineItem.categoryId] || [];
          const sortedItems = [...categoryItems].sort((a, b) => a.sortOrder - b.sortOrder);
          const oldIndex = sortedItems.findIndex((li) => li.id === activeLineItemId);
          const newIndex = sortedItems.findIndex((li) => li.id === overLineItemId);

          if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(sortedItems, oldIndex, newIndex);
            try {
              setIsApplyingChange(true);
              await reorderLineItems(
                activeLineItem.categoryId,
                newOrder.map((li) => li.id)
              );
              toast.success("Line item order updated");
              onRefresh();
            } catch (error) {
              console.error("Failed to reorder line items:", error);
              toast.error("Failed to reorder line items");
            } finally {
              setIsApplyingChange(false);
            }
          }
        } else {
          const targetCategoryItems = lineItemsByCategory[overLineItem.categoryId] || [];
          const sortedTargetItems = [...targetCategoryItems].sort((a, b) => a.sortOrder - b.sortOrder);
          const overIndex = sortedTargetItems.findIndex((li) => li.id === overLineItemId);
          try {
            setIsApplyingChange(true);
            await moveLineItemToCategory(
              activeLineItemId,
              overLineItem.categoryId,
              overIndex
            );
            toast.success("Line item moved");
            onRefresh();
          } catch (error) {
            console.error("Failed to move line item:", error);
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
        const targetCategoryItems = lineItemsByCategory[targetCategoryId] || [];
        try {
          setIsApplyingChange(true);
          await moveLineItemToCategory(
            activeLineItemId,
            targetCategoryId,
            targetCategoryItems.length
          );
          toast.success("Line item moved");
          onRefresh();
        } catch (error) {
          console.error("Failed to move line item:", error);
          toast.error("Failed to move line item");
        } finally {
          setIsApplyingChange(false);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleDepartment = (categoryId: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
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

  // Calculate totals
  const { totalEstimated, totalActual, totalAllocated } = React.useMemo(() => {
    const estimated = lineItems.reduce((sum, li) => sum + li.estimatedTotal, 0);
    const actual = lineItems.reduce((sum, li) => sum + li.actualCost, 0);
    const allocated = categories.reduce((sum, cat) => sum + (cat.allocatedBudget || 0), 0);
    return { totalEstimated: estimated, totalActual: actual, totalAllocated: allocated };
  }, [lineItems, categories]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const anyCanEdit = canEdit || assignedDeptIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Budget Builder</h2>
          {isApplyingChange && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving changes...
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

      {/* Department Approval Progress */}
      {totalAssigned > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
          {approvedCount === totalAssigned ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {approvedCount}/{totalAssigned} department{totalAssigned !== 1 ? "s" : ""} approved
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  approvedCount === totalAssigned ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${totalAssigned > 0 ? (approvedCount / totalAssigned) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {parentCategories
              .filter((c) => c.assignedUserId)
              .map((dept) => (
                <Badge
                  key={dept.id}
                  className={cn("text-[10px] px-1.5", DEPT_STATUS_STYLES[dept.departmentStatus])}
                >
                  {dept.code}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Totals Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-border bg-muted/30">
        <div>
          <span className="text-sm text-muted-foreground">Total Allocated</span>
          <p className="text-2xl font-semibold">{formatCurrency(totalAllocated)}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Total Estimated</span>
          <p className="text-2xl font-semibold">{formatCurrency(totalEstimated)}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Total Actual</span>
          <p
            className={cn(
              "text-2xl font-semibold",
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
          <div className="space-y-4">
            {parentCategories.map((department) => {
              const childCategories = childCategoriesByParent.get(department.id) || [];
              const departmentLineItems = childCategories.flatMap(
                (category) => lineItemsByCategory[category.id] || []
              );
              const departmentEstimated = departmentLineItems.reduce(
                (sum, li) => sum + li.estimatedTotal,
                0
              );
              const departmentActual = departmentLineItems.reduce(
                (sum, li) => sum + li.actualCost,
                0
              );
              const departmentAllocated =
                (department.allocatedBudget || 0) ||
                childCategories.reduce((sum, cat) => sum + (cat.allocatedBudget || 0), 0);
              const departmentVariance = departmentAllocated - departmentActual;
              const categoryIds = childCategories.map((c) => `category-${c.id}`);

              const deptCanEdit = canEditDepartment(department);
              const isAssignedHead = assignedDeptIds.has(department.id);

              return (
                <div
                  key={department.id}
                  className={cn(
                    "rounded-xl border bg-card",
                    department.departmentStatus === "APPROVED"
                      ? "border-emerald-200 dark:border-emerald-900/50"
                      : department.departmentStatus === "SUBMITTED"
                        ? "border-amber-200 dark:border-amber-900/50"
                        : department.departmentStatus === "REVISION_REQUESTED"
                          ? "border-orange-200 dark:border-orange-900/50"
                          : "border-border"
                  )}
                >
                  {/* Department header */}
                  <div className="px-4 py-3 border-b border-border bg-muted/20 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleDepartment(department.id)}
                      >
                        {expandedDepartments.has(department.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex h-6 px-2 items-center justify-center rounded bg-muted text-xs font-semibold">
                          {department.code}
                        </span>
                        <span className="font-semibold truncate">{department.name}</span>
                        <Badge
                          className={cn(
                            "text-[10px] px-1.5",
                            DEPT_STATUS_STYLES[department.departmentStatus]
                          )}
                        >
                          {DEPARTMENT_BUDGET_STATUS_LABELS[department.departmentStatus]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {childCategories.length} category{childCategories.length !== 1 ? "ies" : "y"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs mr-1">Alloc:</span>
                          {deptCanEdit ? (
                            <DepartmentAllocationInput
                              department={department}
                              onRefresh={onRefresh}
                            />
                          ) : (
                            <span className="font-medium">{formatCurrency(departmentAllocated)}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs mr-1">Est:</span>
                          <span className="font-medium">{formatCurrency(departmentEstimated)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs mr-1">Actual:</span>
                          <span className="font-medium">{formatCurrency(departmentActual)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs mr-1">Var:</span>
                          <span
                            className={cn(
                              "font-medium",
                              departmentVariance < 0 ? "text-red-600" : "text-emerald-600"
                            )}
                          >
                            {formatCurrency(departmentVariance)}
                          </span>
                        </div>
                      </div>
                      {deptCanEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditCategory(null);
                            setDefaultParentCategoryId(department.id);
                            setShowCategoryForm(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Category
                        </Button>
                      )}
                    </div>

                    {/* Department workflow actions */}
                    {(isFinanceManager || isAssignedHead) && budgetStatus !== "LOCKED" && (
                      <DepartmentWorkflowActions
                        department={department}
                        isFinanceManager={isFinanceManager}
                        isAssignedHead={isAssignedHead}
                        projectMembers={projectMembers}
                        onRefresh={onRefresh}
                      />
                    )}
                  </div>

                  {/* Revision notes banner */}
                  {department.departmentStatus === "REVISION_REQUESTED" && department.reviewNotes && (
                    <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/50 dark:bg-orange-900/10">
                      <MessageSquare className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                          Revision requested
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-300 mt-0.5">
                          {department.reviewNotes}
                        </p>
                      </div>
                    </div>
                  )}

                  {expandedDepartments.has(department.id) && (
                    <div className="p-4 space-y-3">
                      {childCategories.length > 0 ? (
                        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                          <div className="space-y-3">
                            {childCategories.map((category) => (
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
                          No categories yet for this department.
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
    </div>
  );
}
