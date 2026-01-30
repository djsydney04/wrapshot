"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/permissions/server";
import { checkUserExistsByEmail } from "./users";
import { linkCastMemberToUser } from "./cast";
import { linkCrewMemberToUser } from "./crew";

export type CastCrewType = "CAST" | "CREW";

export interface CastCrewInvite {
  id: string;
  projectId: string;
  email: string;
  inviteType: CastCrewType;
  targetId: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export type InviteResult = {
  success: boolean;
  message: string;
  inviteType: "linked_existing" | "sent_invite" | "no_email";
};

// Invite a cast member to the platform (links them to their cast record)
export async function inviteCastMember(
  castMemberId: string,
  projectId: string
): Promise<InviteResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const supabase = await createClient();

  // Get the cast member record
  const { data: castMember, error: castError } = await supabase
    .from("CastMember")
    .select("id, email, userId, characterName, actorName")
    .eq("id", castMemberId)
    .eq("projectId", projectId)
    .single();

  if (castError || !castMember) {
    throw new Error("Cast member not found");
  }

  // If already linked to a user, no need to invite
  if (castMember.userId) {
    return {
      success: true,
      message: "This cast member is already linked to a platform user.",
      inviteType: "linked_existing",
    };
  }

  // If no email, can't send invite
  if (!castMember.email) {
    return {
      success: false,
      message: "No email address provided for this cast member.",
      inviteType: "no_email",
    };
  }

  const normalizedEmail = castMember.email.trim().toLowerCase();

  // Check if user already exists on the platform
  const userCheck = await checkUserExistsByEmail(normalizedEmail);

  if (userCheck.exists && userCheck.userId) {
    // User exists - link them immediately
    await linkCastMemberToUser(castMemberId, userCheck.userId);

    return {
      success: true,
      message: `${castMember.actorName || castMember.characterName} has been linked to their platform account.`,
      inviteType: "linked_existing",
    };
  }

  // Check if invite already exists for this cast member
  const { data: existingInvite } = await supabase
    .from("CastCrewInvite")
    .select("id")
    .eq("projectId", projectId)
    .eq("email", normalizedEmail)
    .eq("targetId", castMemberId)
    .eq("inviteType", "CAST")
    .gt("expiresAt", new Date().toISOString())
    .single();

  if (existingInvite) {
    return {
      success: true,
      message: "An invite has already been sent to this email.",
      inviteType: "sent_invite",
    };
  }

  // Create invite (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invite, error: inviteError } = await supabase
    .from("CastCrewInvite")
    .insert({
      projectId,
      email: normalizedEmail,
      inviteType: "CAST",
      targetId: castMemberId,
      createdBy: userId,
      expiresAt: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (inviteError) {
    console.error("Error creating cast invite:", inviteError);
    throw new Error("Failed to create invite");
  }

  // Get project name for the email
  const { data: project } = await supabase
    .from("Project")
    .select("name")
    .eq("id", projectId)
    .single();

  const projectName = project?.name || "a project";

  // Get inviter's email
  const { data: { user: inviter } } = await supabase.auth.getUser();
  const inviterEmail = inviter?.email || "A team member";

  // Send registration invite via Supabase
  const adminClient = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl}/invites/cast-crew/${invite.token}`;

  const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(
    normalizedEmail,
    {
      redirectTo,
      data: {
        cast_crew_invite_token: invite.token,
        project_id: projectId,
        project_name: projectName,
        inviter_email: inviterEmail,
        role_type: "CAST",
        role_name: castMember.characterName,
      },
    }
  );

  if (authError) {
    console.error("Error sending auth invite:", authError);
    // Don't throw - the invite record exists, user might sign up manually
  }

  revalidatePath(`/projects/${projectId}`);

  return {
    success: true,
    message: `Registration invite sent to ${normalizedEmail}. They'll receive an email to create their account.`,
    inviteType: "sent_invite",
  };
}

// Invite a crew member to the platform (links them to their crew record)
export async function inviteCrewMember(
  crewMemberId: string,
  projectId: string
): Promise<InviteResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const supabase = await createClient();

  // Get the crew member record
  const { data: crewMember, error: crewError } = await supabase
    .from("CrewMember")
    .select("id, email, userId, name, role")
    .eq("id", crewMemberId)
    .eq("projectId", projectId)
    .single();

  if (crewError || !crewMember) {
    throw new Error("Crew member not found");
  }

  // If already linked to a user, no need to invite
  if (crewMember.userId) {
    return {
      success: true,
      message: "This crew member is already linked to a platform user.",
      inviteType: "linked_existing",
    };
  }

  // If no email, can't send invite
  if (!crewMember.email) {
    return {
      success: false,
      message: "No email address provided for this crew member.",
      inviteType: "no_email",
    };
  }

  const normalizedEmail = crewMember.email.trim().toLowerCase();

  // Check if user already exists on the platform
  const userCheck = await checkUserExistsByEmail(normalizedEmail);

  if (userCheck.exists && userCheck.userId) {
    // User exists - link them immediately
    await linkCrewMemberToUser(crewMemberId, userCheck.userId);

    return {
      success: true,
      message: `${crewMember.name} has been linked to their platform account.`,
      inviteType: "linked_existing",
    };
  }

  // Check if invite already exists for this crew member
  const { data: existingInvite } = await supabase
    .from("CastCrewInvite")
    .select("id")
    .eq("projectId", projectId)
    .eq("email", normalizedEmail)
    .eq("targetId", crewMemberId)
    .eq("inviteType", "CREW")
    .gt("expiresAt", new Date().toISOString())
    .single();

  if (existingInvite) {
    return {
      success: true,
      message: "An invite has already been sent to this email.",
      inviteType: "sent_invite",
    };
  }

  // Create invite (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invite, error: inviteError } = await supabase
    .from("CastCrewInvite")
    .insert({
      projectId,
      email: normalizedEmail,
      inviteType: "CREW",
      targetId: crewMemberId,
      createdBy: userId,
      expiresAt: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (inviteError) {
    console.error("Error creating crew invite:", inviteError);
    throw new Error("Failed to create invite");
  }

  // Get project name for the email
  const { data: project } = await supabase
    .from("Project")
    .select("name")
    .eq("id", projectId)
    .single();

  const projectName = project?.name || "a project";

  // Get inviter's email
  const { data: { user: inviter } } = await supabase.auth.getUser();
  const inviterEmail = inviter?.email || "A team member";

  // Send registration invite via Supabase
  const adminClient = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl}/invites/cast-crew/${invite.token}`;

  const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(
    normalizedEmail,
    {
      redirectTo,
      data: {
        cast_crew_invite_token: invite.token,
        project_id: projectId,
        project_name: projectName,
        inviter_email: inviterEmail,
        role_type: "CREW",
        role_name: crewMember.role,
      },
    }
  );

  if (authError) {
    console.error("Error sending auth invite:", authError);
    // Don't throw - the invite record exists, user might sign up manually
  }

  revalidatePath(`/projects/${projectId}`);

  return {
    success: true,
    message: `Registration invite sent to ${normalizedEmail}. They'll receive an email to create their account.`,
    inviteType: "sent_invite",
  };
}

// Accept a cast/crew invite (links userId to the record)
export async function acceptCastCrewInvite(token: string): Promise<{
  success: boolean;
  projectId?: string;
  recordType?: "cast" | "crew";
  error?: string;
}> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be logged in to accept an invite" };
  }

  const supabase = await createClient();

  // Get the invite
  const { data: invite, error: inviteError } = await supabase
    .from("CastCrewInvite")
    .select("*")
    .eq("token", token)
    .gt("expiresAt", new Date().toISOString())
    .is("acceptedAt", null)
    .single();

  if (inviteError || !invite) {
    return { success: false, error: "Invalid or expired invite" };
  }

  // Get user email to verify
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return { success: false, error: "This invite was sent to a different email address" };
  }

  // Link the user to the cast/crew record
  if (invite.inviteType === "CAST") {
    const result = await linkCastMemberToUser(invite.targetId, userId);
    if (result.error) {
      return { success: false, error: result.error };
    }
  } else {
    const result = await linkCrewMemberToUser(invite.targetId, userId);
    if (result.error) {
      return { success: false, error: result.error };
    }
  }

  // Mark invite as accepted
  await supabase
    .from("CastCrewInvite")
    .update({ acceptedAt: new Date().toISOString() })
    .eq("id", invite.id);

  revalidatePath(`/projects/${invite.projectId}`);

  return {
    success: true,
    projectId: invite.projectId,
    recordType: invite.inviteType.toLowerCase() as "cast" | "crew",
  };
}

// Get invite details by token (for display on accept page)
export async function getCastCrewInviteByToken(token: string) {
  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from("CastCrewInvite")
    .select(`
      id,
      email,
      inviteType,
      targetId,
      expiresAt,
      acceptedAt,
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

  // Get the cast/crew record details
  let roleName = "";
  let personName = "";

  if (invite.inviteType === "CAST") {
    const { data: castMember } = await supabase
      .from("CastMember")
      .select("characterName, actorName")
      .eq("id", invite.targetId)
      .single();

    if (castMember) {
      roleName = castMember.characterName;
      personName = castMember.actorName || castMember.characterName;
    }
  } else {
    const { data: crewMember } = await supabase
      .from("CrewMember")
      .select("name, role")
      .eq("id", invite.targetId)
      .single();

    if (crewMember) {
      roleName = crewMember.role;
      personName = crewMember.name;
    }
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
    inviteType: invite.inviteType as CastCrewType,
    roleName,
    personName,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
    projectId: project?.id,
    projectName: project?.name,
    inviterName,
    isExpired: new Date(invite.expiresAt) < new Date(),
    isAccepted: !!invite.acceptedAt,
  };
}

// Get pending cast/crew invites for a project
export async function getCastCrewInvites(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CastCrewInvite")
    .select("*")
    .eq("projectId", projectId)
    .gt("expiresAt", new Date().toISOString())
    .is("acceptedAt", null);

  if (error) {
    console.error("Error fetching cast/crew invites:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CastCrewInvite[], error: null };
}

// Cancel a cast/crew invite
export async function cancelCastCrewInvite(inviteId: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("CastCrewInvite")
    .delete()
    .eq("id", inviteId)
    .eq("projectId", projectId);

  if (error) {
    console.error("Error canceling cast/crew invite:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Resend a cast/crew invite
export async function resendCastCrewInvite(inviteId: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Update expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invite, error } = await supabase
    .from("CastCrewInvite")
    .update({ expiresAt: expiresAt.toISOString() })
    .eq("id", inviteId)
    .eq("projectId", projectId)
    .select()
    .single();

  if (error) {
    console.error("Error resending cast/crew invite:", error);
    return { success: false, error: error.message };
  }

  // Resend the registration email
  const { data: project } = await supabase
    .from("Project")
    .select("name")
    .eq("id", projectId)
    .single();

  const projectName = project?.name || "a project";
  const { data: { user: inviter } } = await supabase.auth.getUser();
  const inviterEmail = inviter?.email || "A team member";

  // Get role info
  let roleName = "";
  if (invite.inviteType === "CAST") {
    const { data: castMember } = await supabase
      .from("CastMember")
      .select("characterName")
      .eq("id", invite.targetId)
      .single();
    roleName = castMember?.characterName || "";
  } else {
    const { data: crewMember } = await supabase
      .from("CrewMember")
      .select("role")
      .eq("id", invite.targetId)
      .single();
    roleName = crewMember?.role || "";
  }

  const adminClient = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl}/invites/cast-crew/${invite.token}`;

  await adminClient.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo,
    data: {
      cast_crew_invite_token: invite.token,
      project_id: projectId,
      project_name: projectName,
      inviter_email: inviterEmail,
      role_type: invite.inviteType,
      role_name: roleName,
    },
  });

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}
