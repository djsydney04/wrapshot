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
import { Plus, Lock, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BudgetCategory, BudgetLineItem } from "@/lib/actions/budgets";
import { reorderBudgetCategories } from "@/lib/actions/budget-categories";
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

  // Drag state
  const [activeItem, setActiveItem] = React.useState<DragItem | null>(null);

  // Form states
  const [showCategoryForm, setShowCategoryForm] = React.useState(false);
  const [editCategory, setEditCategory] = React.useState<BudgetCategory | null>(null);
  const [showLineItemForm, setShowLineItemForm] = React.useState(false);
  const [activeLineItemCategoryId, setActiveLineItemCategoryId] = React.useState<string | null>(null);
  const [editLineItem, setEditLineItem] = React.useState<BudgetLineItem | null>(null);

  // Sort categories by sortOrder
  const sortedCategories = React.useMemo(() => {
    return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
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

    // Handle category reordering
    if (activeId.startsWith("category-") && overId.startsWith("category-")) {
      const activeCategoryId = activeId.replace("category-", "");
      const overCategoryId = overId.replace("category-", "");

      const oldIndex = sortedCategories.findIndex((c) => c.id === activeCategoryId);
      const newIndex = sortedCategories.findIndex((c) => c.id === overCategoryId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
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

  // Handle category edit
  const handleEditCategory = (category: BudgetCategory) => {
    setEditCategory(category);
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
  const { totalEstimated, totalActual } = React.useMemo(() => {
    const estimated = lineItems.reduce((sum, li) => sum + li.estimatedTotal, 0);
    const actual = lineItems.reduce((sum, li) => sum + li.actualCost, 0);
    return { totalEstimated: estimated, totalActual: actual };
  }, [lineItems]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const categoryIds = sortedCategories.map((c) => `category-${c.id}`);

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
          <Button onClick={() => setShowCategoryForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Category
          </Button>
        )}
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-border bg-muted/30">
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

      {/* Categories List */}
      {sortedCategories.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedCategories.map((category) => (
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
              Click &quot;Add Category&quot; to start building your budget
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
