"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";
import { BUDGET_CHART_OF_ACCOUNTS } from "@/lib/types";

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

  // If a template was specified, copy its categories and line items
  if (data.templateId) {
    const { data: template } = await supabase
      .from("BudgetTemplate")
      .select("templateData")
      .eq("id", data.templateId)
      .single();

    if (template?.templateData) {
      const templateData = template.templateData as {
        categories?: Array<{
          code: string;
          name: string;
          subcategories?: Array<{ code: string; name: string }>;
        }>;
        lineItems?: Array<{
          accountCode: string;
          category: string;
          description: string;
          units: "DAYS" | "WEEKS" | "FLAT" | "HOURS" | "EACH";
          quantity: number;
          rate: number;
          fringePercent: number;
        }>;
      };

      const categoryIdByCode = new Map<string, string>();

      if (templateData.categories && templateData.categories.length > 0) {
        const topCategories = templateData.categories.map((cat, index) => ({
          budgetId: budget.id,
          code: cat.code,
          name: cat.name,
          parentCategoryId: null,
          sortOrder: index * 1000,
          allocatedBudget: 0,
          subtotalEstimated: 0,
          subtotalActual: 0,
        }));

        const { data: insertedTop, error: topError } = await supabase
          .from("BudgetCategory")
          .insert(topCategories)
          .select("id, code");

        if (topError) {
          console.error("Error inserting template categories:", topError);
        } else {
          for (const cat of insertedTop || []) {
            categoryIdByCode.set(cat.code, cat.id);
          }
        }

        const subcategoryRows = templateData.categories.flatMap((cat, parentIndex) => {
          const parentId = categoryIdByCode.get(cat.code);
          if (!parentId || !cat.subcategories || cat.subcategories.length === 0) return [];
          return cat.subcategories.map((subcat, subIndex) => ({
            budgetId: budget.id,
            code: subcat.code,
            name: subcat.name,
            parentCategoryId: parentId,
            sortOrder: parentIndex * 1000 + subIndex + 1,
            allocatedBudget: 0,
            subtotalEstimated: 0,
            subtotalActual: 0,
          }));
        });

        if (subcategoryRows.length > 0) {
          const { data: insertedSubs, error: subError } = await supabase
            .from("BudgetCategory")
            .insert(subcategoryRows)
            .select("id, code");

          if (subError) {
            console.error("Error inserting template subcategories:", subError);
          } else {
            for (const sub of insertedSubs || []) {
              categoryIdByCode.set(sub.code, sub.id);
            }
          }
        }
      }

      if (templateData.lineItems && templateData.lineItems.length > 0 && categoryIdByCode.size > 0) {
        const lineItemsByCategory: Record<string, number> = {};

        const lineItems = templateData.lineItems
          .map((item) => {
            const categoryId = categoryIdByCode.get(item.category);
            if (!categoryId) return null;
            const sortOrder = lineItemsByCategory[categoryId] ?? 0;
            lineItemsByCategory[categoryId] = sortOrder + 1;

            return {
              categoryId,
              accountCode: item.accountCode,
              description: item.description,
              units: item.units,
              quantity: item.quantity,
              rate: item.rate,
              fringePercent: item.fringePercent ?? 0,
              actualCost: 0,
              committedCost: 0,
              notes: null,
              sortOrder,
            };
          })
          .filter(Boolean);

        if (lineItems.length > 0) {
          const { error: lineItemError } = await supabase
            .from("BudgetLineItem")
            .insert(lineItems);

          if (lineItemError) {
            console.error("Error inserting template line items:", lineItemError);
          }
        }
      }
    }
  } else {
    // Create default categories using industry-standard chart of accounts
    const chartEntries = Object.entries(BUDGET_CHART_OF_ACCOUNTS);
    const topCategories = chartEntries.map(([code, { name }], index) => ({
      budgetId: budget.id,
      code,
      name,
      parentCategoryId: null,
      sortOrder: index * 1000,
      allocatedBudget: 0,
      subtotalEstimated: 0,
      subtotalActual: 0,
    }));

    const { data: insertedTop, error: topError } = await supabase
      .from("BudgetCategory")
      .insert(topCategories)
      .select("id, code");

    if (!topError && insertedTop) {
      const topIdByCode = new Map(insertedTop.map((c) => [c.code, c.id]));

      const subcategoryRows = chartEntries.flatMap(
        ([parentCode, { subcategories }], parentIndex) => {
          const parentId = topIdByCode.get(parentCode);
          if (!parentId) return [];
          return Object.entries(subcategories).map(([subCode, subName], subIndex) => ({
            budgetId: budget.id,
            code: subCode,
            name: subName,
            parentCategoryId: parentId,
            sortOrder: parentIndex * 1000 + subIndex + 1,
            allocatedBudget: 0,
            subtotalEstimated: 0,
            subtotalActual: 0,
          }));
        }
      );

      if (subcategoryRows.length > 0) {
        await supabase.from("BudgetCategory").insert(subcategoryRows);
      }
    }
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
  allocatedBudget: number;
  subtotalEstimated: number;
  subtotalActual: number;
  sortOrder: number;
  departmentStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "REVISION_REQUESTED" | "APPROVED";
  assignedUserId: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
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
