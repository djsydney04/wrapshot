"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ProjectCard, ProjectsEmptyState } from "@/components/projects/project-card";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { getProjects } from "@/lib/actions/projects";
import { getMyPendingProjectInvites } from "@/lib/actions/project-members";
import { getMyPendingCastCrewInvites } from "@/lib/actions/cast-crew-invites";
import type { Project } from "@/lib/actions/projects.types";
import {
  Plus,
  Loader2,
  Settings,
  LogOut,
  ChevronDown,
  User,
  CreditCard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";

export default function ProjectsDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [pendingProjectInvites, setPendingProjectInvites] = React.useState<
    Awaited<ReturnType<typeof getMyPendingProjectInvites>>
  >([]);
  const [pendingCastCrewInvites, setPendingCastCrewInvites] = React.useState<
    Awaited<ReturnType<typeof getMyPendingCastCrewInvites>>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProjects() {
      try {
        const [projectData, projectInviteData, castCrewInviteData] = await Promise.all([
          getProjects(),
          getMyPendingProjectInvites(),
          getMyPendingCastCrewInvites(),
        ]);
        setProjects(projectData);
        setPendingProjectInvites(projectInviteData);
        setPendingCastCrewInvites(castCrewInviteData);
      } catch (err) {
        console.error("Error loading projects:", err);
        setError("Failed to load projects");
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  const reloadProjects = async () => {
    try {
      const [projectData, projectInviteData, castCrewInviteData] = await Promise.all([
        getProjects(),
        getMyPendingProjectInvites(),
        getMyPendingCastCrewInvites(),
      ]);
      setProjects(projectData);
      setPendingProjectInvites(projectInviteData);
      setPendingCastCrewInvites(castCrewInviteData);
    } catch (err) {
      console.error("Error reloading projects:", err);
    }
  };

  const hasProjects = projects.length > 0;
  const ownedProjects = React.useMemo(
    () => projects.filter((project) => project.isOwnedByCurrentUser),
    [projects]
  );
  const sharedProjects = React.useMemo(
    () => projects.filter((project) => !project.isOwnedByCurrentUser),
    [projects]
  );
  const pendingAccessCount = pendingProjectInvites.length + pendingCastCrewInvites.length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 sm:h-12 sm:px-6 sm:py-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">wrapshoot</span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <FeedbackButton variant="header" source="top_bar" />
          </div>
          <Button size="sm" variant="skeuo" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </Link>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar
                  alt={user?.email || "User"}
                  size="sm"
                />
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.email?.split("@")[0] || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/billing")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/team")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action="/auth/signout" method="post">
                <DropdownMenuItem type="submit">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-foreground">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading projects..."
                : hasProjects
                ? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
                : "Create your first project to get started"}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-[hsl(var(--feedback-error-border))] bg-[hsl(var(--feedback-error-bg))] p-4">
              <p className="text-sm text-[hsl(var(--feedback-error-fg))]">{error}</p>
            </div>
          )}

          {/* Projects Grid */}
          {!loading && !error && (
            <div className="space-y-6">
              {pendingAccessCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-amber-900">
                      Pending Access
                    </h2>
                    <span className="text-xs text-amber-800/80">
                      {pendingAccessCount} waiting
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pendingProjectInvites.map((invite) => (
                      <div
                        key={`project-${invite.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-background p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{invite.projectName}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited by {invite.inviterName} as{" "}
                            {invite.role.toLowerCase().replaceAll("_", " ")} · Expires{" "}
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button size="sm" variant="skeuo" asChild>
                          <Link href={`/invites/${invite.token}`}>Review Invite</Link>
                        </Button>
                      </div>
                    ))}
                    {pendingCastCrewInvites.map((invite) => (
                      <div
                        key={`cast-crew-${invite.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-background p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{invite.projectName}</p>
                          <p className="text-xs text-muted-foreground">
                            {invite.inviteType === "CAST" ? "Cast" : "Crew"} invite for{" "}
                            {invite.personName} ({invite.roleName}) · Invited by{" "}
                            {invite.inviterName} · Expires{" "}
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button size="sm" variant="skeuo" asChild>
                          <Link href={`/invites/cast-crew/${invite.token}`}>Review Invite</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasProjects ? (
                <div className="space-y-6">
                  {ownedProjects.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">Owned by you</h2>
                        <span className="text-xs text-muted-foreground">
                          {ownedProjects.length}
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {ownedProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            onDeleted={reloadProjects}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {sharedProjects.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">Shared with you</h2>
                        <span className="text-xs text-muted-foreground">
                          {sharedProjects.length}
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {sharedProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            onDeleted={reloadProjects}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ProjectsEmptyState />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
