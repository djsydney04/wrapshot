"use client";

import * as React from "react";
import {
  Plus,
  MoreHorizontal,
  Mail,
  UserPlus,
  Shield,
  Camera,
  Eye,
  Edit,
  Trash2,
  Search,
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

type ProjectRole = "ADMIN" | "COORDINATOR" | "DEPARTMENT_HEAD" | "CREW" | "CAST" | "VIEWER";

interface ProjectMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  department?: string;
  joinedAt: string;
  avatarUrl?: string;
}

interface TeamSectionProps {
  projectId: string;
}

const mockProjectMembers: ProjectMember[] = [
  {
    id: "pm-1",
    userId: "user-1",
    name: "Sofia Laurent",
    email: "sofia@production.com",
    role: "ADMIN",
    joinedAt: "2024-01-15",
  },
  {
    id: "pm-2",
    userId: "user-2",
    name: "David Chen",
    email: "david.chen@studioexec.com",
    role: "COORDINATOR",
    joinedAt: "2024-02-20",
  },
  {
    id: "pm-3",
    userId: "user-3",
    name: "Jean-Pierre Martin",
    email: "jp.martin@cinematography.fr",
    role: "DEPARTMENT_HEAD",
    department: "Camera",
    joinedAt: "2024-02-25",
  },
  {
    id: "pm-4",
    userId: "user-4",
    name: "Marcus Webb",
    email: "marcus.webb@production.com",
    role: "CREW",
    department: "Direction",
    joinedAt: "2024-03-01",
  },
  {
    id: "pm-5",
    userId: "user-5",
    name: "Michael Chen",
    email: "michael.chen@agency.com",
    role: "CAST",
    joinedAt: "2024-03-05",
  },
  {
    id: "pm-6",
    userId: "user-6",
    name: "Client Viewer",
    email: "client@studio.com",
    role: "VIEWER",
    joinedAt: "2024-03-10",
  },
];

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
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<ProjectRole>("CREW");
  const [inviteDepartment, setInviteDepartment] = React.useState("");

  const filteredMembers = mockProjectMembers.filter(
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

  const handleInvite = () => {
    // TODO: Implement invite
    console.log("Inviting", inviteEmail, "as", inviteRole, "to project", projectId);
    setShowAddMember(false);
    setInviteEmail("");
    setInviteRole("CREW");
    setInviteDepartment("");
  };

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
            {mockProjectMembers.length} members
          </span>
        </div>

        <Button onClick={() => setShowAddMember(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Members by Role */}
      <div className="space-y-6">
        {(Object.keys(roleConfig) as ProjectRole[]).map((role) => {
          const members = membersByRole[role];
          if (members.length === 0) return null;

          const config = roleConfig[role];

          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {members.length}
                </span>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <Avatar alt={member.name} size="md" />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>

                    {member.department && (
                      <Badge variant="secondary">{member.department}</Badge>
                    )}

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
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove from Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
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

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="memberEmail">Email Address</Label>
              <Input
                id="memberEmail"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
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

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAddMember(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail} className="gap-2">
              <Mail className="h-4 w-4" />
              Send Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
