"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";
import type { BudgetLineItem } from "./budgets";

export type LineItemUnits = "DAYS" | "WEEKS" | "FLAT" | "HOURS" | "EACH";

export interface CreateBudgetLineItemInput {
  accountCode: string;
  description: string;
  units: LineItemUnits;
  quantity: number;
  rate: number;
  fringePercent?: number;
  notes?: string | null;
  sortOrder?: number;
}

export interface UpdateBudgetLineItemInput {
  accountCode?: string;
  description?: string;
  units?: LineItemUnits;
  quantity?: number;
  rate?: number;
  fringePercent?: number;
  notes?: string | null;
}

// Helper to calculate line item totals
function calculateLineItemTotals(
  quantity: number,
  rate: number,
  fringePercent: number
): { subtotal: number; fringeAmount: number; estimatedTotal: number } {
  const subtotal = quantity * rate;
  const fringeAmount = subtotal * (fringePercent / 100);
  const estimatedTotal = subtotal + fringeAmount;
  return { subtotal, fringeAmount, estimatedTotal };
}

// Helper to get budget ID from category and check editability
// Also checks department-level status for department heads
async function getBudgetIdAndCheckEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string
): Promise<string> {
  const { data: category, error: catError } = await supabase
    .from("BudgetCategory")
    .select("budgetId, parentCategoryId, departmentStatus, assignedUserId")
    .eq("id", categoryId)
    .single();

  if (catError || !category) {
    throw new Error("Category not found");
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("status, projectId")
    .eq("id", category.budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  if (budget.status === "LOCKED") {
    throw new Error("Cannot modify a locked budget");
  }

  // Find the top-level department category to check department status
  let departmentCategory = category;
  if (category.parentCategoryId) {
    const { data: parent } = await supabase
      .from("BudgetCategory")
      .select("budgetId, parentCategoryId, departmentStatus, assignedUserId")
      .eq("id", category.parentCategoryId)
      .single();

    if (parent) {
      departmentCategory = parent;
    }
  }

  // If department is submitted or approved, only finance managers can edit
  if (
    departmentCategory.departmentStatus === "SUBMITTED" ||
    departmentCategory.departmentStatus === "APPROVED"
  ) {
    // Allow budget-level APPROVED check to still block (existing behavior)
    if (budget.status === "APPROVED") {
      throw new Error("Cannot modify an approved budget");
    }
    // For submitted/approved departments, the RLS policy will enforce
    // that only finance managers can write — so we let it through here
    // and rely on RLS for the final check.
  }

  return category.budgetId;
}

// Helper to recalculate category subtotals
async function recalculateCategorySubtotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string
): Promise<void> {
  const { data: lineItems } = await supabase
    .from("BudgetLineItem")
    .select("estimatedTotal, actualCost")
    .eq("categoryId", categoryId);

  const subtotalEstimated = lineItems?.reduce((sum, li) => sum + (li.estimatedTotal || 0), 0) || 0;
  const subtotalActual = lineItems?.reduce((sum, li) => sum + (li.actualCost || 0), 0) || 0;

  await supabase
    .from("BudgetCategory")
    .update({
      subtotalEstimated,
      subtotalActual,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", categoryId);
}

// Helper to recalculate budget totals
async function recalculateBudgetTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  budgetId: string
): Promise<void> {
  const { data: categories } = await supabase
    .from("BudgetCategory")
    .select("subtotalEstimated, subtotalActual")
    .eq("budgetId", budgetId);

  const totalEstimated = categories?.reduce((sum, cat) => sum + (cat.subtotalEstimated || 0), 0) || 0;
  const totalActual = categories?.reduce((sum, cat) => sum + (cat.subtotalActual || 0), 0) || 0;

  await supabase
    .from("Budget")
    .update({
      totalEstimated,
      totalActual,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", budgetId);
}

// Create a new budget line item
export async function createBudgetLineItem(
  categoryId: string,
  data: CreateBudgetLineItemInput
): Promise<BudgetLineItem> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const budgetId = await getBudgetIdAndCheckEditable(supabase, categoryId);

  // Get the next sortOrder if not provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxOrder } = await supabase
      .from("BudgetLineItem")
      .select("sortOrder")
      .eq("categoryId", categoryId)
      .order("sortOrder", { ascending: false })
      .limit(1)
      .single();

    sortOrder = (maxOrder?.sortOrder ?? -1) + 1;
  }

  const fringePercent = data.fringePercent ?? 0;
  const { subtotal, fringeAmount, estimatedTotal } = calculateLineItemTotals(
    data.quantity,
    data.rate,
    fringePercent
  );

  const { data: lineItem, error } = await supabase
    .from("BudgetLineItem")
    .insert({
      categoryId,
      accountCode: data.accountCode,
      description: data.description,
      units: data.units,
      quantity: data.quantity,
      rate: data.rate,
      subtotal,
      fringePercent,
      fringeAmount,
      estimatedTotal,
      actualCost: 0,
      committedCost: 0,
      variance: estimatedTotal,
      notes: data.notes || null,
      sortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating budget line item:", error);
    throw new Error(`Failed to create line item: ${error.message}`);
  }

  // Recalculate category subtotals
  await recalculateCategorySubtotals(supabase, categoryId);
  await recalculateBudgetTotals(supabase, budgetId);

  revalidatePath(`/finance/${budgetId}`);
  return lineItem;
}

// Update a budget line item
export async function updateBudgetLineItem(
  lineItemId: string,
  data: UpdateBudgetLineItemInput
): Promise<BudgetLineItem> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get existing line item
  const { data: existingItem, error: itemError } = await supabase
    .from("BudgetLineItem")
    .select("*")
    .eq("id", lineItemId)
    .single();

  if (itemError || !existingItem) {
    throw new Error("Line item not found");
  }

  const budgetId = await getBudgetIdAndCheckEditable(supabase, existingItem.categoryId);

  // Merge updates
  const quantity = data.quantity ?? existingItem.quantity;
  const rate = data.rate ?? existingItem.rate;
  const fringePercent = data.fringePercent ?? existingItem.fringePercent;

  const { subtotal, fringeAmount, estimatedTotal } = calculateLineItemTotals(
    quantity,
    rate,
    fringePercent
  );

  const updateData: Record<string, unknown> = {
    quantity,
    rate,
    subtotal,
    fringePercent,
    fringeAmount,
    estimatedTotal,
    variance: estimatedTotal - (existingItem.actualCost || 0),
    updatedAt: new Date().toISOString(),
  };

  if (data.accountCode !== undefined) updateData.accountCode = data.accountCode;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.units !== undefined) updateData.units = data.units;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { data: lineItem, error } = await supabase
    .from("BudgetLineItem")
    .update(updateData)
    .eq("id", lineItemId)
    .select()
    .single();

  if (error) {
    console.error("Error updating budget line item:", error);
    throw new Error(`Failed to update line item: ${error.message}`);
  }

  // Recalculate category subtotals
  await recalculateCategorySubtotals(supabase, existingItem.categoryId);
  await recalculateBudgetTotals(supabase, budgetId);

  revalidatePath(`/finance/${budgetId}`);
  return lineItem;
}

// Delete a budget line item
export async function deleteBudgetLineItem(lineItemId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get existing line item
  const { data: existingItem, error: itemError } = await supabase
    .from("BudgetLineItem")
    .select("categoryId")
    .eq("id", lineItemId)
    .single();

  if (itemError || !existingItem) {
    throw new Error("Line item not found");
  }

  const budgetId = await getBudgetIdAndCheckEditable(supabase, existingItem.categoryId);

  const { error } = await supabase
    .from("BudgetLineItem")
    .delete()
    .eq("id", lineItemId);

  if (error) {
    console.error("Error deleting budget line item:", error);
    throw new Error(`Failed to delete line item: ${error.message}`);
  }

  // Recalculate category subtotals
  await recalculateCategorySubtotals(supabase, existingItem.categoryId);
  await recalculateBudgetTotals(supabase, budgetId);

  revalidatePath(`/finance/${budgetId}`);
}

// Reorder line items within a category
export async function reorderLineItems(
  categoryId: string,
  orderedIds: string[]
): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const budgetId = await getBudgetIdAndCheckEditable(supabase, categoryId);

  // Update sort order for each line item
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("BudgetLineItem")
      .update({ sortOrder: index, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("categoryId", categoryId)
  );

  await Promise.all(updates);

  revalidatePath(`/finance/${budgetId}`);
}

// Move a line item to a different category
export async function moveLineItemToCategory(
  lineItemId: string,
  newCategoryId: string,
  newSortOrder: number
): Promise<BudgetLineItem> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get existing line item
  const { data: existingItem, error: itemError } = await supabase
    .from("BudgetLineItem")
    .select("categoryId")
    .eq("id", lineItemId)
    .single();

  if (itemError || !existingItem) {
    throw new Error("Line item not found");
  }

  const oldCategoryId = existingItem.categoryId;

  // Verify both categories are in the same budget and budget is editable
  const { data: oldCategory } = await supabase
    .from("BudgetCategory")
    .select("budgetId")
    .eq("id", oldCategoryId)
    .single();

  const { data: newCategory } = await supabase
    .from("BudgetCategory")
    .select("budgetId")
    .eq("id", newCategoryId)
    .single();

  if (!oldCategory || !newCategory || oldCategory.budgetId !== newCategory.budgetId) {
    throw new Error("Cannot move line item between different budgets");
  }

  const budgetId = await getBudgetIdAndCheckEditable(supabase, newCategoryId);

  // Update the line item
  const { data: lineItem, error } = await supabase
    .from("BudgetLineItem")
    .update({
      categoryId: newCategoryId,
      sortOrder: newSortOrder,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lineItemId)
    .select()
    .single();

  if (error) {
    console.error("Error moving budget line item:", error);
    throw new Error(`Failed to move line item: ${error.message}`);
  }

  // Recalculate both category subtotals
  await recalculateCategorySubtotals(supabase, oldCategoryId);
  await recalculateCategorySubtotals(supabase, newCategoryId);
  await recalculateBudgetTotals(supabase, budgetId);

  revalidatePath(`/finance/${budgetId}`);
  return lineItem;
}
