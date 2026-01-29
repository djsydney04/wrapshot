"use client";

import { useAuth } from "@/components/providers/auth-provider";
import {
  type ProjectRole,
  type ProjectPermission,
  projectRoleHasPermission,
} from "@/lib/permissions";

// Get user's role in a specific project
export function useProjectRole(projectId: string): ProjectRole | null {
  const { projectRoles } = useAuth();
  return projectRoles[projectId] ?? null;
}

// Check if user has project permission
export function useProjectPermission(
  projectId: string,
  permission: ProjectPermission
): boolean {
  const role = useProjectRole(projectId);
  return projectRoleHasPermission(role, permission);
}

// Check multiple project permissions (returns true if user has ANY of them)
export function useAnyProjectPermission(
  projectId: string,
  permissions: ProjectPermission[]
): boolean {
  const role = useProjectRole(projectId);
  return permissions.some((p) => projectRoleHasPermission(role, p));
}

// Check multiple project permissions (returns true if user has ALL of them)
export function useAllProjectPermissions(
  projectId: string,
  permissions: ProjectPermission[]
): boolean {
  const role = useProjectRole(projectId);
  return permissions.every((p) => projectRoleHasPermission(role, p));
}

// Check if user can manage project team
export function useCanManageProjectTeam(projectId: string): boolean {
  return useProjectPermission(projectId, "project:manage-team");
}

// Check if user can edit project
export function useCanEditProject(projectId: string): boolean {
  return useProjectPermission(projectId, "project:write");
}

// Check if user can delete project
export function useCanDeleteProject(projectId: string): boolean {
  return useProjectPermission(projectId, "project:delete");
}

// Check if user can view budget
export function useCanViewBudget(projectId: string): boolean {
  return useProjectPermission(projectId, "budget:read");
}

// Check if user can edit budget
export function useCanEditBudget(projectId: string): boolean {
  return useProjectPermission(projectId, "budget:write");
}

// Check subscription status
export function useSubscription() {
  const { subscription } = useAuth();
  return subscription;
}

// Check if on free plan
export function useIsFreePlan(): boolean {
  const subscription = useSubscription();
  return subscription?.plan === "FREE" || !subscription;
}

// Check if on pro or better
export function useIsProOrBetter(): boolean {
  const subscription = useSubscription();
  return subscription?.plan === "PRO" || subscription?.plan === "STUDIO";
}

// Check if on studio plan
export function useIsStudioPlan(): boolean {
  const subscription = useSubscription();
  return subscription?.plan === "STUDIO";
}

// Check if in trial
export function useIsInTrial(): boolean {
  const subscription = useSubscription();
  return subscription?.status === "TRIALING";
}
