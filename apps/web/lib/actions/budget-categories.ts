"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";
import type { BudgetCategory } from "./budgets";

export interface CreateBudgetCategoryInput {
  code: string;
  name: string;
  parentCategoryId?: string | null;
  allocatedBudget?: number;
  sortOrder?: number;
}

export interface UpdateBudgetCategoryInput {
  code?: string;
  name?: string;
  parentCategoryId?: string | null;
  allocatedBudget?: number;
}

// Create a new budget category
export async function createBudgetCategory(
  budgetId: string,
  data: CreateBudgetCategoryInput
): Promise<BudgetCategory> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Verify budget exists and user has access
  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("id, status")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  // Check budget is editable
  if (budget.status === "LOCKED" || budget.status === "APPROVED") {
    throw new Error("Cannot modify a locked or approved budget");
  }

  // Get the next sortOrder if not provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxOrder } = await supabase
      .from("BudgetCategory")
      .select("sortOrder")
      .eq("budgetId", budgetId)
      .order("sortOrder", { ascending: false })
      .limit(1)
      .single();

    sortOrder = (maxOrder?.sortOrder ?? -1) + 1;
  }

  const { data: category, error } = await supabase
    .from("BudgetCategory")
    .insert({
      budgetId,
      code: data.code,
      name: data.name,
      parentCategoryId: data.parentCategoryId || null,
      allocatedBudget: data.allocatedBudget ?? 0,
      sortOrder,
      subtotalEstimated: 0,
      subtotalActual: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating budget category:", error);
    throw new Error(`Failed to create category: ${error.message}`);
  }

  revalidatePath(`/finance/${budgetId}`);
  return category;
}

// Update a budget category
export async function updateBudgetCategory(
  categoryId: string,
  data: UpdateBudgetCategoryInput
): Promise<BudgetCategory> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get the category and its budget
  const { data: existingCategory, error: catError } = await supabase
    .from("BudgetCategory")
    .select("budgetId")
    .eq("id", categoryId)
    .single();

  if (catError || !existingCategory) {
    throw new Error("Category not found");
  }

  // Verify budget is editable
  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("status")
    .eq("id", existingCategory.budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  if (budget.status === "LOCKED" || budget.status === "APPROVED") {
    throw new Error("Cannot modify a locked or approved budget");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.code !== undefined) updateData.code = data.code;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentCategoryId !== undefined) updateData.parentCategoryId = data.parentCategoryId;
  if (data.allocatedBudget !== undefined) updateData.allocatedBudget = data.allocatedBudget;

  const { data: category, error } = await supabase
    .from("BudgetCategory")
    .update(updateData)
    .eq("id", categoryId)
    .select()
    .single();

  if (error) {
    console.error("Error updating budget category:", error);
    throw new Error(`Failed to update category: ${error.message}`);
  }

  revalidatePath(`/finance/${existingCategory.budgetId}`);
  return category;
}

// Delete a budget category
export async function deleteBudgetCategory(categoryId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get the category and its budget
  const { data: existingCategory, error: catError } = await supabase
    .from("BudgetCategory")
    .select("budgetId")
    .eq("id", categoryId)
    .single();

  if (catError || !existingCategory) {
    throw new Error("Category not found");
  }

  // Verify budget is editable
  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("status")
    .eq("id", existingCategory.budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  if (budget.status === "LOCKED" || budget.status === "APPROVED") {
    throw new Error("Cannot modify a locked or approved budget");
  }

  // Delete the category (cascade will handle line items)
  const { error } = await supabase
    .from("BudgetCategory")
    .delete()
    .eq("id", categoryId);

  if (error) {
    console.error("Error deleting budget category:", error);
    throw new Error(`Failed to delete category: ${error.message}`);
  }

  revalidatePath(`/finance/${existingCategory.budgetId}`);
}

// Reorder budget categories
export async function reorderBudgetCategories(
  budgetId: string,
  orderedIds: string[]
): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Verify budget exists and is editable
  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("status")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  if (budget.status === "LOCKED" || budget.status === "APPROVED") {
    throw new Error("Cannot modify a locked or approved budget");
  }

  // Update sort order for each category
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("BudgetCategory")
      .update({ sortOrder: index, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("budgetId", budgetId)
  );

  await Promise.all(updates);

  revalidatePath(`/finance/${budgetId}`);
}
