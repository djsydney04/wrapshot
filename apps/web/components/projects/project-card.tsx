"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Film, Users, MapPin, Calendar, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/actions/projects.types";

interface ProjectCardProps {
  project: Project;
  className?: string;
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

export function ProjectCard({ project, className }: ProjectCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
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
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "text-muted-foreground opacity-0 transition-opacity",
              isHovered && "opacity-100"
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // TODO: Open dropdown menu
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
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
