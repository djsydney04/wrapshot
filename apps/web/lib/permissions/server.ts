// Server-side permission checking utilities
import { createClient } from "@/lib/supabase/server";
import {
  type ProjectRole,
  type ProjectPermission,
  projectRoleHasPermission,
} from "./index";

// Get current user's ID from Supabase auth
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Get user's role in a project
export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectMember")
    .select("role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as ProjectRole;
}

// Check if user has project permission
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permission: ProjectPermission
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return projectRoleHasPermission(role, permission);
}

// Require project permission - throws error if not authorized
export async function requireProjectPermission(
  projectId: string,
  permission: ProjectPermission
): Promise<{ userId: string; role: ProjectRole }> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Unauthorized: Not logged in");
  }

  const role = await getUserProjectRole(userId, projectId);

  if (!role) {
    throw new Error("Unauthorized: Not a member of this project");
  }

  if (!projectRoleHasPermission(role, permission)) {
    throw new Error(`Unauthorized: Missing permission ${permission}`);
  }

  return { userId, role };
}

// Get user's project memberships
export async function getUserProjects(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectMember")
    .select(
      `
      role,
      project:Project (
        id,
        name,
        ownerId,
        status
      )
    `
    )
    .eq("userId", userId);

  if (error) {
    console.error("Error fetching user projects:", error);
    return [];
  }

  return data?.map((m) => ({
    ...m.project,
    role: m.role as ProjectRole,
  })) ?? [];
}

// Get user's subscription status
export async function getUserSubscription(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("Subscription")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      plan: "FREE" as const,
      status: "ACTIVE" as const,
      trialEndsAt: null,
    };
  }

  return data;
}

// Check if action is allowed by plan (e.g., can user join another project?)
export async function checkPlanLimit(
  userId: string,
  limitType: "projects"
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_user_plan_limit", {
    user_id: userId,
    limit_type: limitType,
  });

  if (error) {
    console.error("Error checking plan limit:", error);
    return false;
  }

  return data ?? false;
}
