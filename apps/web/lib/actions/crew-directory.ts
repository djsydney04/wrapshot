"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import type { DepartmentType } from "./crew";

export interface DirectoryCrewMember {
  id: string;
  name: string;
  role: string;
  department: DepartmentType;
  email: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  userId: string | null;
  projectId: string;
  projectName: string;
}

// Search crew members across all projects the user has access to (excluding current project)
export async function searchCrewDirectory(
  query: string,
  currentProjectId: string
): Promise<{ data: DirectoryCrewMember[] | null; error: string | null }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  if (!query || query.trim().length < 2) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const searchQuery = query.trim().toLowerCase();

  // Get project IDs the current user is a member of
  const { data: memberProjects } = await supabase
    .from("ProjectMember")
    .select("projectId")
    .eq("userId", userId);

  const projectIds = (memberProjects || [])
    .map((p) => p.projectId)
    .filter((id) => id !== currentProjectId);

  if (projectIds.length === 0) {
    return { data: [], error: null };
  }

  // Search crew members in those projects
  const { data: crewMembers, error } = await supabase
    .from("CrewMember")
    .select("id, name, role, department, email, phone, profilePhotoUrl, userId, projectId")
    .in("projectId", projectIds)
    .or(`name.ilike.%${searchQuery}%,role.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
    .order("name")
    .limit(50);

  if (error) {
    return { data: null, error: error.message };
  }

  if (!crewMembers || crewMembers.length === 0) {
    return { data: [], error: null };
  }

  // Get project names for context
  const uniqueProjectIds = [...new Set(crewMembers.map((c) => c.projectId))];
  const { data: projects } = await supabase
    .from("Project")
    .select("id, name")
    .in("id", uniqueProjectIds);

  const projectNameMap = new Map(projects?.map((p) => [p.id, p.name]) || []);

  // Dedupe by email or userId (keep first occurrence)
  const seen = new Set<string>();
  const deduped: DirectoryCrewMember[] = [];

  for (const member of crewMembers) {
    const key = member.userId || member.email || member.id;
    if (seen.has(key)) continue;
    seen.add(key);

    deduped.push({
      ...member,
      department: member.department as DepartmentType,
      projectName: projectNameMap.get(member.projectId) || "Unknown Project",
    });
  }

  return { data: deduped, error: null };
}
