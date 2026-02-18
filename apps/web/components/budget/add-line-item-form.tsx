"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createBudgetLineItem,
  updateBudgetLineItem,
  type LineItemUnits,
} from "@/lib/actions/budget-line-items";
import { toast } from "sonner";
import type { BudgetLineItem } from "@/lib/actions/budgets";

interface AddLineItemFormProps {
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editLineItem?: BudgetLineItem | null;
}

interface FormData {
  accountCode: string;
  description: string;
  units: LineItemUnits;
  quantity: string;
  rate: string;
  fringePercent: string;
  notes: string;
}

const initialFormData: FormData = {
  accountCode: "",
  description: "",
  units: "FLAT",
  quantity: "1",
  rate: "",
  fringePercent: "0",
  notes: "",
};

const unitsOptions = [
  { value: "FLAT", label: "Flat (Fixed Amount)" },
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "HOURS", label: "Hours" },
  { value: "EACH", label: "Each (Per Unit)" },
];

export function AddLineItemForm({
  categoryId,
  open,
  onOpenChange,
  onSuccess,
  editLineItem,
}: AddLineItemFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [amountInput, setAmountInput] = React.useState("");
  const lastEditedRef = React.useRef<"amount" | "fields" | null>(null);

  const isEditMode = !!editLineItem;

  // Reset form when dialog opens or editLineItem changes
  React.useEffect(() => {
    if (open) {
      lastEditedRef.current = null;
      if (editLineItem) {
        const estimatedTotal = editLineItem.estimatedTotal ?? 0;
        setFormData({
          accountCode: editLineItem.accountCode,
          description: editLineItem.description,
          units: editLineItem.units,
          quantity: editLineItem.quantity.toString(),
          rate: editLineItem.rate.toString(),
          fringePercent: editLineItem.fringePercent.toString(),
          notes: editLineItem.notes || "",
        });
        setAmountInput(estimatedTotal ? estimatedTotal.toString() : "");
      } else {
        setFormData(initialFormData);
        setAmountInput("");
      }
      setError(null);
    }
  }, [open, editLineItem]);

  // Calculate preview total
  const previewTotal = React.useMemo(() => {
    const quantity = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const fringePercent = parseFloat(formData.fringePercent) || 0;
    const subtotal = quantity * rate;
    const fringeAmount = subtotal * (fringePercent / 100);
    return subtotal + fringeAmount;
  }, [formData.quantity, formData.rate, formData.fringePercent]);

  React.useEffect(() => {
    if (lastEditedRef.current === "amount") return;
    if (!open) return;
    const total = Number.isFinite(previewTotal) ? previewTotal : 0;
    setAmountInput(total ? total.toString() : "");
  }, [previewTotal, open]);

  const handleAmountChange = (value: string) => {
    lastEditedRef.current = "amount";
    setAmountInput(value);
    const parsed = parseFloat(value);
    const amount = Number.isFinite(parsed) ? parsed : 0;
    setFormData((prev) => ({
      ...prev,
      units: "FLAT",
      quantity: "1",
      rate: amount.toString(),
      fringePercent: "0",
    }));
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    lastEditedRef.current = "fields";
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.accountCode.trim() || !formData.description.trim()) {
        throw new Error("Account code and description are required");
      }

      const quantity = parseFloat(formData.quantity);
      const rate = parseFloat(formData.rate);
      const fringePercent = parseFloat(formData.fringePercent) || 0;

      if (isNaN(quantity) || quantity < 0) {
        throw new Error("Please enter a valid quantity");
      }

      if (isNaN(rate) || rate < 0) {
        throw new Error("Please enter a valid rate");
      }

      if (isEditMode && editLineItem) {
        await updateBudgetLineItem(editLineItem.id, {
          accountCode: formData.accountCode,
          description: formData.description,
          units: formData.units,
          quantity,
          rate,
          fringePercent,
          notes: formData.notes || null,
        });
      } else {
        await createBudgetLineItem(categoryId, {
          accountCode: formData.accountCode,
          description: formData.description,
          units: formData.units,
          quantity,
          rate,
          fringePercent,
          notes: formData.notes || null,
        });
      }

      toast.success(isEditMode ? "Line item updated" : "Line item added");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save line item";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Line Item" : "Add Line Item"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the line item details"
              : "Add a new line item to this category"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Account Code and Description row */}
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <div>
                <label className="block text-sm font-medium mb-1.5">Account Code *</label>
                <Input
                  required
                  value={formData.accountCode}
                  onChange={(e) => handleFieldChange("accountCode", e.target.value)}
                  placeholder="2310"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description *</label>
                <Input
                  required
                  value={formData.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="e.g., Camera Operator"
                />
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Amount (total)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Quick entry. Sets units to Flat, quantity 1, fringe 0.
              </p>
            </div>

            {/* Units */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Units</label>
              <Select
                value={formData.units}
                onChange={(e) =>
                  handleFieldChange("units", e.target.value as LineItemUnits)
                }
                options={unitsOptions}
              />
            </div>

            {/* Quantity and Rate row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Quantity</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => handleFieldChange("quantity", e.target.value)}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={(e) => handleFieldChange("rate", e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
                </div>
              </div>
            </div>

            {/* Fringe % */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Fringe % <span className="text-muted-foreground">(optional)</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.fringePercent}
                  onChange={(e) => handleFieldChange("fringePercent", e.target.value)}
                  className="pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Additional percentage for benefits, taxes, etc.
              </p>
            </div>

            {/* Preview Total */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estimated Total</span>
                <span className="text-lg font-semibold">{formatCurrency(previewTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.quantity || "0"} × {formatCurrency(parseFloat(formData.rate) || 0)}
                {parseFloat(formData.fringePercent) > 0 && ` + ${formData.fringePercent}% fringe`}
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder="Any additional details..."
                rows={2}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditMode
                  ? "Saving..."
                  : "Adding..."
                : isEditMode
                  ? "Save Changes"
                  : "Add Line Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
