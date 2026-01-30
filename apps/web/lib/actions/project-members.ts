"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireProjectPermission, getCurrentUserId, checkPlanLimit } from "@/lib/permissions/server";
import type { ProjectRole } from "@/lib/permissions";
import { checkUserExistsByEmail } from "./users";

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

  return data?.map((m) => {
    const user = m.user as unknown as { id: string; email: string; firstName: string | null; lastName: string | null; avatarUrl: string | null } | null;
    return {
      id: m.id,
      userId: user?.id ?? "",
      email: user?.email ?? "",
      name: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || (user?.email ?? ""),
      avatarUrl: user?.avatarUrl ?? null,
      role: m.role as ProjectRole,
      department: m.department,
      joinedAt: m.createdAt,
    };
  }).filter((m) => m.userId) ?? [];
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

  // Check if the user being added can join another project based on their plan
  const canJoin = await checkPlanLimit(userId, "projects");
  if (!canJoin) {
    throw new Error("This user has reached their project limit. They need to upgrade their plan to join more projects.");
  }

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

  // Check if the user can join another project based on their plan
  const canJoin = await checkPlanLimit(userId, "projects");
  if (!canJoin) {
    throw new Error("You've reached your project limit on the Free plan. Upgrade to Pro to join unlimited projects.");
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

// Get invite details by token (for display on accept page)
export async function getInviteByToken(token: string) {
  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from("ProjectInvite")
    .select(`
      id,
      email,
      role,
      expiresAt,
      createdAt,
      createdBy,
      project:Project (
        id,
        name
      )
    `)
    .eq("token", token)
    .single();

  if (error || !invite) {
    return null;
  }

  // Get inviter info
  const adminClient = createAdminClient();
  const { data: inviterAuth } = await adminClient.auth.admin.getUserById(
    invite.createdBy
  );

  let inviterName = "Someone";
  if (inviterAuth?.user) {
    const { data: inviterProfile } = await supabase
      .from("UserProfile")
      .select("firstName, lastName, displayName")
      .eq("userId", invite.createdBy)
      .single();

    if (inviterProfile) {
      inviterName =
        inviterProfile.displayName ||
        `${inviterProfile.firstName || ""} ${inviterProfile.lastName || ""}`.trim() ||
        inviterAuth.user.email ||
        "Someone";
    }
  }

  const project = invite.project as unknown as { id: string; name: string } | null;

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role as ProjectRole,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    projectId: project?.id,
    projectName: project?.name,
    inviterName,
    isExpired: new Date(invite.expiresAt) < new Date(),
  };
}

export type InviteResult = {
  success: boolean;
  message: string;
  inviteType: "existing_user" | "new_user";
};

// Smart invite that handles both existing and new users
export async function inviteUserToProject(
  projectId: string,
  email: string,
  role: ProjectRole,
  department?: string
): Promise<InviteResult> {
  // Check permission
  const { userId: inviterId } = await requireProjectPermission(
    projectId,
    "project:manage-team"
  );

  const supabase = await createClient();
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user is already a member by email
  // First, check if there's a user with this email
  const userCheck = await checkUserExistsByEmail(normalizedEmail);

  if (userCheck.exists && userCheck.userId) {
    // Check if already a member
    const { data: existingMember } = await supabase
      .from("ProjectMember")
      .select("id")
      .eq("projectId", projectId)
      .eq("userId", userCheck.userId)
      .single();

    if (existingMember) {
      throw new Error("This user is already a member of this project");
    }
  }

  // Check if invite already exists
  const { data: existingInvite } = await supabase
    .from("ProjectInvite")
    .select("id")
    .eq("projectId", projectId)
    .eq("email", normalizedEmail)
    .gt("expiresAt", new Date().toISOString())
    .single();

  if (existingInvite) {
    throw new Error("An invite has already been sent to this email");
  }

  // Create invite (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invite, error: inviteError } = await supabase
    .from("ProjectInvite")
    .insert({
      projectId,
      email: normalizedEmail,
      role,
      createdBy: inviterId,
      expiresAt: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (inviteError) {
    console.error("Error creating project invite:", inviteError);
    throw new Error("Failed to create invite");
  }

  // Get project name for the email
  const { data: project } = await supabase
    .from("Project")
    .select("name")
    .eq("id", projectId)
    .single();

  const projectName = project?.name || "a project";

  if (userCheck.exists) {
    // User exists on platform - they just need to accept the invite
    // TODO: Send notification email to existing user
    // await sendExistingUserInviteEmail(normalizedEmail, projectName, invite.token);

    revalidatePath(`/projects/${projectId}/team`);
    return {
      success: true,
      message: `Invite sent to ${normalizedEmail}. They can accept it from their dashboard.`,
      inviteType: "existing_user",
    };
  } else {
    // User doesn't exist - send Supabase registration invite
    const adminClient = createAdminClient();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = `${siteUrl}/invites/${invite.token}`;

    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: {
          invite_token: invite.token,
          project_id: projectId,
          project_name: projectName,
          role: role,
        },
      }
    );

    if (authError) {
      console.error("Error sending auth invite:", authError);
      // Still keep the ProjectInvite record - user might sign up manually
      // Don't throw, just log the issue
    }

    revalidatePath(`/projects/${projectId}/team`);
    return {
      success: true,
      message: `Registration invite sent to ${normalizedEmail}. They'll receive an email to create their account.`,
      inviteType: "new_user",
    };
  }
}
