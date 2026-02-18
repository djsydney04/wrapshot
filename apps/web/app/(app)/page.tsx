"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ProjectCard, ProjectsEmptyState } from "@/components/projects/project-card";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { getProjects } from "@/lib/actions/projects";
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data);
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
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      console.error("Error reloading projects:", err);
    }
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">wrapshoot</span>
        </div>

        <div className="flex items-center gap-3">
          <FeedbackButton variant="header" source="top_bar" />
          <Button size="sm" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              New Project
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
        <div className="mx-auto max-w-5xl px-6 py-8">
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
            hasProjects ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} onDeleted={reloadProjects} />
                ))}
              </div>
            ) : (
              <ProjectsEmptyState />
            )
          )}
        </div>
      </div>
    </div>
  );
}
