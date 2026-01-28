"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Film, Users, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/mock-data";

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
        <div className="mt-3 text-xs text-muted-foreground">
          {formatDate(project.startDate)} — {formatDate(project.endDate)}
        </div>
      </div>
    </Link>
  );
}

// Empty state component
export function ProjectsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Film className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium">No projects yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your first project to get started
      </p>
      <Button className="mt-4" size="sm" asChild>
        <Link href="/projects/new">Create Project</Link>
      </Button>
    </div>
  );
}
