"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireProjectPermission } from "@/lib/permissions/server";
import type { ProjectRole } from "@/lib/permissions";

// Check if a crew member has platform access to a project
export async function getCrewMemberProjectAccess(crewMemberId: string, projectId: string) {
  await requireProjectPermission(projectId, "project:manage-team");
  const supabase = await createClient();

  // Get the crew member to find their userId
  const { data: crewMember, error: crewError } = await supabase
    .from("CrewMember")
    .select("userId")
    .eq("id", crewMemberId)
    .single();

  if (crewError || !crewMember?.userId) {
    return { data: null, error: crewError?.message || "Crew member not linked to a user" };
  }

  const { data: projectMember, error } = await supabase
    .from("ProjectMember")
    .select("id, role, department")
    .eq("projectId", projectId)
    .eq("userId", crewMember.userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return { data: null, error: error.message };
  }

  return {
    data: projectMember
      ? { id: projectMember.id, role: projectMember.role as ProjectRole, department: projectMember.department }
      : null,
    error: null,
  };
}

// Grant platform access to a crew member
export async function grantCrewMemberAccess(
  crewMemberId: string,
  projectId: string,
  role: ProjectRole
) {
  await requireProjectPermission(projectId, "project:manage-team");
  const supabase = await createClient();

  // Get crew member's linked userId
  const { data: crewMember, error: crewError } = await supabase
    .from("CrewMember")
    .select("userId, department")
    .eq("id", crewMemberId)
    .single();

  if (crewError || !crewMember?.userId) {
    return { data: null, error: "Crew member is not linked to a platform account" };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("ProjectMember")
    .select("id")
    .eq("projectId", projectId)
    .eq("userId", crewMember.userId)
    .single();

  if (existing) {
    return { data: null, error: "User already has project access" };
  }

  const { data, error } = await supabase
    .from("ProjectMember")
    .insert({
      projectId,
      userId: crewMember.userId,
      role,
      department: crewMember.department,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { data: { id: data.id, role: data.role as ProjectRole }, error: null };
}

// Update a crew member's project role
export async function updateCrewMemberAccess(
  crewMemberId: string,
  projectId: string,
  role: ProjectRole
) {
  await requireProjectPermission(projectId, "project:manage-team");
  const supabase = await createClient();

  const { data: crewMember, error: crewError } = await supabase
    .from("CrewMember")
    .select("userId")
    .eq("id", crewMemberId)
    .single();

  if (crewError || !crewMember?.userId) {
    return { data: null, error: "Crew member is not linked to a platform account" };
  }

  const { data, error } = await supabase
    .from("ProjectMember")
    .update({ role })
    .eq("projectId", projectId)
    .eq("userId", crewMember.userId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { data: { id: data.id, role: data.role as ProjectRole }, error: null };
}

// Revoke a crew member's platform access
export async function revokeCrewMemberAccess(crewMemberId: string, projectId: string) {
  await requireProjectPermission(projectId, "project:manage-team");
  const supabase = await createClient();

  const { data: crewMember, error: crewError } = await supabase
    .from("CrewMember")
    .select("userId")
    .eq("id", crewMemberId)
    .single();

  if (crewError || !crewMember?.userId) {
    return { success: false, error: "Crew member is not linked to a platform account" };
  }

  const { error } = await supabase
    .from("ProjectMember")
    .delete()
    .eq("projectId", projectId)
    .eq("userId", crewMember.userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, error: null };
}
