"use client";

import * as React from "react";
import {
  Plus,
  MoreHorizontal,
  Mail,
  UserPlus,
  Edit,
  Trash2,
  Search,
  Clock,
  RefreshCw,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getProjectMembers,
  getProjectInvites,
  inviteUserToProject,
  updateProjectMemberRole,
  removeProjectMember,
  cancelProjectInvite,
  resendProjectInvite,
  type InviteResult,
} from "@/lib/actions/project-members";
import { ProjectEditGate } from "@/components/ui/permission-gate";
import type { ProjectRole } from "@/lib/permissions";
import {
  UserSearchCombobox,
  type UserSelection,
} from "@/components/ui/user-search-combobox";

interface ProjectMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  department?: string | null;
  joinedAt: string;
  avatarUrl?: string | null;
}

interface ProjectInvite {
  id: string;
  email: string;
  role: ProjectRole;
  expiresAt: string;
  createdAt: string;
}

interface TeamSectionProps {
  projectId: string;
}

const roleConfig: Record<
  ProjectRole,
  { label: string; description: string; color: string }
> = {
  ADMIN: {
    label: "Admin",
    description: "Full project access, can manage team",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  COORDINATOR: {
    label: "Coordinator",
    description: "Can edit schedule, scenes, and assignments",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  DEPARTMENT_HEAD: {
    label: "Dept. Head",
    description: "Manages their department's resources",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  CREW: {
    label: "Crew",
    description: "View and comment on assigned items",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  CAST: {
    label: "Cast",
    description: "View call sheets and their schedule",
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  },
  VIEWER: {
    label: "Viewer",
    description: "Read-only access to project",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
};

export function TeamSection({ projectId }: TeamSectionProps) {
  const [members, setMembers] = React.useState<ProjectMember[]>([]);
  const [invites, setInvites] = React.useState<ProjectInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState<UserSelection | null>(
    null
  );
  const [inviteRole, setInviteRole] = React.useState<ProjectRole>("CREW");
  const [inviteDepartment, setInviteDepartment] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  );

  // Fetch members and invites
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        getProjectMembers(projectId),
        getProjectInvites(projectId),
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch (err) {
      console.error("Error fetching team data:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const membersByRole = React.useMemo(() => {
    const grouped: Record<ProjectRole, ProjectMember[]> = {
      ADMIN: [],
      COORDINATOR: [],
      DEPARTMENT_HEAD: [],
      CREW: [],
      CAST: [],
      VIEWER: [],
    };
    filteredMembers.forEach((member) => {
      grouped[member.role].push(member);
    });
    return grouped;
  }, [filteredMembers]);

  const handleInvite = async () => {
    if (!selectedUser) return;

    setInviting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const email =
        selectedUser.type === "existing_user"
          ? selectedUser.user.email
          : selectedUser.email;

      const result: InviteResult = await inviteUserToProject(
        projectId,
        email,
        inviteRole,
        inviteDepartment || undefined
      );

      setSuccessMessage(result.message);
      setSelectedUser(null);
      setInviteRole("CREW");
      setInviteDepartment("");
      fetchData();

      // Close modal after short delay to show success
      setTimeout(() => {
        setShowAddMember(false);
        setSuccessMessage(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleUserSelect = (selection: UserSelection) => {
    setSelectedUser(selection);
    setError(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeProjectMember(projectId, memberId);
      fetchData();
    } catch (err) {
      console.error("Error removing member:", err);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: ProjectRole) => {
    try {
      await updateProjectMemberRole(projectId, memberId, newRole);
      fetchData();
    } catch (err) {
      console.error("Error updating role:", err);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelProjectInvite(projectId, inviteId);
      fetchData();
    } catch (err) {
      console.error("Error canceling invite:", err);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await resendProjectInvite(projectId, inviteId);
      fetchData();
    } catch (err) {
      console.error("Error resending invite:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {members.length} members
          </span>
        </div>

        <ProjectEditGate projectId={projectId}>
          <Button onClick={() => setShowAddMember(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </ProjectEditGate>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              Pending Invites
            </Badge>
            <span className="text-sm text-muted-foreground">{invites.length}</span>
          </div>

          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 p-4 bg-amber-50/50"
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Invited as {roleConfig[invite.role].label}
                  </p>
                </div>

                <ProjectEditGate projectId={projectId}>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvite(invite.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </ProjectEditGate>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members by Role */}
      <div className="space-y-6">
        {(Object.keys(roleConfig) as ProjectRole[]).map((role) => {
          const roleMembers = membersByRole[role];
          if (roleMembers.length === 0) return null;

          const config = roleConfig[role];

          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {roleMembers.length}
                </span>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {roleMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <Avatar
                      alt={member.name}
                      src={member.avatarUrl ?? undefined}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>

                    {member.department && (
                      <Badge variant="secondary">{member.department}</Badge>
                    )}

                    <ProjectEditGate projectId={projectId}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ProjectEditGate>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredMembers.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No team members found</p>
        </div>
      )}

      {/* Add Member Modal */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to collaborate on this project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm">
                {successMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label>Invite to Project</Label>
              <UserSearchCombobox
                projectId={projectId}
                onSelect={handleUserSelect}
                placeholder="Search by name or enter email..."
                disabled={inviting}
              />
              {selectedUser && (
                <p className="text-sm text-muted-foreground">
                  {selectedUser.type === "existing_user"
                    ? `Selected: ${selectedUser.user.displayName || selectedUser.user.email}`
                    : `Will invite: ${selectedUser.email}`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="memberRole">Role</Label>
              <select
                id="memberRole"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
              >
                {(Object.keys(roleConfig) as ProjectRole[]).map((role) => (
                  <option key={role} value={role}>
                    {roleConfig[role].label} - {roleConfig[role].description}
                  </option>
                ))}
              </select>
            </div>

            {(inviteRole === "DEPARTMENT_HEAD" || inviteRole === "CREW") && (
              <div className="space-y-2">
                <Label htmlFor="memberDept">Department</Label>
                <select
                  id="memberDept"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={inviteDepartment}
                  onChange={(e) => setInviteDepartment(e.target.value)}
                >
                  <option value="">Select department...</option>
                  <option value="Direction">Direction</option>
                  <option value="Camera">Camera</option>
                  <option value="Sound">Sound</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Art Department">Art Department</option>
                  <option value="Costume">Costume</option>
                  <option value="Hair & Makeup">Hair & Makeup</option>
                  <option value="Locations">Locations</option>
                  <option value="Production">Production</option>
                </select>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-1">
                {roleConfig[inviteRole].label} permissions:
              </p>
              <p className="text-muted-foreground">
                {roleConfig[inviteRole].description}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setShowAddMember(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!selectedUser || inviting || !!successMessage}
              className="gap-2"
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {selectedUser?.type === "new_email"
                ? "Send Registration Invite"
                : "Send Invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
