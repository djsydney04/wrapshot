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
import type { BudgetCategory } from "@/lib/actions/budgets";

interface AddCategoryFormProps {
  budgetId: string;
  categories: BudgetCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editCategory?: BudgetCategory | null;
}

interface FormData {
  code: string;
  name: string;
  parentCategoryId: string;
}

const initialFormData: FormData = {
  code: "",
  name: "",
  parentCategoryId: "",
};

export function AddCategoryForm({
  budgetId,
  categories,
  open,
  onOpenChange,
  onSuccess,
  editCategory,
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
        });
      } else {
        setFormData(initialFormData);
      }
      setError(null);
    }
  }, [open, editCategory]);

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
        });
      } else {
        await createBudgetCategory(budgetId, {
          code: formData.code,
          name: formData.name,
          parentCategoryId: formData.parentCategoryId || null,
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
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
