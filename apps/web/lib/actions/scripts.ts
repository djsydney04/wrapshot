"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export interface ScriptInput {
  projectId: string;
  version: string;
  color?: string;
  fileUrl?: string;
  content?: string;
  isActive?: boolean;
}

export interface Script {
  id: string;
  projectId: string;
  version: string;
  color: string | null;
  uploadedAt: string;
  fileUrl: string | null;
  content: string | null;
  isActive: boolean;
  breakdownStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  breakdownStartedAt: string | null;
  breakdownCompletedAt: string | null;
  parsedContent: Record<string, unknown> | null;
}

// Fetch all scripts for a project
export async function getScripts(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Script")
    .select("*")
    .eq("projectId", projectId)
    .order("uploadedAt", { ascending: false });

  if (error) {
    console.error("Error fetching scripts:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Script[], error: null };
}

// Get a single script
export async function getScript(scriptId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Script")
    .select("*")
    .eq("id", scriptId)
    .single();

  if (error) {
    console.error("Error fetching script:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Script, error: null };
}

// Create a new script
export async function createScript(input: ScriptInput) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // If setting as active, deactivate other scripts first
  if (input.isActive) {
    await supabase
      .from("Script")
      .update({ isActive: false })
      .eq("projectId", input.projectId);
  }

  const { data, error } = await supabase
    .from("Script")
    .insert({
      projectId: input.projectId,
      version: input.version,
      color: input.color || "WHITE",
      fileUrl: input.fileUrl || null,
      content: input.content || null,
      isActive: input.isActive ?? false,
      breakdownStatus: "NOT_STARTED",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating script:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);

  return { data: data as Script, error: null };
}

// Update a script
export async function updateScript(id: string, updates: Partial<ScriptInput>) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Script")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating script:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data: data as Script, error: null };
}

// Delete a script
export async function deleteScript(id: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("Script").delete().eq("id", id);

  if (error) {
    console.error("Error deleting script:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Set a script as active (current version)
export async function setActiveScript(scriptId: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Deactivate all scripts for this project
  await supabase
    .from("Script")
    .update({ isActive: false })
    .eq("projectId", projectId);

  // Activate the selected script
  const { error } = await supabase
    .from("Script")
    .update({ isActive: true })
    .eq("id", scriptId);

  if (error) {
    console.error("Error setting active script:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}
