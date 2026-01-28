"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireProjectPermission, getCurrentUserId } from "@/lib/permissions/server";
import type { ProjectRole } from "@/lib/permissions";

// Get project members
export async function getProjectMembers(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectMember")
    .select(`
      id,
      role,
      department,
      createdAt,
      user:User (
        id,
        email,
        firstName,
        lastName,
        avatarUrl
      )
    `)
    .eq("projectId", projectId);

  if (error) {
    console.error("Error fetching project members:", error);
    return [];
  }

  return data?.map((m) => ({
    id: m.id,
    userId: (m.user as { id: string }).id,
    email: (m.user as { email: string }).email,
    name: `${(m.user as { firstName: string | null }).firstName ?? ""} ${(m.user as { lastName: string | null }).lastName ?? ""}`.trim() || (m.user as { email: string }).email,
    avatarUrl: (m.user as { avatarUrl: string | null }).avatarUrl,
    role: m.role as ProjectRole,
    department: m.department,
    joinedAt: m.createdAt,
  })) ?? [];
}

// Get pending invites for a project
export async function getProjectInvites(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectInvite")
    .select("*")
    .eq("projectId", projectId)
    .gt("expiresAt", new Date().toISOString());

  if (error) {
    console.error("Error fetching project invites:", error);
    return [];
  }

  return data ?? [];
}

// Add a member to a project (by user ID)
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole,
  department?: string
) {
  // Check permission
  await requireProjectPermission(projectId, "project:manage-team");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectMember")
    .insert({
      projectId,
      userId,
      role,
      department,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding project member:", error);
    throw new Error("Failed to add project member");
  }

  revalidatePath(`/projects/${projectId}/team`);
  return data;
}

// Update a member's role
export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole,
  department?: string
) {
  // Check permission
  await requireProjectPermission(projectId, "project:manage-team");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectMember")
    .update({ role, department })
    .eq("id", memberId)
    .eq("projectId", projectId)
    .select()
    .single();

  if (error) {
    console.error("Error updating project member:", error);
    throw new Error("Failed to update project member");
  }

  revalidatePath(`/projects/${projectId}/team`);
  return data;
}

// Remove a member from a project
export async function removeProjectMember(projectId: string, memberId: string) {
  // Check permission
  await requireProjectPermission(projectId, "project:manage-team");

  const supabase = await createClient();

  const { error } = await supabase
    .from("ProjectMember")
    .delete()
    .eq("id", memberId)
    .eq("projectId", projectId);

  if (error) {
    console.error("Error removing project member:", error);
    throw new Error("Failed to remove project member");
  }

  revalidatePath(`/projects/${projectId}/team`);
}

// Create a project invite
export async function createProjectInvite(
  projectId: string,
  email: string,
  role: ProjectRole,
  department?: string
) {
  // Check permission
  const { userId } = await requireProjectPermission(projectId, "project:manage-team");

  const supabase = await createClient();

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("ProjectMember")
    .select("id")
    .eq("projectId", projectId)
    .eq("user.email", email)
    .single();

  if (existingMember) {
    throw new Error("User is already a member of this project");
  }

  // Check if invite already exists
  const { data: existingInvite } = await supabase
    .from("ProjectInvite")
    .select("id")
    .eq("projectId", projectId)
    .eq("email", email)
    .gt("expiresAt", new Date().toISOString())
    .single();

  if (existingInvite) {
    throw new Error("An invite has already been sent to this email");
  }

  // Create invite (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from("ProjectInvite")
    .insert({
      projectId,
      email: email.toLowerCase(),
      role,
      createdBy: userId,
      expiresAt: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating project invite:", error);
    throw new Error("Failed to create invite");
  }

  // TODO: Send email notification
  // await sendProjectInviteEmail(email, projectId, data.token);

  revalidatePath(`/projects/${projectId}/team`);
  return data;
}

// Resend a project invite
export async function resendProjectInvite(projectId: string, inviteId: string) {
  // Check permission
  await requireProjectPermission(projectId, "project:manage-team");

  const supabase = await createClient();

  // Update expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from("ProjectInvite")
    .update({ expiresAt: expiresAt.toISOString() })
    .eq("id", inviteId)
    .eq("projectId", projectId)
    .select()
    .single();

  if (error) {
    console.error("Error resending invite:", error);
    throw new Error("Failed to resend invite");
  }

  // TODO: Send email notification
  // await sendProjectInviteEmail(data.email, projectId, data.token);

  return data;
}

// Cancel a project invite
export async function cancelProjectInvite(projectId: string, inviteId: string) {
  // Check permission
  await requireProjectPermission(projectId, "project:manage-team");

  const supabase = await createClient();

  const { error } = await supabase
    .from("ProjectInvite")
    .delete()
    .eq("id", inviteId)
    .eq("projectId", projectId);

  if (error) {
    console.error("Error canceling invite:", error);
    throw new Error("Failed to cancel invite");
  }

  revalidatePath(`/projects/${projectId}/team`);
}

// Accept a project invite
export async function acceptProjectInvite(token: string) {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("You must be logged in to accept an invite");
  }

  const supabase = await createClient();

  // Get the invite
  const { data: invite, error: inviteError } = await supabase
    .from("ProjectInvite")
    .select("*")
    .eq("token", token)
    .gt("expiresAt", new Date().toISOString())
    .single();

  if (inviteError || !invite) {
    throw new Error("Invalid or expired invite");
  }

  // Get user email to verify
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error("This invite was sent to a different email address");
  }

  // Add user to project
  const { error: memberError } = await supabase
    .from("ProjectMember")
    .insert({
      projectId: invite.projectId,
      userId,
      role: invite.role,
    });

  if (memberError) {
    console.error("Error accepting invite:", memberError);
    throw new Error("Failed to join project");
  }

  // Delete the invite
  await supabase
    .from("ProjectInvite")
    .delete()
    .eq("id", invite.id);

  revalidatePath(`/projects/${invite.projectId}`);
  return invite.projectId;
}
