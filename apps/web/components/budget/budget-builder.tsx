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
  DragOverEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, Lock, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BudgetCategory, BudgetLineItem } from "@/lib/actions/budgets";
import { reorderBudgetCategories, updateBudgetCategory } from "@/lib/actions/budget-categories";
import { reorderLineItems, moveLineItemToCategory } from "@/lib/actions/budget-line-items";
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
}

type DragItem =
  | { type: "category"; category: BudgetCategory }
  | { type: "lineitem"; lineItem: BudgetLineItem };

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

  React.useEffect(() => {
    setValue(department.allocatedBudget?.toString() ?? "");
  }, [department.allocatedBudget]);

  const handleSave = async () => {
    const parsed = parseFloat(value);
    const allocatedBudgetValue = Number.isFinite(parsed) ? parsed : 0;
    try {
      await updateBudgetCategory(department.id, {
        allocatedBudget: allocatedBudgetValue,
      });
      onRefresh();
    } catch (error) {
      console.error("Error updating department allocation:", error);
    }
  };

  return (
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
  );
}

export function BudgetBuilder({
  budgetId,
  categories,
  lineItems,
  onRefresh,
  canEdit,
}: BudgetBuilderProps) {
  // Expanded state for categories
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(() => {
    // Start with all categories expanded
    return new Set(categories.map((c) => c.id));
  });
  const [expandedDepartments, setExpandedDepartments] = React.useState<Set<string>>(
    () => new Set(categories.filter((c) => !c.parentCategoryId).map((c) => c.id))
  );

  // Drag state
  const [activeItem, setActiveItem] = React.useState<DragItem | null>(null);

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

  // Handle drag start
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

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle category reordering within the same parent (or top-level)
    if (activeId.startsWith("category-") && overId.startsWith("category-")) {
      const activeCategoryId = activeId.replace("category-", "");
      const overCategoryId = overId.replace("category-", "");

      const activeCategory = categoriesById.get(activeCategoryId);
      const overCategory = categoriesById.get(overCategoryId);

      if (!activeCategory || !overCategory) return;

      if (activeCategory.parentCategoryId !== overCategory.parentCategoryId) {
        return;
      }

      const siblingCategories = activeCategory.parentCategoryId
        ? childCategoriesByParent.get(activeCategory.parentCategoryId) || []
        : parentCategories;
      const sortedSiblings = [...siblingCategories].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = sortedSiblings.findIndex((c) => c.id === activeCategoryId);
      const newIndex = sortedSiblings.findIndex((c) => c.id === overCategoryId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedSiblings, oldIndex, newIndex);
        await reorderBudgetCategories(budgetId, newOrder.map((c) => c.id));
        onRefresh();
      }
    }

    // Handle line item reordering within same category
    if (activeId.startsWith("lineitem-") && overId.startsWith("lineitem-")) {
      const activeLineItemId = activeId.replace("lineitem-", "");
      const overLineItemId = overId.replace("lineitem-", "");

      const activeLineItem = lineItems.find((li) => li.id === activeLineItemId);
      const overLineItem = lineItems.find((li) => li.id === overLineItemId);

      if (activeLineItem && overLineItem) {
        if (activeLineItem.categoryId === overLineItem.categoryId) {
          // Reorder within same category
          const categoryItems = lineItemsByCategory[activeLineItem.categoryId] || [];
          const sortedItems = [...categoryItems].sort((a, b) => a.sortOrder - b.sortOrder);
          const oldIndex = sortedItems.findIndex((li) => li.id === activeLineItemId);
          const newIndex = sortedItems.findIndex((li) => li.id === overLineItemId);

          if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(sortedItems, oldIndex, newIndex);
            await reorderLineItems(activeLineItem.categoryId, newOrder.map((li) => li.id));
            onRefresh();
          }
        } else {
          // Move to different category
          const targetCategoryItems = lineItemsByCategory[overLineItem.categoryId] || [];
          const sortedTargetItems = [...targetCategoryItems].sort((a, b) => a.sortOrder - b.sortOrder);
          const overIndex = sortedTargetItems.findIndex((li) => li.id === overLineItemId);
          await moveLineItemToCategory(activeLineItemId, overLineItem.categoryId, overIndex);
          onRefresh();
        }
      }
    }

    // Handle line item dropped on category header
    if (activeId.startsWith("lineitem-") && overId.startsWith("category-")) {
      const activeLineItemId = activeId.replace("lineitem-", "");
      const targetCategoryId = overId.replace("category-", "");

      const activeLineItem = lineItems.find((li) => li.id === activeLineItemId);
      if (activeLineItem && activeLineItem.categoryId !== targetCategoryId) {
        const targetCategoryItems = lineItemsByCategory[targetCategoryId] || [];
        await moveLineItemToCategory(activeLineItemId, targetCategoryId, targetCategoryItems.length);
        onRefresh();
      }
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  // Toggle category expansion
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

  // Handle category edit
  const handleEditCategory = (category: BudgetCategory) => {
    setEditCategory(category);
    setDefaultParentCategoryId(null);
    setShowCategoryForm(true);
  };

  // Handle add line item
  const handleAddLineItem = (categoryId: string) => {
    setActiveLineItemCategoryId(categoryId);
    setEditLineItem(null);
    setShowLineItemForm(true);
  };

  // Handle category form close
  const handleCategoryFormClose = (open: boolean) => {
    setShowCategoryForm(open);
    if (!open) {
      setEditCategory(null);
      setDefaultParentCategoryId(null);
    }
  };

  // Handle line item form close
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

  // Get active line item's category items for overlay
  const getActiveLineItemCategoryItems = () => {
    if (activeItem?.type === "lineitem") {
      return lineItemsByCategory[activeItem.lineItem.categoryId] || [];
    }
    return [];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Budget Builder</h2>
          {!canEdit && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-md">
              <Lock className="h-3.5 w-3.5" />
              Read-only
            </div>
          )}
        </div>
        {canEdit && (
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

              return (
                <div key={department.id} className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
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
                      <span className="text-xs text-muted-foreground">
                        {childCategories.length} category{childCategories.length !== 1 ? "ies" : "y"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <span className="text-muted-foreground text-xs mr-1">Alloc:</span>
                        {canEdit ? (
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
                    {canEdit && (
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
                                canEdit={canEdit}
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
                      canEdit={canEdit}
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
          {canEdit && (
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
