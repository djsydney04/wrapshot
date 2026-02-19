import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export interface DepartmentBudgetSyncInput {
  projectId: string;
  department: "CAMERA" | "GE";
  sourceType: string;
  sourceId: string;
  plannedAmount?: number;
  committedAmount?: number;
  actualAmount?: number;
  reason: string;
}

function toAmount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  if (!value) return 0;
  return Math.max(0, Number(value));
}

function departmentName(department: "CAMERA" | "GE"): string {
  return department === "CAMERA" ? "Camera" : "Grip & Electric";
}

const CATEGORY_CANDIDATES: Record<"CAMERA" | "GE", string[]> = {
  CAMERA: ["Camera"],
  GE: ["Grip & Electric", "Lighting", "Electric", "Grip"],
};

async function findBestCategoryId(
  budgetId: string,
  candidates: string[],
): Promise<string | null> {
  const supabase = await createClient();

  for (const candidate of candidates) {
    const { data } = await supabase
      .from("BudgetCategory")
      .select("id")
      .eq("budgetId", budgetId)
      .is("parentCategoryId", null)
      .ilike("name", candidate)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  return null;
}

export async function autoSyncDepartmentBudgetRequest(
  input: DepartmentBudgetSyncInput,
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const requestedAmount =
    toAmount(input.plannedAmount) +
    toAmount(input.committedAmount) +
    toAmount(input.actualAmount);

  if (requestedAmount <= 0) {
    return { success: true, skipped: true, reason: "No non-zero amount to sync" };
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("id, status")
    .eq("projectId", input.projectId)
    .neq("status", "LOCKED")
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (budgetError) {
    return { success: false, error: budgetError.message };
  }

  if (!budget?.id) {
    return { success: true, skipped: true, reason: "No editable budget found" };
  }

  const categoryId = await findBestCategoryId(
    budget.id,
    CATEGORY_CANDIDATES[input.department],
  );

  const { data: existingLink } = await supabase
    .from("DepartmentBudgetLink")
    .select("id, requestId")
    .eq("projectId", input.projectId)
    .eq("department", input.department)
    .eq("sourceType", input.sourceType)
    .eq("sourceId", input.sourceId)
    .maybeSingle();

  let requestId: string | null = existingLink?.requestId || null;

  if (requestId) {
    const { data: existingRequest } = await supabase
      .from("DepartmentBudgetRequest")
      .select("id, status, requestedBy")
      .eq("id", requestId)
      .maybeSingle();

    if (
      existingRequest?.id &&
      existingRequest.status === "PENDING" &&
      existingRequest.requestedBy === userId
    ) {
      const { error: updateRequestError } = await supabase
        .from("DepartmentBudgetRequest")
        .update({
          requestedAmount,
          reason: input.reason,
          categoryId: categoryId || null,
          department: departmentName(input.department),
        })
        .eq("id", existingRequest.id);

      if (updateRequestError) {
        return { success: false, error: updateRequestError.message };
      }
    } else {
      requestId = null;
    }
  }

  if (!requestId) {
    const { data: createdRequest, error: createRequestError } = await supabase
      .from("DepartmentBudgetRequest")
      .insert({
        projectId: input.projectId,
        budgetId: budget.id,
        categoryId: categoryId || null,
        department: departmentName(input.department),
        requestedAmount,
        reason: input.reason,
        requestedBy: userId,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (createRequestError || !createdRequest?.id) {
      return {
        success: false,
        error: createRequestError?.message || "Failed to create budget request",
      };
    }

    requestId = createdRequest.id;
  }

  const { error: upsertLinkError } = await supabase
    .from("DepartmentBudgetLink")
    .upsert(
      {
        projectId: input.projectId,
        department: input.department,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        budgetId: budget.id,
        categoryId: categoryId || null,
        requestId,
        plannedAmount: toAmount(input.plannedAmount),
        committedAmount: toAmount(input.committedAmount),
        actualAmount: toAmount(input.actualAmount),
        lastSyncedAt: new Date().toISOString(),
        createdBy: userId,
      },
      { onConflict: "projectId,department,sourceType,sourceId" },
    );

  if (upsertLinkError) {
    return { success: false, error: upsertLinkError.message };
  }

  return {
    success: true,
    skipped: false,
    requestId,
    budgetId: budget.id,
    categoryId,
  };
}
