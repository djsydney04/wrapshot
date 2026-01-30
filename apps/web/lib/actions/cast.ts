"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export type CastWorkStatus = "ON_HOLD" | "CONFIRMED" | "WORKING" | "WRAPPED" | "DROPPED";
export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "TENTATIVE" | "FIRST_CHOICE";

export interface CastMemberInput {
  projectId: string;
  characterName: string;
  actorName?: string;
  castNumber?: number;
  contractStart?: string;
  contractEnd?: string;
  dropDeadDate?: string;
  dailyRate?: number;
  weeklyRate?: number;
  workStatus?: CastWorkStatus;
  unionAffiliation?: string;
  email?: string;
  phone?: string;
  agentName?: string;
  agentContact?: string;
  notes?: string;
  hairMakeupMins?: number;
  userId?: string; // Optional link to platform user
}

export interface CastMember {
  id: string;
  projectId: string;
  userId: string | null;
  characterName: string;
  actorName: string | null;
  castNumber: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  dropDeadDate: string | null;
  dailyRate: number | null;
  weeklyRate: number | null;
  workStatus: CastWorkStatus;
  unionAffiliation: string | null;
  email: string | null;
  phone: string | null;
  agentName: string | null;
  agentContact: string | null;
  notes: string | null;
  hairMakeupMins: number;
  createdAt: string;
  updatedAt: string;
  // Joined data
  availability?: CastAvailability[];
  sceneCount?: number;
}

export interface CastAvailability {
  id: string;
  castMemberId: string;
  date: string;
  status: AvailabilityStatus;
  notes: string | null;
}

// Fetch all cast members for a project
export async function getCastMembers(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CastMember")
    .select("*")
    .eq("projectId", projectId)
    .order("castNumber", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error fetching cast members:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CastMember[], error: null };
}

// Get a single cast member with availability
export async function getCastMember(castMemberId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CastMember")
    .select(`
      *,
      availability:CastAvailability(*)
    `)
    .eq("id", castMemberId)
    .single();

  if (error) {
    console.error("Error fetching cast member:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CastMember, error: null };
}

// Create a new cast member
export async function createCastMember(input: CastMemberInput) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get next cast number if not provided
  let castNumber = input.castNumber;
  if (castNumber === undefined) {
    const { data: existingCast } = await supabase
      .from("CastMember")
      .select("castNumber")
      .eq("projectId", input.projectId)
      .order("castNumber", { ascending: false, nullsFirst: true })
      .limit(1);

    castNumber = (existingCast?.[0]?.castNumber ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("CastMember")
    .insert({
      projectId: input.projectId,
      characterName: input.characterName,
      actorName: input.actorName || null,
      castNumber,
      contractStart: input.contractStart || null,
      contractEnd: input.contractEnd || null,
      dropDeadDate: input.dropDeadDate || null,
      dailyRate: input.dailyRate || null,
      weeklyRate: input.weeklyRate || null,
      workStatus: input.workStatus || "ON_HOLD",
      unionAffiliation: input.unionAffiliation || null,
      email: input.email || null,
      phone: input.phone || null,
      agentName: input.agentName || null,
      agentContact: input.agentContact || null,
      notes: input.notes || null,
      hairMakeupMins: input.hairMakeupMins ?? 60,
      userId: input.userId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating cast member:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);

  return { data, error: null };
}

// Update a cast member
export async function updateCastMember(id: string, updates: Partial<CastMemberInput>) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Remove projectId from updates if present
  const { projectId, ...castUpdates } = updates;

  const { data, error } = await supabase
    .from("CastMember")
    .update({
      ...castUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating cast member:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data, error: null };
}

// Delete a cast member
export async function deleteCastMember(id: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("CastMember").delete().eq("id", id);

  if (error) {
    console.error("Error deleting cast member:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Get cast availability for a date range
export async function getCastAvailability(
  castMemberId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CastAvailability")
    .select("*")
    .eq("castMemberId", castMemberId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching cast availability:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CastAvailability[], error: null };
}

// Set cast availability for a specific date
export async function setCastAvailability(
  castMemberId: string,
  date: string,
  status: AvailabilityStatus,
  notes?: string
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Upsert availability (insert or update if exists)
  const { data, error } = await supabase
    .from("CastAvailability")
    .upsert(
      {
        castMemberId,
        date,
        status,
        notes: notes || null,
      },
      {
        onConflict: "castMemberId,date",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error setting cast availability:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CastAvailability, error: null };
}

// Bulk set cast availability for multiple dates
export async function bulkSetCastAvailability(
  castMemberId: string,
  entries: { date: string; status: AvailabilityStatus; notes?: string }[]
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const records = entries.map((entry) => ({
    castMemberId,
    date: entry.date,
    status: entry.status,
    notes: entry.notes || null,
  }));

  const { error } = await supabase
    .from("CastAvailability")
    .upsert(records, { onConflict: "castMemberId,date" });

  if (error) {
    console.error("Error bulk setting cast availability:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Get all cast members with their scene counts
export async function getCastMembersWithSceneCounts(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get cast members
  const { data: castMembers, error: castError } = await supabase
    .from("CastMember")
    .select("*")
    .eq("projectId", projectId)
    .order("castNumber", { ascending: true, nullsFirst: false });

  if (castError) {
    console.error("Error fetching cast members:", castError);
    return { data: null, error: castError.message };
  }

  // Get scene counts per cast member
  const { data: sceneCastLinks, error: sceneError } = await supabase
    .from("SceneCastMember")
    .select("castMemberId")
    .in(
      "castMemberId",
      castMembers.map((c) => c.id)
    );

  if (sceneError) {
    console.error("Error fetching scene counts:", sceneError);
    return { data: castMembers as CastMember[], error: null };
  }

  // Count scenes per cast member
  const countMap = new Map<string, number>();
  sceneCastLinks?.forEach((link) => {
    countMap.set(link.castMemberId, (countMap.get(link.castMemberId) || 0) + 1);
  });

  // Add counts to cast members
  const castWithCounts = castMembers.map((cast) => ({
    ...cast,
    sceneCount: countMap.get(cast.id) || 0,
  }));

  return { data: castWithCounts as CastMember[], error: null };
}

// Link an existing cast member to a platform user
export async function linkCastMemberToUser(castMemberId: string, linkedUserId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CastMember")
    .update({
      userId: linkedUserId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", castMemberId)
    .select()
    .single();

  if (error) {
    console.error("Error linking cast member to user:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data: data as CastMember, error: null };
}

// Get cast member by userId for a project
export async function getCastMemberByUserId(projectId: string, linkedUserId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CastMember")
    .select("*")
    .eq("projectId", projectId)
    .eq("userId", linkedUserId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine
    console.error("Error fetching cast member by userId:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CastMember | null, error: null };
}
