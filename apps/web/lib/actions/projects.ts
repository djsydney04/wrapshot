"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkPlanLimit, getCurrentUserId } from "@/lib/permissions/server";
import type {
  ProjectStatus,
  CrewInvite,
  CreateProjectData,
  Project,
} from "./projects.types";

// Create a new project
export async function createProject(
  data: CreateProjectData
): Promise<Project> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Check plan limit - users on Free plan can only be part of 1 project
  const canCreate = await checkPlanLimit(userId, "projects");
  if (!canCreate) {
    throw new Error(
      "PLAN_LIMIT_REACHED:You've reached your project limit on the Free plan. Upgrade to Pro to join unlimited projects."
    );
  }

  // Get or create user's organization
  const { data: orgId, error: orgError } = await supabase.rpc(
    "get_or_create_user_organization",
    { user_id: userId }
  );

  if (orgError || !orgId) {
    console.error("Error getting/creating organization:", orgError);
    throw new Error("Failed to set up workspace");
  }

  // Create the project
  const { data: project, error: projectError } = await supabase
    .from("Project")
    .insert({
      organizationId: orgId,
      name: data.name,
      description: data.description || null,
      status: data.status || "DEVELOPMENT",
      startDate: data.startDate || null,
      endDate: data.endDate || null,
    })
    .select()
    .single();

  if (projectError) {
    console.error("Error creating project:", projectError);
    throw new Error("Failed to create project");
  }

  // Add creator as ADMIN of the project
  const { error: memberError } = await supabase.from("ProjectMember").insert({
    projectId: project.id,
    userId,
    role: "ADMIN",
  });

  if (memberError) {
    console.error("Error adding project member:", memberError);
    // Try to clean up the project
    await supabase.from("Project").delete().eq("id", project.id);
    throw new Error("Failed to create project");
  }

  // Create project invites for crew members
  if (data.crewInvites && data.crewInvites.length > 0) {
    const invites = data.crewInvites.map((invite) => ({
      projectId: project.id,
      email: invite.email,
      role: invite.role,
      invitedBy: userId,
    }));

    const { error: inviteError } = await supabase
      .from("ProjectInvite")
      .insert(invites);

    if (inviteError) {
      console.error("Error creating project invites:", inviteError);
      // Non-fatal - project is still created, just invites failed
    }
  }

  revalidatePath("/projects");

  return {
    ...project,
    scenesCount: 0,
    shootingDaysCount: 0,
    castCount: 0,
    locationsCount: 0,
  };
}

// Get all projects for the current user
export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Debug: Check what org the user belongs to and how many projects exist
  const { data: debugData } = await supabase.rpc("debug_user_projects", {
    user_id: userId,
  });
  if (debugData) {
    console.log("[getProjects] Debug info:", debugData);
  }

  // Get projects the user is a member of
  const { data, error } = await supabase
    .from("ProjectMember")
    .select(
      `
      project:Project (
        id,
        organizationId,
        name,
        description,
        status,
        startDate,
        endDate,
        createdAt,
        updatedAt
      )
    `
    )
    .eq("userId", userId);

  if (error) {
    console.error("[getProjects] Error fetching projects:", error);
    console.error("[getProjects] userId:", userId);
    return [];
  }

  console.log("[getProjects] Found memberships:", data?.length ?? 0);

  // Type for the joined project data
  type ProjectData = {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    updatedAt: string;
  };

  // Extract projects and add computed counts
  const projectData = (data || [])
    .map((d) => d.project as unknown as ProjectData | null)
    .filter((p): p is ProjectData => p !== null);

  const projects = await Promise.all(
    projectData.map(async (project) => {
      // Get counts for each project
      const [scenesResult, daysResult, castResult, locationsResult] =
        await Promise.all([
          supabase
            .from("Scene")
            .select("id", { count: "exact", head: true })
            .eq("projectId", project.id),
          supabase
            .from("ShootingDay")
            .select("id", { count: "exact", head: true })
            .eq("projectId", project.id),
          supabase
            .from("CastMember")
            .select("id", { count: "exact", head: true })
            .eq("projectId", project.id),
          supabase
            .from("Location")
            .select("id", { count: "exact", head: true })
            .eq("projectId", project.id),
        ]);

      return {
        ...project,
        scenesCount: scenesResult.count || 0,
        shootingDaysCount: daysResult.count || 0,
        castCount: castResult.count || 0,
        locationsCount: locationsResult.count || 0,
      } as Project;
    })
  );

  return projects;
}

// Get a single project by ID
export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Check if user is a member of this project
  const { data: membership } = await supabase
    .from("ProjectMember")
    .select("role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (!membership) {
    return null; // User doesn't have access
  }

  // Get the project
  const { data: project, error } = await supabase
    .from("Project")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    return null;
  }

  // Get counts
  const [scenesResult, daysResult, castResult, locationsResult] =
    await Promise.all([
      supabase
        .from("Scene")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
      supabase
        .from("ShootingDay")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
      supabase
        .from("CastMember")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
      supabase
        .from("Location")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
    ]);

  return {
    ...project,
    scenesCount: scenesResult.count || 0,
    shootingDaysCount: daysResult.count || 0,
    castCount: castResult.count || 0,
    locationsCount: locationsResult.count || 0,
  } as Project;
}

// Update a project
export async function updateProject(
  projectId: string,
  data: Partial<CreateProjectData>
): Promise<Project> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Check if user has admin access
  const { data: membership } = await supabase
    .from("ProjectMember")
    .select("role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (!membership || !["ADMIN", "COORDINATOR"].includes(membership.role)) {
    throw new Error("You don't have permission to edit this project");
  }

  const { data: project, error } = await supabase
    .from("Project")
    .update({
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status && { status: data.status }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error || !project) {
    console.error("Error updating project:", error);
    throw new Error("Failed to update project");
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");

  // Get counts
  const [scenesResult, daysResult, castResult, locationsResult] =
    await Promise.all([
      supabase
        .from("Scene")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
      supabase
        .from("ShootingDay")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
      supabase
        .from("CastMember")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
      supabase
        .from("Location")
        .select("id", { count: "exact", head: true })
        .eq("projectId", projectId),
    ]);

  return {
    ...project,
    scenesCount: scenesResult.count || 0,
    shootingDaysCount: daysResult.count || 0,
    castCount: castResult.count || 0,
    locationsCount: locationsResult.count || 0,
  } as Project;
}

// Delete a project
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Check if user has admin access
  const { data: membership } = await supabase
    .from("ProjectMember")
    .select("role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (!membership || membership.role !== "ADMIN") {
    throw new Error("You don't have permission to delete this project");
  }

  const { error } = await supabase.from("Project").delete().eq("id", projectId);

  if (error) {
    console.error("Error deleting project:", error);
    throw new Error("Failed to delete project");
  }

  revalidatePath("/projects");
}

// Get project count for user (for billing checks)
export async function getProjectCount(userId: string): Promise<number> {
  const supabase = await createClient();

  // Count projects where user is a member
  const { count, error } = await supabase
    .from("ProjectMember")
    .select("id", { count: "exact", head: true })
    .eq("userId", userId);

  if (error) {
    console.error("Error counting projects:", error);
    return 0;
  }

  return count || 0;
}
