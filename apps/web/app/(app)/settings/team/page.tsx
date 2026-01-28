"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  MoreHorizontal,
  Mail,
  Crown,
  UserCog,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SettingsLayout,
  SettingsCard,
} from "@/components/layout/settings-layout";
import { TeamManagementGate, NoAccess } from "@/components/ui/permission-gate";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: "active" | "pending";
  joinedAt?: string;
}

const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Sofia Laurent",
    email: "sofia@production.com",
    role: "OWNER",
    status: "active",
    joinedAt: "2024-01-15",
  },
  {
    id: "2",
    name: "David Chen",
    email: "david.chen@studioexec.com",
    role: "ADMIN",
    status: "active",
    joinedAt: "2024-02-20",
  },
  {
    id: "3",
    name: "Marcus Webb",
    email: "marcus.webb@production.com",
    role: "MEMBER",
    status: "active",
    joinedAt: "2024-03-10",
  },
  {
    id: "4",
    name: "Pending User",
    email: "pending@example.com",
    role: "MEMBER",
    status: "pending",
  },
];

const roleConfig = {
  OWNER: {
    label: "Owner",
    icon: Crown,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  ADMIN: {
    label: "Admin",
    icon: UserCog,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  MEMBER: {
    label: "Member",
    icon: Eye,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

function TeamPageContent() {
  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"ADMIN" | "MEMBER">("MEMBER");

  const handleInvite = () => {
    console.log("Inviting", inviteEmail, "as", inviteRole);
    setShowInvite(false);
    setInviteEmail("");
  };

  return (
    <>
      {/* Team Members */}
      <SettingsCard>
        <div className="divide-y divide-border">
          {mockTeamMembers.map((member) => {
            const role = roleConfig[member.role];
            const RoleIcon = role.icon;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="relative">
                  <Avatar alt={member.name} size="sm" />
                  {member.status === "pending" && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-amber-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{member.name}</p>
                    {member.status === "pending" && (
                      <span className="text-xs text-amber-600 font-medium">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {member.email}
                  </p>
                </div>

                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  role.bg, role.color
                )}>
                  <RoleIcon className="h-3 w-3" />
                  {role.label}
                </div>

                {member.role !== "OWNER" && (
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Roles Explanation */}
      <div>
        <h2 className="text-sm font-medium mb-3">Roles & Permissions</h2>
        <div className="grid gap-3">
          {Object.entries(roleConfig).map(([key, config]) => {
            const Icon = config.icon;
            const descriptions: Record<string, string> = {
              OWNER: "Full access to all settings, billing, and team management",
              ADMIN: "Can manage projects and team members, no billing access",
              MEMBER: "Can view and edit projects they're assigned to",
            };

            return (
              <div
                key={key}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md",
                  config.bg
                )}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{config.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {descriptions[key]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteRole" className="text-sm font-medium">
                  Role
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["ADMIN", "MEMBER"] as const).map((role) => {
                    const config = roleConfig[role];
                    const Icon = config.icon;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setInviteRole(role)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                          inviteRole === role
                            ? "border-foreground bg-muted"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md",
                          inviteRole === role ? "bg-foreground text-background" : "bg-muted"
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{config.label}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TeamSettingsPage() {
  const [showInvite, setShowInvite] = React.useState(false);

  return (
    <SettingsLayout
      title="Team"
      description="Manage who has access to your organization"
      breadcrumbs={[{ label: "Settings" }, { label: "Team" }]}
      actions={
        <TeamManagementGate>
          <Button onClick={() => setShowInvite(true)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        </TeamManagementGate>
      }
    >
      <TeamManagementGate
        fallback={<NoAccess message="You don't have permission to manage team members." />}
      >
        <TeamPageContent />
      </TeamManagementGate>
    </SettingsLayout>
  );
}
