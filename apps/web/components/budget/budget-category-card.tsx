"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Plus, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteBudgetCategory, updateBudgetCategory } from "@/lib/actions/budget-categories";
import type { BudgetCategory, BudgetLineItem } from "@/lib/actions/budgets";
import {
  SortableBudgetLineItemRow,
  LineItemOverlay,
} from "./budget-line-item-row";

interface BudgetCategoryCardProps {
  category: BudgetCategory;
  lineItems: BudgetLineItem[];
  isExpanded: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onAddLineItem: () => void;
  onRefresh: () => void;
}

export function SortableBudgetCategoryCard({
  category,
  lineItems,
  isExpanded,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  onAddLineItem,
  onRefresh,
}: BudgetCategoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `category-${category.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BudgetCategoryCard
        category={category}
        lineItems={lineItems}
        isExpanded={isExpanded}
        canEdit={canEdit}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddLineItem={onAddLineItem}
        onRefresh={onRefresh}
        isDragging={isDragging}
        dragHandleProps={canEdit ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}

interface InternalCardProps extends BudgetCategoryCardProps {
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function BudgetCategoryCard({
  category,
  lineItems,
  isExpanded,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  onAddLineItem,
  onRefresh,
  isDragging,
  dragHandleProps,
}: InternalCardProps) {
  const [showActions, setShowActions] = React.useState(false);
  const [allocationValue, setAllocationValue] = React.useState<string>(
    category.allocatedBudget?.toString() ?? ""
  );
  const allocationSaveRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sort line items by sortOrder
  const sortedLineItems = React.useMemo(() => {
    return [...lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [lineItems]);

  // Calculate subtotals
  const { subtotalEstimated, subtotalActual } = React.useMemo(() => {
    const estimated = lineItems.reduce((sum, li) => sum + li.estimatedTotal, 0);
    const actual = lineItems.reduce((sum, li) => sum + li.actualCost, 0);
    return { subtotalEstimated: estimated, subtotalActual: actual };
  }, [lineItems]);

  React.useEffect(() => {
    setAllocationValue(category.allocatedBudget?.toString() ?? "");
  }, [category.allocatedBudget]);

  React.useEffect(() => {
    return () => {
      if (allocationSaveRef.current) {
        clearTimeout(allocationSaveRef.current);
      }
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const allocatedBudget = category.allocatedBudget || 0;
  const actualVariance = allocatedBudget - subtotalActual;

  const handleAllocationChange = (value: string) => {
    setAllocationValue(value);
    if (!canEdit) return;

    if (allocationSaveRef.current) {
      clearTimeout(allocationSaveRef.current);
    }

    allocationSaveRef.current = setTimeout(async () => {
      const parsed = parseFloat(value);
      const allocatedBudgetValue = Number.isFinite(parsed) ? parsed : 0;
      try {
        await updateBudgetCategory(category.id, { allocatedBudget: allocatedBudgetValue });
        onRefresh();
      } catch (error) {
        console.error("Error updating allocation:", error);
      }
    }, 400);
  };

  const handleDelete = async () => {
    if (!canEdit || !onDelete) return;
    if (!confirm(`Delete category "${category.name}" and all its line items?`)) return;

    try {
      await deleteBudgetCategory(category.id);
      onDelete();
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const lineItemIds = sortedLineItems.map((li) => `lineitem-${li.id}`);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden transition-all",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Category Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
        {/* Drag Handle */}
        {canEdit && dragHandleProps && (
          <div
            {...dragHandleProps}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted -ml-1"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        {/* Category Info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="flex h-6 px-2 items-center justify-center rounded bg-muted text-xs font-semibold">
            {category.code}
          </span>
          <span className="font-medium truncate">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            ({lineItems.length} item{lineItems.length !== 1 ? "s" : ""})
          </span>
        </div>

        {/* Subtotals */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <span className="text-muted-foreground text-xs mr-1">Alloc:</span>
            {canEdit ? (
              <input
                type="number"
                step="0.01"
                min="0"
                value={allocationValue}
                onChange={(e) => handleAllocationChange(e.target.value)}
                className="w-24 rounded border border-transparent bg-transparent text-right text-sm font-medium text-foreground placeholder:text-muted-foreground hover:border-input focus:border-input focus:outline-none"
                placeholder="0.00"
              />
            ) : (
              <span className="font-medium">{formatCurrency(allocatedBudget)}</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-muted-foreground text-xs mr-1">Planned:</span>
            <span className="font-medium">{formatCurrency(subtotalEstimated)}</span>
          </div>
          {subtotalActual > 0 && (
            <div className="text-right">
              <span className="text-muted-foreground text-xs mr-1">Actual:</span>
              <span
                className={cn(
                  "font-medium",
                  subtotalActual > subtotalEstimated
                    ? "text-red-600"
                    : "text-emerald-600"
                )}
              >
                {formatCurrency(subtotalActual)}
              </span>
            </div>
          )}
          {allocatedBudget > 0 && (
            <div className="text-right">
              <span className="text-muted-foreground text-xs mr-1">Var:</span>
              <span
                className={cn(
                  "font-medium",
                  actualVariance < 0 ? "text-red-600" : "text-emerald-600"
                )}
              >
                {formatCurrency(actualVariance)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && showActions && (
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Line Items */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          {/* Column Headers */}
          {sortedLineItems.length > 0 && (
            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground font-medium">
              {canEdit && <div className="w-4" />}
              <div className="w-16">Code</div>
              <div className="flex-1">Description</div>
              <div className="w-20">Units</div>
              <div className="w-16 text-right">Qty</div>
              <div className="w-24 text-right">Rate</div>
              <div className="w-16 text-right">Fringe</div>
              <div className="w-24 text-right">Total</div>
              {canEdit && <div className="w-8" />}
            </div>
          )}

          {/* Line Items List */}
          <SortableContext items={lineItemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {sortedLineItems.map((lineItem) => (
                <SortableBudgetLineItemRow
                  key={lineItem.id}
                  lineItem={lineItem}
                  canEdit={canEdit}
                  onUpdate={onRefresh}
                  onDelete={onRefresh}
                />
              ))}
            </div>
          </SortableContext>

          {/* Empty State */}
          {sortedLineItems.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No line items in this category
            </div>
          )}

          {/* Add Line Item Button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-dashed"
              onClick={onAddLineItem}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Line Item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Static card for drag overlay
export function CategoryOverlay({ category, lineItems }: { category: BudgetCategory; lineItems: BudgetLineItem[] }) {
  const subtotalEstimated = lineItems.reduce((sum, li) => sum + li.estimatedTotal, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="rounded-xl border border-primary bg-card shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
        <div className="p-0.5">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="flex h-6 px-2 items-center justify-center rounded bg-muted text-xs font-semibold">
            {category.code}
          </span>
          <span className="font-medium truncate">{category.name}</span>
        </div>
        <div className="text-sm font-medium">{formatCurrency(subtotalEstimated)}</div>
      </div>
    </div>
  );
}
