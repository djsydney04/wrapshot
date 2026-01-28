"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  Building2,
  Plus,
  MoreHorizontal,
  Mail,
  Crown,
  UserCog,
  Eye,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { label: "Profile", href: "/settings", icon: User, description: "Your personal info" },
  { label: "Organization", href: "/settings/organization", icon: Building2, description: "Company settings" },
  { label: "Team", href: "/settings/team", icon: Users, description: "Manage members" },
  { label: "Notifications", href: "/settings/notifications", icon: Bell, description: "Alert preferences" },
  { label: "Billing", href: "/settings/billing", icon: CreditCard, description: "Plans & invoices" },
  { label: "Security", href: "/settings/security", icon: Shield, description: "Password & 2FA" },
];

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
    color: "text-accent-amber",
    bg: "bg-accent-amber-soft",
  },
  ADMIN: {
    label: "Admin",
    icon: UserCog,
    color: "text-accent-blue",
    bg: "bg-accent-blue-soft",
  },
  MEMBER: {
    label: "Member",
    icon: Eye,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

export default function TeamSettingsPage() {
  const pathname = usePathname();
  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"ADMIN" | "MEMBER">("MEMBER");

  const handleInvite = () => {
    console.log("Inviting", inviteEmail, "as", inviteRole);
    setShowInvite(false);
    setInviteEmail("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 gradient-mesh opacity-50 pointer-events-none" />
      <div className="grain-page" />

      <Header breadcrumbs={[{ label: "Settings" }, { label: "Team" }]} />

      <div className="flex-1 overflow-auto relative">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex gap-12">
            {/* Sidebar Nav */}
            <nav className="w-56 shrink-0">
              <div className="sticky top-6 space-y-1">
                {settingsNav.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200",
                        isActive
                          ? "bg-accent-blue-soft shadow-soft"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        isActive
                          ? "bg-accent-blue text-white"
                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground/50 transition-transform",
                        isActive && "text-accent-blue"
                      )} />
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
                  <p className="text-muted-foreground mt-1">
                    Manage who has access to your organization
                  </p>
                </div>
                <Button onClick={() => setShowInvite(true)} className="gap-2 rounded-xl">
                  <Plus className="h-4 w-4" />
                  Invite Member
                </Button>
              </div>

              {/* Team Members */}
              <div className="card-premium">
                <div className="divide-y divide-border/50">
                  {mockTeamMembers.map((member, index) => {
                    const role = roleConfig[member.role];
                    const RoleIcon = role.icon;

                    return (
                      <div
                        key={member.id}
                        className={cn(
                          "flex items-center gap-4 p-5 transition-colors hover:bg-muted/30",
                          index === 0 && "rounded-t-2xl",
                          index === mockTeamMembers.length - 1 && "rounded-b-2xl"
                        )}
                      >
                        <div className="relative">
                          <Avatar alt={member.name} size="md" />
                          {member.status === "pending" && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent-amber" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.name}</p>
                            {member.status === "pending" && (
                              <span className="text-xs text-accent-amber font-medium">
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>

                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                          role.bg, role.color
                        )}>
                          <RoleIcon className="h-3.5 w-3.5" />
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
              </div>

              {/* Roles Explanation */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Roles & Permissions</h2>
                <div className="grid gap-4">
                  {Object.entries(roleConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    const descriptions: Record<string, string> = {
                      OWNER: "Full access to all settings, billing, and team management. Can transfer ownership.",
                      ADMIN: "Can manage projects, team members, and most settings. Cannot access billing or delete organization.",
                      MEMBER: "Can view and edit projects they're assigned to. Cannot manage team or settings.",
                    };

                    return (
                      <div
                        key={key}
                        className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/50 hover:shadow-soft transition-shadow"
                      >
                        <div className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl",
                          config.bg
                        )}>
                          <Icon className={cn("h-5 w-5", config.color)} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{config.label}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {descriptions[key]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue-soft">
                <Sparkles className="h-5 w-5 text-accent-blue" />
              </div>
              <div>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-5">
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
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteRole" className="text-sm font-medium">
                  Role
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["ADMIN", "MEMBER"] as const).map((role) => {
                    const config = roleConfig[role];
                    const Icon = config.icon;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setInviteRole(role)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                          inviteRole === role
                            ? "border-accent-blue bg-accent-blue-soft"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          inviteRole === role ? "bg-accent-blue text-white" : "bg-muted"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{config.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {role === "ADMIN" ? "Manage projects & team" : "View & edit projects"}
                          </p>
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
              className="gap-2 rounded-xl"
            >
              <Mail className="h-4 w-4" />
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
