"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentUserId,
  requireProjectPermission,
} from "@/lib/permissions/server";

type ProjectRole =
  | "ADMIN"
  | "COORDINATOR"
  | "DEPARTMENT_HEAD"
  | "CREW"
  | "CAST"
  | "VIEWER";

export type DepartmentBudgetRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DepartmentBudgetRequest {
  id: string;
  projectId: string;
  budgetId: string;
  categoryId: string | null;
  department: string;
  requestedAmount: number;
  reason: string;
  status: DepartmentBudgetRequestStatus;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentBudgetRequestInput {
  projectId: string;
  budgetId: string;
  categoryId?: string | null;
  department: string;
  requestedAmount: number;
  reason: string;
}

export interface BudgetRequestPermissions {
  currentUserId: string;
  role: ProjectRole;
  financialHeadUserId: string | null;
  isFinancialHead: boolean;
  canSubmitRequests: boolean;
  canManageRequests: boolean;
  canAssignFinancialHead: boolean;
  assignedDepartmentCategoryIds: string[];
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

async function getPermissionContext(
  projectId: string,
): Promise<BudgetRequestPermissions> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("ProjectMember")
    .select("role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (membershipError || !membership) {
    throw new Error("Unauthorized: Not a member of this project");
  }

  let project: { financialHeadUserId: string | null } | null = null;
  const { data: projectWithHead, error: projectError } = await supabase
    .from("Project")
    .select("financialHeadUserId")
    .eq("id", projectId)
    .maybeSingle();

  if (isMissingFinancialHeadColumnError(projectError)) {
    const { data: existingProject, error: existingProjectError } =
      await supabase
        .from("Project")
        .select("id")
        .eq("id", projectId)
        .maybeSingle();

    if (existingProjectError || !existingProject) {
      throw new Error("Project not found");
    }

    project = { financialHeadUserId: null };
  } else if (projectError || !projectWithHead) {
    throw new Error("Project not found");
  } else {
    project = {
      financialHeadUserId: projectWithHead.financialHeadUserId ?? null,
    };
  }

  const role = membership.role as ProjectRole;
  const isFinancialHead = project.financialHeadUserId === userId;
  const canSubmitRequests = [
    "ADMIN",
    "COORDINATOR",
    "DEPARTMENT_HEAD",
  ].includes(role);
  const canManageRequests =
    role === "ADMIN" || role === "COORDINATOR" || isFinancialHead;

  // Find top-level budget categories assigned to this user
  const { data: assignedCategories } = await supabase
    .from("BudgetCategory")
    .select("id, budgetId")
    .is("parentCategoryId", null)
    .eq("assignedUserId", userId);

  return {
    currentUserId: userId,
    role,
    financialHeadUserId: project.financialHeadUserId ?? null,
    isFinancialHead,
    canSubmitRequests,
    canManageRequests,
    canAssignFinancialHead: role === "ADMIN" || role === "COORDINATOR",
    assignedDepartmentCategoryIds: (assignedCategories ?? []).map((c) => c.id),
  };
}

export async function getBudgetRequestPermissions(
  projectId: string,
): Promise<BudgetRequestPermissions> {
  return getPermissionContext(projectId);
}

export async function getDepartmentBudgetRequests(
  budgetId: string,
): Promise<DepartmentBudgetRequest[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("id")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  const { data, error } = await supabase
    .from("DepartmentBudgetRequest")
    .select("*")
    .eq("budgetId", budgetId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching department budget requests:", error);
    return [];
  }

  return (data ?? []) as DepartmentBudgetRequest[];
}

export async function createDepartmentBudgetRequest(
  input: CreateDepartmentBudgetRequestInput,
): Promise<DepartmentBudgetRequest> {
  const supabase = await createClient();
  const permissions = await getPermissionContext(input.projectId);

  if (!permissions.canSubmitRequests) {
    throw new Error(
      "Unauthorized: You do not have permission to submit budget requests",
    );
  }

  const requestedAmount = Number(input.requestedAmount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new Error("Requested amount must be greater than 0");
  }

  const department = input.department.trim();
  const reason = input.reason.trim();

  if (!department) {
    throw new Error("Department is required");
  }

  if (!reason) {
    throw new Error("Reason is required");
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("id, projectId, status")
    .eq("id", input.budgetId)
    .single();

  if (budgetError || !budget || budget.projectId !== input.projectId) {
    throw new Error("Budget not found for this project");
  }

  if (budget.status === "LOCKED") {
    throw new Error("Cannot submit requests against a locked budget");
  }

  if (input.categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("BudgetCategory")
      .select("id")
      .eq("id", input.categoryId)
      .eq("budgetId", input.budgetId)
      .single();

    if (categoryError || !category) {
      throw new Error("Selected category does not belong to this budget");
    }
  }

  const { data: request, error } = await supabase
    .from("DepartmentBudgetRequest")
    .insert({
      projectId: input.projectId,
      budgetId: input.budgetId,
      categoryId: input.categoryId ?? null,
      department,
      requestedAmount,
      reason,
      requestedBy: permissions.currentUserId,
      status: "PENDING",
    })
    .select("*")
    .single();

  if (error || !request) {
    console.error("Error creating department budget request:", error);
    throw new Error("Failed to create budget request");
  }

  revalidatePath(`/projects/${input.projectId}`);
  return request as DepartmentBudgetRequest;
}

export async function reviewDepartmentBudgetRequest(
  requestId: string,
  status: "APPROVED" | "REJECTED",
  reviewNotes?: string,
): Promise<DepartmentBudgetRequest> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: request, error: requestError } = await supabase
    .from("DepartmentBudgetRequest")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error("Budget request not found");
  }

  const permissions = await getPermissionContext(request.projectId);
  if (!permissions.canManageRequests) {
    throw new Error(
      "Unauthorized: You do not have permission to review budget requests",
    );
  }

  if (request.status !== "PENDING") {
    throw new Error("Only pending requests can be reviewed");
  }

  if (status === "APPROVED" && request.categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("BudgetCategory")
      .select("id, allocatedBudget")
      .eq("id", request.categoryId)
      .eq("budgetId", request.budgetId)
      .single();

    if (categoryError || !category) {
      throw new Error("Linked category no longer exists for this budget");
    }

    const currentAllocation = Number(category.allocatedBudget ?? 0);
    const requestedAmount = Number(request.requestedAmount ?? 0);

    const { error: categoryUpdateError } = await supabase
      .from("BudgetCategory")
      .update({
        allocatedBudget: currentAllocation + requestedAmount,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", category.id);

    if (categoryUpdateError) {
      console.error(
        "Error applying approved amount to category allocation:",
        categoryUpdateError,
      );
      throw new Error("Failed to apply approved amount to category allocation");
    }
  }

  const { data: updatedRequest, error: updateError } = await supabase
    .from("DepartmentBudgetRequest")
    .update({
      status,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (updateError || !updatedRequest) {
    console.error("Error reviewing department budget request:", updateError);
    throw new Error("Failed to update budget request");
  }

  revalidatePath(`/projects/${request.projectId}`);
  return updatedRequest as DepartmentBudgetRequest;
}

export async function setProjectFinancialHead(
  projectId: string,
  financialHeadUserId: string | null,
): Promise<void> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  await requireProjectPermission(projectId, "project:manage-team");

  if (financialHeadUserId) {
    const { data: membership, error: membershipError } = await supabase
      .from("ProjectMember")
      .select("id")
      .eq("projectId", projectId)
      .eq("userId", financialHeadUserId)
      .single();

    if (membershipError || !membership) {
      throw new Error("Financial head must be a member of the project");
    }
  }

  const { error } = await adminClient
    .from("Project")
    .update({
      financialHeadUserId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    console.error("Error updating project financial head:", error);
    throw new Error("Failed to update project financial head");
  }

  revalidatePath(`/projects/${projectId}`);
}
