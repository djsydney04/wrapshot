// Permission system for wrapshoot
// Defines permissions and role mappings for project access

export type ProjectPermission =
  | "project:read"
  | "project:write"
  | "project:delete"
  | "project:manage-team"
  | "schedule:read"
  | "schedule:write"
  | "cast:read"
  | "cast:write"
  | "crew:read"
  | "crew:write"
  | "scenes:read"
  | "scenes:write"
  | "locations:read"
  | "locations:write"
  | "budget:read"
  | "budget:write";

export type Permission = ProjectPermission;

// Project roles (from Prisma schema)
export type ProjectRole =
  | "ADMIN"
  | "COORDINATOR"
  | "DEPARTMENT_HEAD"
  | "CREW"
  | "CAST"
  | "VIEWER";

// Project role permissions
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermission[]> = {
  ADMIN: [
    "project:read",
    "project:write",
    "project:delete",
    "project:manage-team",
    "schedule:read",
    "schedule:write",
    "cast:read",
    "cast:write",
    "crew:read",
    "crew:write",
    "scenes:read",
    "scenes:write",
    "locations:read",
    "locations:write",
    "budget:read",
    "budget:write",
  ],
  COORDINATOR: [
    "project:read",
    "project:write",
    "project:manage-team",
    "schedule:read",
    "schedule:write",
    "cast:read",
    "cast:write",
    "crew:read",
    "crew:write",
    "scenes:read",
    "scenes:write",
    "locations:read",
    "locations:write",
    "budget:read",
    "budget:write",
  ],
  DEPARTMENT_HEAD: [
    "project:read",
    "schedule:read",
    "schedule:write",
    "cast:read",
    "crew:read",
    "crew:write",
    "scenes:read",
    "locations:read",
    "budget:read",
  ],
  CREW: [
    "project:read",
    "schedule:read",
    "cast:read",
    "crew:read",
    "scenes:read",
    "locations:read",
  ],
  CAST: [
    "project:read",
    "schedule:read",
    "cast:read",
    "scenes:read",
  ],
  VIEWER: [
    "project:read",
    "schedule:read",
    "cast:read",
    "crew:read",
    "scenes:read",
    "locations:read",
  ],
};

// Check if project role has permission
export function projectRoleHasPermission(
  role: ProjectRole | null | undefined,
  permission: ProjectPermission
): boolean {
  if (!role) return false;
  return PROJECT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Get all permissions for project role
export function getProjectPermissions(role: ProjectRole | null | undefined): ProjectPermission[] {
  if (!role) return [];
  return PROJECT_ROLE_PERMISSIONS[role] ?? [];
}

// Role display names
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: "Admin",
  COORDINATOR: "Coordinator",
  DEPARTMENT_HEAD: "Department Head",
  CREW: "Crew",
  CAST: "Cast",
  VIEWER: "Viewer",
};

// Role descriptions
export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  ADMIN: "Full access to all project features and settings",
  COORDINATOR: "Can manage schedules, cast, crew, and scenes",
  DEPARTMENT_HEAD: "Can manage their department's crew and schedules",
  CREW: "Can view project details and schedules",
  CAST: "Can view their call times and scenes",
  VIEWER: "Read-only access to project information",
};
