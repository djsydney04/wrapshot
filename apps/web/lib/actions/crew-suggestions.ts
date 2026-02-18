"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export interface CrewSuggestion {
  id: string;
  projectId: string;
  jobId: string;
  role: string;
  department: string;
  reason: string;
  priority: "high" | "medium" | "low";
  accepted: boolean | null;
  crewMemberId: string | null;
  createdAt: string;
}

// Fetch crew suggestions for a project
export async function getCrewSuggestions(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CrewSuggestion")
    .select("*")
    .eq("projectId", projectId)
    .is("accepted", null)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching crew suggestions:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CrewSuggestion[], error: null };
}

// Accept a crew suggestion — creates a CrewMember record
export async function acceptCrewSuggestion(suggestionId: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get the suggestion
  const { data: suggestion, error: fetchError } = await supabase
    .from("CrewSuggestion")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (fetchError || !suggestion) {
    return { data: null, error: fetchError?.message || "Suggestion not found" };
  }

  // Create a crew member from the suggestion
  const { data: crewMember, error: createError } = await supabase
    .from("CrewMember")
    .insert({
      projectId,
      name: `TBD - ${suggestion.role}`,
      role: suggestion.role,
      department: suggestion.department,
      isHead: false,
    })
    .select()
    .single();

  if (createError) {
    console.error("Error creating crew member from suggestion:", createError);
    return { data: null, error: createError.message };
  }

  // Mark suggestion as accepted
  await supabase
    .from("CrewSuggestion")
    .update({
      accepted: true,
      crewMemberId: crewMember.id,
    })
    .eq("id", suggestionId);

  revalidatePath(`/projects/${projectId}`);

  return { data: crewMember, error: null };
}

// Dismiss a crew suggestion
export async function dismissCrewSuggestion(suggestionId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("CrewSuggestion")
    .update({ accepted: false })
    .eq("id", suggestionId);

  if (error) {
    console.error("Error dismissing crew suggestion:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}
