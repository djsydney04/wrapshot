import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  TEAM_MEMBER_MONTHLY_PRICE_CENTS,
  getTeamMonthlyCostCents,
} from "@/lib/billing/team-pricing";

type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";

interface OrganizationMemberRow {
  id: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
}

interface UserProfileRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface OrganizationInvitationRow {
  id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  createdAt: string;
}

export interface OrganizationTeamMember {
  id: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface OrganizationPendingInvite {
  id: string;
  email: string;
  role: OrganizationRole;
  status: "pending";
  invitedAt: string;
}

export interface TeamSummary {
  organizationId: string;
  memberCount: number;
  seatPriceCents: number;
  monthlySeatCostCents: number;
}

export interface OrganizationTeamData extends TeamSummary {
  members: OrganizationTeamMember[];
  pendingInvites: OrganizationPendingInvite[];
}

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user.id;
}

async function resolveOrganizationId(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("OrganizationMember")
    .select("organizationId")
    .eq("userId", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error("Failed to fetch organization");
  }

  if (membership?.organizationId) {
    return membership.organizationId;
  }

  const { data: organizationId, error: rpcError } = await supabase.rpc(
    "get_or_create_user_organization",
    {
      user_id: userId,
    }
  );

  if (rpcError || !organizationId) {
    throw new Error("Failed to resolve organization");
  }

  return organizationId as string;
}

export async function getCurrentTeamSummary(): Promise<TeamSummary> {
  const userId = await getAuthenticatedUserId();
  const organizationId = await resolveOrganizationId(userId);
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("OrganizationMember")
    .select("id", { count: "exact", head: true })
    .eq("organizationId", organizationId);

  if (error) {
    throw new Error("Failed to fetch team member count");
  }

  const memberCount = count ?? 0;

  return {
    organizationId,
    memberCount,
    seatPriceCents: TEAM_MEMBER_MONTHLY_PRICE_CENTS,
    monthlySeatCostCents: getTeamMonthlyCostCents(memberCount),
  };
}

function getFallbackName(email: string, userId: string): string {
  if (email) {
    return email.split("@")[0];
  }
  return `Member ${userId.slice(0, 6)}`;
}

function getDisplayName(profile: UserProfileRow | undefined, fallbackName: string): string {
  const fullName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
  return profile?.displayName || fullName || fallbackName;
}

export async function getCurrentOrganizationTeam(): Promise<OrganizationTeamData> {
  const userId = await getAuthenticatedUserId();
  const organizationId = await resolveOrganizationId(userId);
  const supabase = await createClient();

  const { data: memberRows, error: membersError } = await supabase
    .from("OrganizationMember")
    .select("id, userId, role, createdAt")
    .eq("organizationId", organizationId)
    .order("createdAt", { ascending: true });

  if (membersError) {
    throw new Error("Failed to fetch team members");
  }

  const members = (memberRows ?? []) as OrganizationMemberRow[];
  const userIds = members.map((member) => member.userId);

  const profileByUserId = new Map<string, UserProfileRow>();
  const emailByUserId = new Map<string, string>();

  try {
    const admin = createAdminClient();

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("UserProfile")
        .select("userId, firstName, lastName, displayName, avatarUrl")
        .in("userId", userIds);

      for (const profile of (profiles ?? []) as UserProfileRow[]) {
        profileByUserId.set(profile.userId, profile);
      }

      await Promise.all(
        userIds.map(async (memberUserId) => {
          const { data } = await admin.auth.admin.getUserById(memberUserId);
          if (data.user?.email) {
            emailByUserId.set(memberUserId, data.user.email);
          }
        })
      );
    }
  } catch {
    // Graceful fallback when service-role credentials are not available.
  }

  const mappedMembers: OrganizationTeamMember[] = members.map((member) => {
    const profile = profileByUserId.get(member.userId);
    const email = emailByUserId.get(member.userId) ?? "";
    const fallbackName = getFallbackName(email, member.userId);

    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.createdAt,
      name: getDisplayName(profile, fallbackName),
      email,
      avatarUrl: profile?.avatarUrl ?? null,
    };
  });

  let pendingInvites: OrganizationPendingInvite[] = [];
  const { data: invitationRows } = await supabase
    .from("OrganizationInvitation")
    .select("id, email, role, status, createdAt")
    .eq("organizationId", organizationId)
    .eq("status", "PENDING")
    .order("createdAt", { ascending: false });

  if (invitationRows) {
    pendingInvites = (invitationRows as OrganizationInvitationRow[]).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: "pending",
      invitedAt: invite.createdAt,
    }));
  }

  const memberCount = mappedMembers.length;

  return {
    organizationId,
    memberCount,
    seatPriceCents: TEAM_MEMBER_MONTHLY_PRICE_CENTS,
    monthlySeatCostCents: getTeamMonthlyCostCents(memberCount),
    members: mappedMembers,
    pendingInvites,
  };
}

