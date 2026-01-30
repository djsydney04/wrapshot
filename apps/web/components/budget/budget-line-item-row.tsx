"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  updateBudgetLineItem,
  deleteBudgetLineItem,
  type LineItemUnits,
} from "@/lib/actions/budget-line-items";
import type { BudgetLineItem } from "@/lib/actions/budgets";

interface BudgetLineItemRowProps {
  lineItem: BudgetLineItem;
  canEdit: boolean;
  onUpdate?: () => void;
  onDelete?: () => void;
}

const unitsOptions = [
  { value: "FLAT", label: "Flat" },
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "HOURS", label: "Hours" },
  { value: "EACH", label: "Each" },
];

export function SortableBudgetLineItemRow({
  lineItem,
  canEdit,
  onUpdate,
  onDelete,
}: BudgetLineItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `lineitem-${lineItem.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BudgetLineItemRow
        lineItem={lineItem}
        canEdit={canEdit}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={canEdit ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}

interface InternalRowProps extends BudgetLineItemRowProps {
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function BudgetLineItemRow({
  lineItem,
  canEdit,
  onUpdate,
  onDelete,
  isDragging,
  dragHandleProps,
}: InternalRowProps) {
  const [localValues, setLocalValues] = React.useState({
    description: lineItem.description,
    quantity: lineItem.quantity.toString(),
    rate: lineItem.rate.toString(),
    units: lineItem.units,
    fringePercent: lineItem.fringePercent.toString(),
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Calculate estimated total
  const estimatedTotal = React.useMemo(() => {
    const quantity = parseFloat(localValues.quantity) || 0;
    const rate = parseFloat(localValues.rate) || 0;
    const fringePercent = parseFloat(localValues.fringePercent) || 0;
    const subtotal = quantity * rate;
    const fringe = subtotal * (fringePercent / 100);
    return subtotal + fringe;
  }, [localValues.quantity, localValues.rate, localValues.fringePercent]);

  // Debounced save
  const debouncedSave = React.useCallback(
    async (field: string, value: string | number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const updates: Record<string, unknown> = {};

          if (field === "description") {
            updates.description = value as string;
          } else if (field === "quantity") {
            updates.quantity = parseFloat(value as string) || 0;
          } else if (field === "rate") {
            updates.rate = parseFloat(value as string) || 0;
          } else if (field === "units") {
            updates.units = value as LineItemUnits;
          } else if (field === "fringePercent") {
            updates.fringePercent = parseFloat(value as string) || 0;
          }

          await updateBudgetLineItem(lineItem.id, updates);
          onUpdate?.();
        } catch (error) {
          console.error("Error saving line item:", error);
        } finally {
          setIsSaving(false);
        }
      }, 300);
    },
    [lineItem.id, onUpdate]
  );

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Update local values when lineItem changes from external source
  React.useEffect(() => {
    setLocalValues({
      description: lineItem.description,
      quantity: lineItem.quantity.toString(),
      rate: lineItem.rate.toString(),
      units: lineItem.units,
      fringePercent: lineItem.fringePercent.toString(),
    });
  }, [lineItem]);

  const handleFieldChange = (field: keyof typeof localValues, value: string) => {
    setLocalValues((prev) => ({ ...prev, [field]: value }));
    if (canEdit) {
      debouncedSave(field, value);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    try {
      await deleteBudgetLineItem(lineItem.id);
      onDelete?.();
    } catch (error) {
      console.error("Error deleting line item:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 transition-all",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary",
        !canEdit && "opacity-75"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Drag Handle */}
      {canEdit && dragHandleProps && (
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Account Code */}
      <div className="w-16 flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground">
          {lineItem.accountCode}
        </span>
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        {canEdit ? (
          <Input
            value={localValues.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            className="h-7 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
            placeholder="Description"
          />
        ) : (
          <span className="text-sm truncate block">{lineItem.description}</span>
        )}
      </div>

      {/* Units */}
      <div className="w-20 flex-shrink-0">
        {canEdit ? (
          <Select
            value={localValues.units}
            onChange={(e) => handleFieldChange("units", e.target.value)}
            options={unitsOptions}
            className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
          />
        ) : (
          <span className="text-xs text-muted-foreground">{lineItem.units}</span>
        )}
      </div>

      {/* Quantity */}
      <div className="w-16 flex-shrink-0">
        {canEdit ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={localValues.quantity}
            onChange={(e) => handleFieldChange("quantity", e.target.value)}
            className="h-7 text-sm text-right border-transparent hover:border-input focus:border-input bg-transparent"
            placeholder="Qty"
          />
        ) : (
          <span className="text-sm text-right block">{lineItem.quantity}</span>
        )}
      </div>

      {/* Rate */}
      <div className="w-24 flex-shrink-0">
        {canEdit ? (
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={localValues.rate}
              onChange={(e) => handleFieldChange("rate", e.target.value)}
              className="h-7 text-sm pl-5 text-right border-transparent hover:border-input focus:border-input bg-transparent"
              placeholder="Rate"
            />
          </div>
        ) : (
          <span className="text-sm text-right block">{formatCurrency(lineItem.rate)}</span>
        )}
      </div>

      {/* Fringe */}
      <div className="w-16 flex-shrink-0">
        {canEdit ? (
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={localValues.fringePercent}
              onChange={(e) => handleFieldChange("fringePercent", e.target.value)}
              className="h-7 text-sm pr-5 text-right border-transparent hover:border-input focus:border-input bg-transparent"
              placeholder="0"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        ) : (
          <span className="text-sm text-right block">{lineItem.fringePercent}%</span>
        )}
      </div>

      {/* Total */}
      <div className="w-24 flex-shrink-0 text-right">
        <span className={cn("text-sm font-medium", isSaving && "text-muted-foreground")}>
          {formatCurrency(estimatedTotal)}
        </span>
      </div>

      {/* Actions */}
      <div className="w-8 flex-shrink-0">
        {canEdit && showActions && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Static row for drag overlay
export function LineItemOverlay({ lineItem }: { lineItem: BudgetLineItem }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary bg-card px-2 py-2 shadow-lg">
      <div className="p-0.5">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="w-16 flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground">
          {lineItem.accountCode}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block">{lineItem.description}</span>
      </div>
      <div className="w-24 flex-shrink-0 text-right">
        <span className="text-sm font-medium">{formatCurrency(lineItem.estimatedTotal)}</span>
      </div>
    </div>
  );
}
