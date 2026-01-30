"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ReceiptUpload, type ParsedReceiptData } from "@/components/ui/receipt-upload";
import { Sparkles } from "lucide-react";
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
  createTransaction,
  updateTransaction,
  type Transaction,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "@/lib/actions/transactions";
import { type BudgetCategory, type BudgetLineItem } from "@/lib/actions/budgets";

interface AddTransactionFormProps {
  budgetId: string;
  categories: BudgetCategory[];
  lineItems: BudgetLineItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editTransaction?: Transaction | null;
}

interface FormData {
  date: string;
  vendor: string;
  amount: string;
  description: string;
  category: string;
  lineItemId: string;
  notes: string;
  receiptUrl: string | null;
}

const initialFormData: FormData = {
  date: new Date().toISOString().split("T")[0],
  vendor: "",
  amount: "",
  description: "",
  category: "",
  lineItemId: "",
  notes: "",
  receiptUrl: null,
};

export function AddTransactionForm({
  budgetId,
  categories,
  lineItems,
  open,
  onOpenChange,
  onSuccess,
  editTransaction,
}: AddTransactionFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [autoFilled, setAutoFilled] = React.useState(false);

  const isEditMode = !!editTransaction;

  // Reset form when dialog opens or editTransaction changes
  React.useEffect(() => {
    if (open) {
      if (editTransaction) {
        setFormData({
          date: editTransaction.date,
          vendor: editTransaction.vendor,
          amount: editTransaction.amount.toString(),
          description: editTransaction.description,
          category: editTransaction.category,
          lineItemId: editTransaction.lineItemId || "",
          notes: editTransaction.notes || "",
          receiptUrl: editTransaction.receiptUrl,
        });
      } else {
        setFormData(initialFormData);
      }
      setError(null);
      setAutoFilled(false);
    }
  }, [open, editTransaction]);

  // Filter line items by selected category
  const filteredLineItems = React.useMemo(() => {
    if (!formData.category) return [];

    // Find the category by name to get its ID
    const selectedCategory = categories.find((c) => c.name === formData.category);
    if (!selectedCategory) return [];

    return lineItems.filter((li) => li.categoryId === selectedCategory.id);
  }, [formData.category, categories, lineItems]);

  // Category options for dropdown
  const categoryOptions = React.useMemo(() => {
    return categories.map((c) => ({
      value: c.name,
      label: `${c.code} - ${c.name}`,
    }));
  }, [categories]);

  // Line item options for dropdown
  const lineItemOptions = React.useMemo(() => {
    return [
      { value: "", label: "None (Uncategorized)" },
      ...filteredLineItems.map((li) => ({
        value: li.id,
        label: `${li.accountCode} - ${li.description}`,
      })),
    ];
  }, [filteredLineItems]);

  const handleParsedData = React.useCallback((data: ParsedReceiptData) => {
    setFormData((prev) => {
      const updates: Partial<FormData> = {};

      if (data.vendor) updates.vendor = data.vendor;
      if (data.amount !== null) updates.amount = data.amount.toString();
      if (data.date) updates.date = data.date;
      if (data.description) updates.description = data.description;

      // Only update if we have some data
      if (Object.keys(updates).length > 0) {
        setAutoFilled(true);
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.date || !formData.vendor || !formData.amount || !formData.description || !formData.category) {
        throw new Error("Please fill in all required fields");
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      if (isEditMode && editTransaction) {
        // Update existing transaction
        const updates: UpdateTransactionInput = {
          date: formData.date,
          vendor: formData.vendor,
          amount,
          description: formData.description,
          category: formData.category,
          lineItemId: formData.lineItemId || null,
          notes: formData.notes || null,
          receiptUrl: formData.receiptUrl,
        };

        await updateTransaction(editTransaction.id, updates);
      } else {
        // Create new transaction
        const input: CreateTransactionInput = {
          budgetId,
          date: formData.date,
          vendor: formData.vendor,
          amount,
          description: formData.description,
          category: formData.category,
          lineItemId: formData.lineItemId || null,
          notes: formData.notes || null,
          receiptUrl: formData.receiptUrl,
        };

        await createTransaction(input);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the expense details"
              : "Record a new expense with optional receipt upload"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Receipt Upload */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Receipt</label>
              <ReceiptUpload
                value={formData.receiptUrl}
                onChange={(url) => setFormData({ ...formData, receiptUrl: url })}
                onParsedData={handleParsedData}
                budgetId={budgetId}
                transactionId={editTransaction?.id}
                autoParseOnUpload={true}
              />
            </div>

            {autoFilled && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Form auto-filled from receipt</span>
              </div>
            )}

            {/* Date and Amount row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Date *</label>
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Vendor *</label>
              <Input
                required
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g., Home Depot, Amazon, Acme Rentals"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Description *</label>
              <Input
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Construction materials for set"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Category *</label>
              <Select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value,
                    lineItemId: "", // Reset line item when category changes
                  })
                }
                options={[
                  { value: "", label: "Select a category" },
                  ...categoryOptions,
                ]}
              />
            </div>

            {/* Line Item (optional, filtered by category) */}
            {formData.category && filteredLineItems.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Line Item <span className="text-muted-foreground">(optional)</span>
                </label>
                <Select
                  value={formData.lineItemId}
                  onChange={(e) =>
                    setFormData({ ...formData, lineItemId: e.target.value })
                  }
                  options={lineItemOptions}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Link to a specific budget line item for tracking
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
