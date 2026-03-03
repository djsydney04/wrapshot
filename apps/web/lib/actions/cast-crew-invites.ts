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

export interface PendingCastCrewInvite {
  id: string;
  token: string;
  projectId: string | null;
  projectName: string;
  inviteType: CastCrewType;
  roleName: string;
  personName: string;
  expiresAt: string;
  createdAt: string;
  inviterName: string;
}

export type InviteResult = {
  success: boolean;
  message: string;
  inviteType: "linked_existing" | "sent_invite" | "no_email";
};

async function ensureProjectMembershipWithClient(
  client: any,
  projectId: string,
  userId: string,
  role: "CAST" | "CREW"
): Promise<void> {
  const { data: existingMembership, error: existingMembershipError } = await client
    .from("ProjectMember")
    .select("id, role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .maybeSingle();

  if (existingMembershipError) {
    throw new Error(`Failed to verify project membership: ${existingMembershipError.message}`);
  }

  if (!existingMembership) {
    const { error: insertError } = await client
      .from("ProjectMember")
      .insert({
        projectId,
        userId,
        role,
      })
      .select("id, role")
      .maybeSingle();

    if (insertError && insertError.code !== "23505") {
      throw new Error(`Failed to grant project access: ${insertError.message}`);
    }
    return;
  }
}

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
  const userCheck = await checkUserExistsByEmail(normalizedEmail, projectId);

  if (userCheck.exists && userCheck.userId) {
    // User exists - link them immediately
    const linkedCast = await linkCastMemberToUser(castMemberId, userCheck.userId);
    if (linkedCast.error) {
      throw new Error(linkedCast.error);
    }
    await ensureProjectMembershipWithClient(
      supabase,
      projectId,
      userCheck.userId,
      "CAST"
    );

    return {
      success: true,
      message:
        `${castMember.actorName || castMember.characterName} has been linked to their platform account ` +
        "and added to this project's workspace.",
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
  const userCheck = await checkUserExistsByEmail(normalizedEmail, projectId);

  if (userCheck.exists && userCheck.userId) {
    // User exists - link them immediately
    const linkedCrew = await linkCrewMemberToUser(crewMemberId, userCheck.userId);
    if (linkedCrew.error) {
      throw new Error(linkedCrew.error);
    }
    await ensureProjectMembershipWithClient(
      supabase,
      projectId,
      userCheck.userId,
      "CREW"
    );

    return {
      success: true,
      message:
        `${crewMember.name} has been linked to their platform account ` +
        "and added to this project's workspace.",
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
  const adminClient = createAdminClient();

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

  // Link the user to the cast/crew record with service role.
  const linkedAt = new Date().toISOString();
  if (invite.inviteType === "CAST") {
    const { data: linkedCast, error: castLinkError } = await adminClient
      .from("CastMember")
      .update({
        userId,
        updatedAt: linkedAt,
      })
      .eq("id", invite.targetId)
      .eq("projectId", invite.projectId)
      .select("id")
      .maybeSingle();

    if (castLinkError || !linkedCast) {
      return {
        success: false,
        error: castLinkError?.message || "Failed to link cast profile to your account",
      };
    }
  } else {
    const { data: linkedCrew, error: crewLinkError } = await adminClient
      .from("CrewMember")
      .update({
        userId,
        updatedAt: linkedAt,
      })
      .eq("id", invite.targetId)
      .eq("projectId", invite.projectId)
      .select("id")
      .maybeSingle();

    if (crewLinkError || !linkedCrew) {
      return {
        success: false,
        error: crewLinkError?.message || "Failed to link crew profile to your account",
      };
    }
  }

  try {
    await ensureProjectMembershipWithClient(
      adminClient,
      invite.projectId,
      userId,
      invite.inviteType === "CAST" ? "CAST" : "CREW"
    );
  } catch (membershipError) {
    return {
      success: false,
      error: membershipError instanceof Error ? membershipError.message : "Failed to grant project access",
    };
  }

  // Mark invite as accepted
  await adminClient
    .from("CastCrewInvite")
    .update({ acceptedAt: new Date().toISOString() })
    .eq("id", invite.id);

  revalidatePath(`/projects/${invite.projectId}`);
  revalidatePath("/");

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

export async function getMyPendingCastCrewInvites(): Promise<PendingCastCrewInvite[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const normalizedEmail = user?.email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return [];
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("CastCrewInvite")
      .select(`
        id,
        token,
        projectId,
        inviteType,
        targetId,
        expiresAt,
        createdAt,
        createdBy,
        project:Project (
          id,
          name
        )
      `)
      .eq("email", normalizedEmail)
      .is("acceptedAt", null)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("Error fetching pending cast/crew invites:", error);
      return [];
    }

    const castTargetIds = (data || [])
      .filter((invite) => invite.inviteType === "CAST")
      .map((invite) => invite.targetId);
    const crewTargetIds = (data || [])
      .filter((invite) => invite.inviteType === "CREW")
      .map((invite) => invite.targetId);
    const inviterIds = Array.from(new Set((data || []).map((invite) => invite.createdBy)));

    const [{ data: castRows }, { data: crewRows }, { data: inviterRows }] = await Promise.all([
      castTargetIds.length > 0
        ? adminClient
          .from("CastMember")
          .select("id, characterName, actorName")
          .in("id", castTargetIds)
        : Promise.resolve({ data: [] as Array<{ id: string; characterName: string; actorName: string | null }> }),
      crewTargetIds.length > 0
        ? adminClient
          .from("CrewMember")
          .select("id, name, role")
          .in("id", crewTargetIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; role: string }> }),
      inviterIds.length > 0
        ? adminClient
          .from("UserProfile")
          .select("userId, firstName, lastName, displayName")
          .in("userId", inviterIds)
        : Promise.resolve({
          data: [] as Array<{
            userId: string;
            firstName: string | null;
            lastName: string | null;
            displayName: string | null;
          }>,
        }),
    ]);

    const castById = new Map((castRows || []).map((row) => [row.id, row]));
    const crewById = new Map((crewRows || []).map((row) => [row.id, row]));
    const inviterNameById = new Map<string, string>();

    for (const inviter of inviterRows || []) {
      const fullName = `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim();
      inviterNameById.set(inviter.userId, inviter.displayName || fullName || "A teammate");
    }

    return (data || []).map((invite) => {
      const project = invite.project as unknown as { id: string; name: string } | null;
      if (invite.inviteType === "CAST") {
        const cast = castById.get(invite.targetId);
        const roleName = cast?.characterName || "Cast role";
        const personName = cast?.actorName || roleName;
        return {
          id: invite.id,
          token: invite.token,
          projectId: project?.id ?? null,
          projectName: project?.name || "Untitled Project",
          inviteType: "CAST" as const,
          roleName,
          personName,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          inviterName: inviterNameById.get(invite.createdBy) || "A teammate",
        };
      }

      const crew = crewById.get(invite.targetId);
      const roleName = crew?.role || "Crew role";
      const personName = crew?.name || roleName;
      return {
        id: invite.id,
        token: invite.token,
        projectId: project?.id ?? null,
        projectName: project?.name || "Untitled Project",
        inviteType: "CREW" as const,
        roleName,
        personName,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        inviterName: inviterNameById.get(invite.createdBy) || "A teammate",
      };
    });
  } catch (adminError) {
    console.warn("Falling back to non-admin cast/crew pending invite lookup:", adminError);

    const { data, error } = await supabase
      .from("CastCrewInvite")
      .select(`
        id,
        token,
        inviteType,
        expiresAt,
        createdAt,
        project:Project (
          id,
          name
        )
      `)
      .eq("email", normalizedEmail)
      .is("acceptedAt", null)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("Error fetching pending cast/crew invites (fallback):", error);
      return [];
    }

    return (data || []).map((invite) => {
      const project = invite.project as unknown as { id: string; name: string } | null;
      return {
        id: invite.id,
        token: invite.token,
        projectId: project?.id ?? null,
        projectName: project?.name || "Untitled Project",
        inviteType: invite.inviteType as CastCrewType,
        roleName: invite.inviteType === "CAST" ? "Cast role" : "Crew role",
        personName: invite.inviteType === "CAST" ? "Cast member" : "Crew member",
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        inviterName: "A teammate",
      };
    });
  }
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

  const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(invite.email, {
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

  if (authError) {
    return { success: false, error: authError.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}
