"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";

export type BudgetStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "LOCKED";

export interface Budget {
  id: string;
  projectId: string;
  versionName: string;
  version: number;
  status: BudgetStatus;
  totalEstimated: number;
  totalActual: number;
  totalCommitted: number;
  contingencyPercent: number;
  contingencyAmount: number;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetData {
  projectId: string;
  versionName: string;
  templateId?: string;
}

// Create a new budget
export async function createBudget(data: CreateBudgetData): Promise<Budget> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get the next version number for this project
  const { data: existingBudgets } = await supabase
    .from("Budget")
    .select("version")
    .eq("projectId", data.projectId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existingBudgets && existingBudgets.length > 0
    ? existingBudgets[0].version + 1
    : 1;

  // Create the budget
  const { data: budget, error } = await supabase
    .from("Budget")
    .insert({
      projectId: data.projectId,
      versionName: data.versionName,
      version: nextVersion,
      status: "DRAFT",
      totalEstimated: 0,
      totalActual: 0,
      totalCommitted: 0,
      contingencyPercent: 10,
      contingencyAmount: 0,
      createdBy: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating budget:", error);
    console.error("Budget insert data:", {
      projectId: data.projectId,
      versionName: data.versionName,
      userId,
    });
    throw new Error(`Failed to create budget: ${error.message}`);
  }

  // If a template was specified, copy its categories
  if (data.templateId) {
    const { data: template } = await supabase
      .from("BudgetTemplate")
      .select("templateData")
      .eq("id", data.templateId)
      .single();

    if (template?.templateData) {
      // Create categories from template
      const templateData = template.templateData as { categories?: Array<{ code: string; name: string }> };
      if (templateData.categories) {
        const categories = templateData.categories.map((cat, index) => ({
          budgetId: budget.id,
          code: cat.code,
          name: cat.name,
          sortOrder: index,
          subtotal: 0,
        }));

        await supabase.from("BudgetCategory").insert(categories);
      }
    }
  } else {
    // Create default categories for "Start from Scratch"
    const defaultCategories = [
      { code: "1000", name: "Above-the-Line", sortOrder: 0 },
      { code: "2000", name: "Production", sortOrder: 1 },
      { code: "3000", name: "Post-Production", sortOrder: 2 },
      { code: "4000", name: "Other", sortOrder: 3 },
    ];

    const categories = defaultCategories.map((cat) => ({
      budgetId: budget.id,
      ...cat,
      subtotal: 0,
    }));

    await supabase.from("BudgetCategory").insert(categories);
  }

  revalidatePath("/finance");
  revalidatePath(`/finance/${budget.id}`);

  return budget;
}

// Get all budgets for a project
export async function getBudgetsForProject(projectId: string): Promise<Budget[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("Budget")
    .select("*")
    .eq("projectId", projectId)
    .order("version", { ascending: false });

  if (error) {
    console.error("Error fetching budgets:", error);
    return [];
  }

  return data || [];
}

// Get budgets grouped by project for all user's projects
export async function getBudgetsByProject(): Promise<Record<string, Budget[]>> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get all projects the user has access to
  const { data: memberships } = await supabase
    .from("ProjectMember")
    .select("projectId")
    .eq("userId", userId);

  if (!memberships || memberships.length === 0) {
    return {};
  }

  const projectIds = memberships.map((m) => m.projectId);

  // Get all budgets for these projects
  const { data: budgets, error } = await supabase
    .from("Budget")
    .select("*")
    .in("projectId", projectIds)
    .order("version", { ascending: false });

  if (error) {
    console.error("Error fetching budgets:", error);
    return {};
  }

  // Group by project
  const grouped: Record<string, Budget[]> = {};
  for (const budget of budgets || []) {
    if (!grouped[budget.projectId]) {
      grouped[budget.projectId] = [];
    }
    grouped[budget.projectId].push(budget);
  }

  return grouped;
}

// Get a single budget by ID
export async function getBudget(budgetId: string): Promise<Budget | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("Budget")
    .select("*")
    .eq("id", budgetId)
    .single();

  if (error) {
    console.error("Error fetching budget:", error);
    return null;
  }

  return data;
}

// Update budget status
export async function updateBudgetStatus(
  budgetId: string,
  status: BudgetStatus
): Promise<Budget> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  };

  // If approving, set approval info
  if (status === "APPROVED") {
    updateData.approvedBy = userId;
    updateData.approvedAt = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("Budget")
    .update(updateData)
    .eq("id", budgetId)
    .select()
    .single();

  if (error) {
    console.error("Error updating budget status:", error);
    throw new Error("Failed to update budget status");
  }

  revalidatePath("/finance");
  revalidatePath(`/finance/${budgetId}`);

  return data;
}

// Delete a budget
export async function deleteBudget(budgetId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("Budget")
    .delete()
    .eq("id", budgetId);

  if (error) {
    console.error("Error deleting budget:", error);
    throw new Error("Failed to delete budget");
  }

  revalidatePath("/finance");
}

// Budget category interface
export interface BudgetCategory {
  id: string;
  budgetId: string;
  code: string;
  name: string;
  parentCategoryId: string | null;
  subtotalEstimated: number;
  subtotalActual: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Budget line item interface
export interface BudgetLineItem {
  id: string;
  categoryId: string;
  accountCode: string;
  description: string;
  units: "DAYS" | "WEEKS" | "FLAT" | "HOURS" | "EACH";
  quantity: number;
  rate: number;
  subtotal: number;
  fringePercent: number;
  fringeAmount: number;
  estimatedTotal: number;
  actualCost: number;
  committedCost: number;
  variance: number;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Get categories for a budget
export async function getBudgetCategories(budgetId: string): Promise<BudgetCategory[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("BudgetCategory")
    .select("*")
    .eq("budgetId", budgetId)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Error fetching budget categories:", error);
    return [];
  }

  return data || [];
}

// Get line items for a budget (via categories)
export async function getBudgetLineItems(budgetId: string): Promise<BudgetLineItem[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // First get all category IDs for this budget
  const { data: categories, error: catError } = await supabase
    .from("BudgetCategory")
    .select("id")
    .eq("budgetId", budgetId);

  if (catError || !categories || categories.length === 0) {
    return [];
  }

  const categoryIds = categories.map((c) => c.id);

  // Then get all line items for these categories
  const { data, error } = await supabase
    .from("BudgetLineItem")
    .select("*")
    .in("categoryId", categoryIds)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Error fetching budget line items:", error);
    return [];
  }

  return data || [];
}

// Get line items for a specific category
export async function getCategoryLineItems(categoryId: string): Promise<BudgetLineItem[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("BudgetLineItem")
    .select("*")
    .eq("categoryId", categoryId)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Error fetching category line items:", error);
    return [];
  }

  return data || [];
}
