"use client";

import * as React from "react";
import { Shield, ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectPermissionGate } from "@/components/ui/permission-gate";
import {
  grantCrewMemberAccess,
  updateCrewMemberAccess,
  revokeCrewMemberAccess,
} from "@/lib/actions/crew-access";
import {
  inviteCrewMember,
  resendCastCrewInvite,
} from "@/lib/actions/cast-crew-invites";
import type { ProjectRole } from "@/lib/permissions";
import {
  PROJECT_ROLE_LABELS,
  PROJECT_ROLE_COLORS,
} from "@/lib/permissions";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";

interface CrewAccessPanelProps {
  member: CrewMemberWithInviteStatus;
  projectId: string;
  onAccessChanged?: () => void;
}

const ASSIGNABLE_ROLES: ProjectRole[] = [
  "ADMIN",
  "COORDINATOR",
  "DEPARTMENT_HEAD",
  "CREW",
  "CAST",
  "VIEWER",
];

export function CrewAccessPanel({
  member,
  projectId,
  onAccessChanged,
}: CrewAccessPanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<ProjectRole>(
    member.projectRole || "CREW"
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedRole(member.projectRole || "CREW");
    setError(null);
  }, [member.projectRole]);

  const handleGrantAccess = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await grantCrewMemberAccess(member.id, projectId, selectedRole);
      if (result.error) {
        setError(result.error);
      } else {
        onAccessChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (newRole: ProjectRole) => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateCrewMemberAccess(member.id, projectId, newRole);
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedRole(newRole);
        onAccessChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!confirm("Remove this person's platform access to this project?")) return;
    setLoading(true);
    setError(null);
    try {
      const result = await revokeCrewMemberAccess(member.id, projectId);
      if (result.error) {
        setError(result.error);
      } else {
        onAccessChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await inviteCrewMember(member.id, projectId);
      if (!result.success) {
        setError("Failed to send invite");
      } else {
        onAccessChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvite = async () => {
    if (!member.inviteId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await resendCastCrewInvite(member.inviteId, projectId);
      if (!result.success) {
        setError("Failed to resend invite");
      } else {
        onAccessChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    // State 1: No account, no invite sent
    if (member.inviteStatus === "no_account") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>No platform account</span>
          </div>
          {member.email ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendInvite}
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Platform Invite
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add an email address to send a platform invite.
            </p>
          )}
        </div>
      );
    }

    // State 2: Invite pending
    if (member.inviteStatus === "invite_sent" || member.inviteStatus === "invite_expired") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="text-amber-600">
              {member.inviteStatus === "invite_sent" ? "Invite pending" : "Invite expired"}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResendInvite}
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Resend Invite
          </Button>
        </div>
      );
    }

    // State 3: Linked but no project access
    if (member.inviteStatus === "linked" && !member.projectRole) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Has account, no project access</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
              disabled={loading}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {PROJECT_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleGrantAccess}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant Access"}
            </Button>
          </div>
        </div>
      );
    }

    // State 4: Has access
    if (member.projectRole) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-600">Has platform access</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              value={member.projectRole}
              onChange={(e) => handleUpdateRole(e.target.value as ProjectRole)}
              disabled={loading}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {PROJECT_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRevokeAccess}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <ProjectPermissionGate projectId={projectId} permission="project:manage-team">
      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Access & Permissions
        </h3>
        <div className="rounded-lg border border-border p-3">
          {renderContent()}
          {error && (
            <p className="text-xs text-destructive mt-2">{error}</p>
          )}
        </div>
      </div>
    </ProjectPermissionGate>
  );
}
