"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  createBudgetCategory,
  updateBudgetCategory,
} from "@/lib/actions/budget-categories";
import { toast } from "sonner";
import type { BudgetCategory } from "@/lib/actions/budgets";

interface AddCategoryFormProps {
  budgetId: string;
  categories: BudgetCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editCategory?: BudgetCategory | null;
  defaultParentCategoryId?: string | null;
}

interface FormData {
  code: string;
  name: string;
  parentCategoryId: string;
  allocatedBudget: string;
}

const initialFormData: FormData = {
  code: "",
  name: "",
  parentCategoryId: "",
  allocatedBudget: "",
};

export function AddCategoryForm({
  budgetId,
  categories,
  open,
  onOpenChange,
  onSuccess,
  editCategory,
  defaultParentCategoryId,
}: AddCategoryFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);

  const isEditMode = !!editCategory;

  // Reset form when dialog opens or editCategory changes
  React.useEffect(() => {
    if (open) {
      if (editCategory) {
        setFormData({
          code: editCategory.code,
          name: editCategory.name,
          parentCategoryId: editCategory.parentCategoryId || "",
          allocatedBudget: editCategory.allocatedBudget?.toString() ?? "",
        });
      } else {
        setFormData({
          ...initialFormData,
          parentCategoryId: defaultParentCategoryId || "",
        });
      }
      setError(null);
    }
  }, [open, editCategory, defaultParentCategoryId]);

  // Filter out current category and its children for parent options
  const parentOptions = React.useMemo(() => {
    const filtered = categories.filter((c) => {
      // Can't be parent of itself
      if (editCategory && c.id === editCategory.id) return false;
      // Can't select a child as parent (would create cycle)
      if (editCategory && c.parentCategoryId === editCategory.id) return false;
      return true;
    });

    return [
      { value: "", label: "None (Top-level category)" },
      ...filtered.map((c) => ({
        value: c.id,
        label: `${c.code} - ${c.name}`,
      })),
    ];
  }, [categories, editCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.code.trim() || !formData.name.trim()) {
        throw new Error("Code and name are required");
      }

      if (isEditMode && editCategory) {
        await updateBudgetCategory(editCategory.id, {
          code: formData.code,
          name: formData.name,
          parentCategoryId: formData.parentCategoryId || null,
          allocatedBudget: formData.allocatedBudget
            ? parseFloat(formData.allocatedBudget) || 0
            : 0,
        });
      } else {
        await createBudgetCategory(budgetId, {
          code: formData.code,
          name: formData.name,
          parentCategoryId: formData.parentCategoryId || null,
          allocatedBudget: formData.allocatedBudget
            ? parseFloat(formData.allocatedBudget) || 0
            : 0,
        });
      }

      toast.success(isEditMode ? "Category updated" : "Category created");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save category";
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
          <DialogTitle>{isEditMode ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the category details"
              : "Create a new budget category"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Code *</label>
              <Input
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., 2300"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A unique code for this category (e.g., department number)
              </p>
            </div>

            {/* Allocated Budget */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Allocated Budget <span className="text-muted-foreground">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.allocatedBudget}
                  onChange={(e) => setFormData({ ...formData, allocatedBudget: e.target.value })}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Set a cap for this department to track variance
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Camera"
              />
            </div>

            {/* Parent Category */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Parent Category <span className="text-muted-foreground">(optional)</span>
              </label>
              <Select
                value={formData.parentCategoryId}
                onChange={(e) =>
                  setFormData({ ...formData, parentCategoryId: e.target.value })
                }
                options={parentOptions}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Nest this category under another for hierarchical budgets
              </p>
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
                  : "Creating..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
