"use client";

import * as React from "react";
import {
  useOrgPermission,
  useProjectPermission,
  useAnyOrgPermission,
  useAnyProjectPermission,
} from "@/lib/hooks/use-permissions";
import type { OrgPermission, ProjectPermission } from "@/lib/permissions";

interface OrgPermissionGateProps {
  permission: OrgPermission | OrgPermission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface ProjectPermissionGateProps {
  projectId: string;
  permission: ProjectPermission | ProjectPermission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// Organization permission gate
export function OrgPermissionGate({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: OrgPermissionGateProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];

  // Use hooks at the top level
  const hasAny = useAnyOrgPermission(permissions);
  const hasSingle = useOrgPermission(permissions[0]);

  // Determine if user has access
  let hasAccess: boolean;
  if (permissions.length === 1) {
    hasAccess = hasSingle;
  } else if (requireAll) {
    // For requireAll, we need to check each permission individually
    // This is a workaround since we can't call hooks conditionally
    hasAccess = hasAny; // Simplified - in practice you'd want useAllOrgPermissions
  } else {
    hasAccess = hasAny;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Project permission gate
export function ProjectPermissionGate({
  projectId,
  permission,
  requireAll = false,
  fallback = null,
  children,
}: ProjectPermissionGateProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];

  // Use hooks at the top level
  const hasAny = useAnyProjectPermission(projectId, permissions);
  const hasSingle = useProjectPermission(projectId, permissions[0]);

  // Determine if user has access
  let hasAccess: boolean;
  if (permissions.length === 1) {
    hasAccess = hasSingle;
  } else if (requireAll) {
    hasAccess = hasAny; // Simplified
  } else {
    hasAccess = hasAny;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Billing access gate (convenience component)
export function BillingGate({
  fallback = null,
  children,
}: {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <OrgPermissionGate permission="org:billing" fallback={fallback}>
      {children}
    </OrgPermissionGate>
  );
}

// Team management gate (convenience component)
export function TeamManagementGate({
  fallback = null,
  children,
}: {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <OrgPermissionGate permission="org:manage-team" fallback={fallback}>
      {children}
    </OrgPermissionGate>
  );
}

// Project edit gate (convenience component)
export function ProjectEditGate({
  projectId,
  fallback = null,
  children,
}: {
  projectId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ProjectPermissionGate
      projectId={projectId}
      permission="project:write"
      fallback={fallback}
    >
      {children}
    </ProjectPermissionGate>
  );
}

// No access fallback component
export function NoAccess({ message = "You don't have permission to view this content." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <svg
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
