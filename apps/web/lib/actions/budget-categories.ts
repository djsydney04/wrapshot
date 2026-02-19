"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";
import type { BudgetCategory } from "./budgets";
import type { DepartmentBudgetStatus } from "@/lib/types";

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

function isMissingFinancialHeadColumnError(
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;

  const message =
    `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return message.includes("financialheaduserid");
}

// Create a new budget category
export async function createBudgetCategory(
  budgetId: string,
  data: CreateBudgetCategoryInput,
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
  data: UpdateBudgetCategoryInput,
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
  if (data.parentCategoryId !== undefined)
    updateData.parentCategoryId = data.parentCategoryId;
  if (data.allocatedBudget !== undefined)
    updateData.allocatedBudget = data.allocatedBudget;

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
  orderedIds: string[],
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
      .eq("budgetId", budgetId),
  );

  await Promise.all(updates);

  revalidatePath(`/finance/${budgetId}`);
}

// ── Department workflow actions ──────────────────────────────────────

async function getTopLevelCategoryWithBudget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
) {
  const { data: category, error } = await supabase
    .from("BudgetCategory")
    .select("*, Budget:budgetId(id, projectId, status)")
    .eq("id", categoryId)
    .is("parentCategoryId", null)
    .single();

  if (error || !category) {
    throw new Error("Top-level department category not found");
  }

  const budget = (category as Record<string, unknown>).Budget as {
    id: string;
    projectId: string;
    status: string;
  } | null;

  if (!budget) {
    throw new Error("Budget not found");
  }

  if (budget.status === "LOCKED") {
    throw new Error("Cannot modify a locked budget");
  }

  return { category: category as BudgetCategory, budget };
}

async function checkFinanceManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const [{ data: membership }, { data: project, error: projectError }] =
    await Promise.all([
      supabase
        .from("ProjectMember")
        .select("role")
        .eq("projectId", projectId)
        .eq("userId", userId)
        .single(),
      supabase
        .from("Project")
        .select("financialHeadUserId")
        .eq("id", projectId)
        .maybeSingle(),
    ]);

  if (!membership) return false;

  let financialHeadUserId: string | null = null;
  if (isMissingFinancialHeadColumnError(projectError)) {
    const { data: existingProject } = await supabase
      .from("Project")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!existingProject) return false;
  } else if (projectError || !project) {
    return false;
  } else {
    financialHeadUserId = project.financialHeadUserId ?? null;
  }

  const role = membership.role as string;
  return (
    role === "ADMIN" || role === "COORDINATOR" || financialHeadUserId === userId
  );
}

// Assign a project member as department head for a top-level category
export async function assignDepartmentHead(
  categoryId: string,
  userId: string | null,
): Promise<BudgetCategory> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  const { category, budget } = await getTopLevelCategoryWithBudget(
    supabase,
    categoryId,
  );

  const isManager = await checkFinanceManager(
    supabase,
    budget.projectId,
    currentUserId,
  );
  if (!isManager) {
    throw new Error("Only finance managers can assign department heads");
  }

  if (userId) {
    const { data: membership } = await supabase
      .from("ProjectMember")
      .select("id")
      .eq("projectId", budget.projectId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      throw new Error("User must be a member of the project");
    }
  }

  const updateData: Record<string, unknown> = {
    assignedUserId: userId,
    updatedAt: new Date().toISOString(),
  };

  // Auto-advance from NOT_STARTED when assigning a head
  if (userId && category.departmentStatus === "NOT_STARTED") {
    updateData.departmentStatus = "IN_PROGRESS";
  }

  // Reset status if unassigning
  if (!userId && category.departmentStatus !== "APPROVED") {
    updateData.departmentStatus = "NOT_STARTED";
  }

  const { data: updated, error } = await supabase
    .from("BudgetCategory")
    .update(updateData)
    .eq("id", categoryId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error("Failed to assign department head");
  }

  revalidatePath(`/finance/${budget.id}`);
  return updated as BudgetCategory;
}

// Department head (or finance manager) submits a department budget for review
export async function submitDepartmentBudget(
  categoryId: string,
): Promise<BudgetCategory> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  const { category, budget } = await getTopLevelCategoryWithBudget(
    supabase,
    categoryId,
  );

  const isManager = await checkFinanceManager(
    supabase,
    budget.projectId,
    currentUserId,
  );
  const isAssigned = category.assignedUserId === currentUserId;

  if (!isManager && !isAssigned) {
    throw new Error(
      "Only the assigned department head or finance managers can submit",
    );
  }

  const submittableStatuses: DepartmentBudgetStatus[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "REVISION_REQUESTED",
  ];
  if (!submittableStatuses.includes(category.departmentStatus)) {
    throw new Error(
      `Cannot submit a department with status "${category.departmentStatus}"`,
    );
  }

  const { data: updated, error } = await supabase
    .from("BudgetCategory")
    .update({
      departmentStatus: "SUBMITTED",
      submittedAt: new Date().toISOString(),
      submittedBy: currentUserId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", categoryId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error("Failed to submit department budget");
  }

  revalidatePath(`/finance/${budget.id}`);
  return updated as BudgetCategory;
}

// Finance manager reviews a submitted department budget
export async function reviewDepartmentBudget(
  categoryId: string,
  action: "APPROVE" | "REQUEST_REVISION",
  reviewNotes?: string,
): Promise<BudgetCategory> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  const { category, budget } = await getTopLevelCategoryWithBudget(
    supabase,
    categoryId,
  );

  const isManager = await checkFinanceManager(
    supabase,
    budget.projectId,
    currentUserId,
  );
  if (!isManager) {
    throw new Error("Only finance managers can review department budgets");
  }

  if (category.departmentStatus !== "SUBMITTED") {
    throw new Error("Only submitted departments can be reviewed");
  }

  const newStatus: DepartmentBudgetStatus =
    action === "APPROVE" ? "APPROVED" : "REVISION_REQUESTED";

  const { data: updated, error } = await supabase
    .from("BudgetCategory")
    .update({
      departmentStatus: newStatus,
      reviewedBy: currentUserId,
      reviewedAt: new Date().toISOString(),
      reviewNotes:
        action === "REQUEST_REVISION" ? reviewNotes?.trim() || null : null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", categoryId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error("Failed to review department budget");
  }

  revalidatePath(`/finance/${budget.id}`);
  return updated as BudgetCategory;
}

// Finance manager reopens an approved department for further edits
export async function reopenDepartmentBudget(
  categoryId: string,
): Promise<BudgetCategory> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  const { category, budget } = await getTopLevelCategoryWithBudget(
    supabase,
    categoryId,
  );

  const isManager = await checkFinanceManager(
    supabase,
    budget.projectId,
    currentUserId,
  );
  if (!isManager) {
    throw new Error("Only finance managers can reopen department budgets");
  }

  if (category.departmentStatus !== "APPROVED") {
    throw new Error("Only approved departments can be reopened");
  }

  const { data: updated, error } = await supabase
    .from("BudgetCategory")
    .update({
      departmentStatus: "IN_PROGRESS",
      reviewNotes: null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", categoryId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error("Failed to reopen department budget");
  }

  revalidatePath(`/finance/${budget.id}`);
  return updated as BudgetCategory;
}
