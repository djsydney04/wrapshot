"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Film, Users, Calendar, Settings, Trash2, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteProject } from "@/lib/actions/projects";
import type { Project } from "@/lib/actions/projects.types";

interface ProjectCardProps {
  project: Project;
  className?: string;
  onDeleted?: () => void;
}

const statusVariant: Record<Project["status"], "development" | "pre-production" | "production" | "post-production" | "completed" | "on-hold"> = {
  DEVELOPMENT: "development",
  PRE_PRODUCTION: "pre-production",
  PRODUCTION: "production",
  POST_PRODUCTION: "post-production",
  COMPLETED: "completed",
  ON_HOLD: "on-hold",
};

const statusLabel: Record<Project["status"], string> = {
  DEVELOPMENT: "Development",
  PRE_PRODUCTION: "Pre-Production",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-Production",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

export function ProjectCard({ project, className, onDeleted }: ProjectCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== project.name) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteProject(project.id);
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete project"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Link href={`/projects/${project.id}`}>
        <div
          className={cn(
            "group relative rounded-lg border border-border bg-card p-4 transition-all duration-150",
            "hover:border-border hover:bg-[hsl(var(--notion-hover))]",
            className
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Film className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-foreground group-hover:text-foreground">
                  {project.name}
                </h3>
                <Badge variant={statusVariant[project.status]} className="mt-1">
                  {statusLabel[project.status]}
                </Badge>
              </div>
            </div>
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "text-muted-foreground opacity-0 transition-opacity",
                      isHovered && "opacity-100"
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push(`/projects/${project.id}?section=settings`)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 hover:!text-red-600 focus:!text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Description */}
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>

          {/* Stats */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Film className="h-3.5 w-3.5" />
              <span>{project.scenesCount} scenes</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{project.shootingDaysCount} days</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{project.castCount} cast</span>
            </div>
          </div>

          {/* Dates */}
          {(project.startDate || project.endDate) && (
            <div className="mt-3 text-xs text-muted-foreground">
              {project.startDate ? formatDate(project.startDate) : "TBD"} — {project.endDate ? formatDate(project.endDate) : "TBD"}
            </div>
          )}
        </div>
      </Link>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent onClose={() => setShowDeleteDialog(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              project <strong>{project.name}</strong> and all of its data
              including scenes, schedules, cast, and crew.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="text-sm font-medium">
              Type <strong>{project.name}</strong> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={project.name}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmText !== project.name || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Empty state component
export function ProjectsEmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center max-w-md">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
          <Film className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">
          No projects yet
        </h2>
        <p className="text-muted-foreground mb-6">
          Create your first project to start managing your production from script to screen.
        </p>
        <Button size="lg" asChild>
          <Link href="/projects/new">Create Project</Link>
        </Button>

        {/* Feature Highlights */}
        <div className="mt-12 grid gap-4 text-left">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Film className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium mb-0.5">All-in-One Production Hub</h4>
              <p className="text-sm text-muted-foreground">
                Manage scenes, cast, crew, and locations in one place
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium mb-0.5">Team Collaboration</h4>
              <p className="text-sm text-muted-foreground">
                Invite your team and assign roles with granular permissions
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium mb-0.5">Production Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Track progress from development through post-production
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
