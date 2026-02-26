"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createPurchaseOrder,
  type PurchaseOrderStatus,
} from "@/lib/actions/purchase-orders";
import { type BudgetCategory, type BudgetLineItem } from "@/lib/actions/budgets";

interface AddPurchaseOrderFormProps {
  budgetId: string;
  categories: BudgetCategory[];
  lineItems: BudgetLineItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PurchaseOrderLineForm {
  id: string;
  categoryId: string;
  lineItemId: string;
  description: string;
  quantity: string;
  unitCost: string;
  notes: string;
}

interface FormData {
  poNumber: string;
  vendor: string;
  title: string;
  description: string;
  issueDate: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  notes: string;
  lines: PurchaseOrderLineForm[];
}

function makeLineRow(): PurchaseOrderLineForm {
  return {
    id: `line-${Math.random().toString(36).slice(2, 9)}`,
    categoryId: "",
    lineItemId: "",
    description: "",
    quantity: "1",
    unitCost: "0",
    notes: "",
  };
}

function makeInitialFormData(): FormData {
  return {
    poNumber: "",
    vendor: "",
    title: "",
    description: "",
    issueDate: new Date().toISOString().split("T")[0],
    expectedDate: "",
    status: "DRAFT",
    notes: "",
    lines: [makeLineRow()],
  };
}

export function AddPurchaseOrderForm({
  budgetId,
  categories,
  lineItems,
  open,
  onOpenChange,
  onSuccess,
}: AddPurchaseOrderFormProps) {
  const [formData, setFormData] = React.useState<FormData>(makeInitialFormData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categoryOptions = React.useMemo(
    () => [
      { value: "", label: "No category" },
      ...categories.map((category) => ({
        value: category.id,
        label: `${category.code} - ${category.name}`,
      })),
    ],
    [categories],
  );

  const lineItemOptions = React.useMemo(
    () => [
      { value: "", label: "No line item" },
      ...lineItems.map((lineItem) => ({
        value: lineItem.id,
        label: `${lineItem.accountCode} - ${lineItem.description}`,
      })),
    ],
    [lineItems],
  );

  const lineItemsById = React.useMemo(
    () => new Map(lineItems.map((lineItem) => [lineItem.id, lineItem])),
    [lineItems],
  );

  React.useEffect(() => {
    if (!open) return;
    setFormData(makeInitialFormData());
    setLoading(false);
    setError(null);
  }, [open]);

  const updateLine = (
    lineId: string,
    updater: (line: PurchaseOrderLineForm) => PurchaseOrderLineForm,
  ) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.id === lineId ? updater(line) : line)),
    }));
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, makeLineRow()],
    }));
  };

  const removeLine = (lineId: string) => {
    setFormData((prev) => {
      if (prev.lines.length === 1) {
        return prev;
      }

      return {
        ...prev,
        lines: prev.lines.filter((line) => line.id !== lineId),
      };
    });
  };

  const getLineItemOptionsForRow = (row: PurchaseOrderLineForm) => {
    if (!row.categoryId) return lineItemOptions;

    return [
      lineItemOptions[0],
      ...lineItems
        .filter((lineItem) => lineItem.categoryId === row.categoryId)
        .map((lineItem) => ({
          value: lineItem.id,
          label: `${lineItem.accountCode} - ${lineItem.description}`,
        })),
    ];
  };

  const grandTotal = React.useMemo(
    () =>
      formData.lines.reduce((sum, line) => {
        const quantity = Number.parseFloat(line.quantity) || 0;
        const unitCost = Number.parseFloat(line.unitCost) || 0;
        return sum + quantity * unitCost;
      }, 0),
    [formData.lines],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const vendor = formData.vendor.trim();
      const title = formData.title.trim();

      if (!vendor) {
        throw new Error("Vendor is required");
      }

      if (!title) {
        throw new Error("Title is required");
      }

      const lines = formData.lines.map((line) => {
        const quantity = Number.parseFloat(line.quantity);
        const unitCost = Number.parseFloat(line.unitCost);

        if (!line.description.trim()) {
          throw new Error("Each line must have a description");
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Line quantity must be greater than 0");
        }

        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error("Line unit cost must be 0 or greater");
        }

        return {
          categoryId: line.categoryId || null,
          lineItemId: line.lineItemId || null,
          description: line.description.trim(),
          quantity,
          unitCost,
          notes: line.notes.trim() || null,
        };
      });

      await createPurchaseOrder({
        budgetId,
        poNumber: formData.poNumber.trim() || undefined,
        vendor,
        title,
        description: formData.description.trim() || null,
        issueDate: formData.issueDate,
        expectedDate: formData.expectedDate || null,
        status: formData.status,
        notes: formData.notes.trim() || null,
        lines,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create PO");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Commit planned spend while keeping existing budget and expense workflows intact.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">PO Number</label>
                <Input
                  value={formData.poNumber}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, poNumber: event.target.value }))
                  }
                  placeholder="Auto-generate"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <Select
                  value={formData.status}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: event.target.value as PurchaseOrderStatus,
                    }))
                  }
                  options={[
                    { value: "DRAFT", label: "Draft" },
                    { value: "APPROVED", label: "Approved" },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Vendor *</label>
                <Input
                  required
                  value={formData.vendor}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, vendor: event.target.value }))
                  }
                  placeholder="Acme Rentals"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Title *</label>
                <Input
                  required
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Camera package hold"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Issue Date *</label>
                <Input
                  type="date"
                  required
                  value={formData.issueDate}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, issueDate: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Expected Date</label>
                <Input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, expectedDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={2}
                placeholder="Optional PO summary"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">PO Lines</p>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Line
                </Button>
              </div>

              {formData.lines.map((line, index) => {
                const quantity = Number.parseFloat(line.quantity) || 0;
                const unitCost = Number.parseFloat(line.unitCost) || 0;
                const lineTotal = quantity * unitCost;
                const filteredLineItems = getLineItemOptionsForRow(line);

                return (
                  <div key={line.id} className="rounded-md border border-border/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Line {index + 1}</p>
                      {formData.lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium">Category</label>
                        <Select
                          value={line.categoryId}
                          onChange={(event) => {
                            const categoryId = event.target.value;
                            updateLine(line.id, (current) => {
                              const selectedLineItem = lineItemsById.get(current.lineItemId);
                              const keepLineItem =
                                categoryId === "" ||
                                !selectedLineItem ||
                                selectedLineItem.categoryId === categoryId;

                              return {
                                ...current,
                                categoryId,
                                lineItemId: keepLineItem ? current.lineItemId : "",
                              };
                            });
                          }}
                          options={categoryOptions}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium">Line Item</label>
                        <Select
                          value={line.lineItemId}
                          onChange={(event) => {
                            const nextLineItemId = event.target.value;
                            const selectedLineItem = lineItemsById.get(nextLineItemId);

                            updateLine(line.id, (current) => ({
                              ...current,
                              lineItemId: nextLineItemId,
                              categoryId:
                                current.categoryId || selectedLineItem?.categoryId || "",
                              description:
                                current.description || selectedLineItem?.description || "",
                              unitCost:
                                current.unitCost === "0" || current.unitCost === ""
                                  ? String(selectedLineItem?.rate ?? 0)
                                  : current.unitCost,
                            }));
                          }}
                          options={filteredLineItems}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium">Description *</label>
                      <Input
                        required
                        value={line.description}
                        onChange={(event) =>
                          updateLine(line.id, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Item description"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium">Qty *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.id, (current) => ({
                              ...current,
                              quantity: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Unit Cost *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.unitCost}
                          onChange={(event) =>
                            updateLine(line.id, (current) => ({
                              ...current,
                              unitCost: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Line Total</label>
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-medium">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium">Line Notes</label>
                      <Input
                        value={line.notes}
                        onChange={(event) =>
                          updateLine(line.id, (current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Committed total</span>
                <span className="font-semibold">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Internal Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={2}
                placeholder="Optional"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
