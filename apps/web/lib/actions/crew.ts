"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export type DepartmentType =
  | "PRODUCTION"
  | "DIRECTION"
  | "CAMERA"
  | "SOUND"
  | "LIGHTING"
  | "ART"
  | "COSTUME"
  | "HAIR_MAKEUP"
  | "LOCATIONS"
  | "STUNTS"
  | "VFX"
  | "TRANSPORTATION"
  | "CATERING"
  | "ACCOUNTING"
  | "POST_PRODUCTION";

export interface CrewMemberInput {
  projectId: string;
  name: string;
  role: string;
  department: DepartmentType;
  email?: string;
  phone?: string;
  isHead?: boolean;
  profilePhotoUrl?: string;
  userId?: string; // Optional link to platform user
}

export interface CrewMember {
  id: string;
  projectId: string;
  userId: string | null;
  name: string;
  role: string;
  department: DepartmentType;
  email: string | null;
  phone: string | null;
  isHead: boolean;
  profilePhotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Fetch all crew members for a project
export async function getCrewMembers(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CrewMember")
    .select("*")
    .eq("projectId", projectId)
    .order("department", { ascending: true })
    .order("isHead", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching crew members:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CrewMember[], error: null };
}

// Get a single crew member
export async function getCrewMember(crewMemberId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CrewMember")
    .select("*")
    .eq("id", crewMemberId)
    .single();

  if (error) {
    console.error("Error fetching crew member:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CrewMember, error: null };
}

// Create a new crew member
export async function createCrewMember(input: CrewMemberInput) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CrewMember")
    .insert({
      projectId: input.projectId,
      name: input.name,
      role: input.role,
      department: input.department,
      email: input.email || null,
      phone: input.phone || null,
      isHead: input.isHead ?? false,
      profilePhotoUrl: input.profilePhotoUrl || null,
      userId: input.userId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating crew member:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);

  return { data: data as CrewMember, error: null };
}

// Update a crew member
export async function updateCrewMember(id: string, updates: Partial<CrewMemberInput>) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Remove projectId from updates if present
  const { projectId, ...crewUpdates } = updates;

  const { data, error } = await supabase
    .from("CrewMember")
    .update({
      ...crewUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating crew member:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data: data as CrewMember, error: null };
}

// Delete a crew member
export async function deleteCrewMember(id: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("CrewMember").delete().eq("id", id);

  if (error) {
    console.error("Error deleting crew member:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Link an existing crew member to a platform user
export async function linkCrewMemberToUser(crewMemberId: string, linkedUserId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CrewMember")
    .update({
      userId: linkedUserId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", crewMemberId)
    .select()
    .single();

  if (error) {
    console.error("Error linking crew member to user:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data: data as CrewMember, error: null };
}

// Get crew member by userId for a project
export async function getCrewMemberByUserId(projectId: string, linkedUserId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("CrewMember")
    .select("*")
    .eq("projectId", projectId)
    .eq("userId", linkedUserId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine
    console.error("Error fetching crew member by userId:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CrewMember | null, error: null };
}

// Get crew members grouped by department
export async function getCrewMembersByDepartment(projectId: string) {
  const { data, error } = await getCrewMembers(projectId);

  if (error || !data) {
    return { data: null, error };
  }

  // Group by department
  const grouped = data.reduce(
    (acc, member) => {
      if (!acc[member.department]) {
        acc[member.department] = [];
      }
      acc[member.department].push(member);
      return acc;
    },
    {} as Record<DepartmentType, CrewMember[]>
  );

  return { data: grouped, error: null };
}
