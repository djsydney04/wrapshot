"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";

export type BudgetTaskStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export interface BudgetTask {
  id: string;
  projectId: string;
  budgetId: string | null;
  title: string;
  status: BudgetTaskStatus;
  assigneeId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetTaskInput {
  projectId: string;
  budgetId?: string | null;
  title: string;
  status?: BudgetTaskStatus;
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
}

export interface UpdateBudgetTaskInput {
  title?: string;
  status?: BudgetTaskStatus;
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
}

export async function getBudgetTasksForProjects(projectIds: string[]): Promise<BudgetTask[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("BudgetTask")
    .select("*")
    .in("projectId", projectIds)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching budget tasks:", error);
    return [];
  }

  return data || [];
}

export async function createBudgetTask(input: CreateBudgetTaskInput): Promise<BudgetTask> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("BudgetTask")
    .insert({
      projectId: input.projectId,
      budgetId: input.budgetId ?? null,
      title: input.title,
      status: input.status ?? "OPEN",
      assigneeId: input.assigneeId ?? null,
      assigneeEmail: input.assigneeEmail ?? null,
      assigneeName: input.assigneeName ?? null,
      dueDate: input.dueDate ?? null,
      createdBy: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating budget task:", error);
    throw new Error("Failed to create budget task");
  }

  revalidatePath("/finance");
  if (data?.budgetId) {
    revalidatePath(`/finance/${data.budgetId}`);
  }

  return data as BudgetTask;
}

export async function updateBudgetTask(taskId: string, updates: UpdateBudgetTaskInput): Promise<BudgetTask> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
  if (updates.assigneeEmail !== undefined) updateData.assigneeEmail = updates.assigneeEmail;
  if (updates.assigneeName !== undefined) updateData.assigneeName = updates.assigneeName;
  if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;

  const { data, error } = await supabase
    .from("BudgetTask")
    .update(updateData)
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    console.error("Error updating budget task:", error);
    throw new Error("Failed to update budget task");
  }

  revalidatePath("/finance");
  if (data?.budgetId) {
    revalidatePath(`/finance/${data.budgetId}`);
  }

  return data as BudgetTask;
}

export async function deleteBudgetTask(taskId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("BudgetTask")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("Error deleting budget task:", error);
    throw new Error("Failed to delete budget task");
  }

  revalidatePath("/finance");
}
