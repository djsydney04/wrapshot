"use client";

import * as React from "react";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Users,
  UserCircle,
  Clapperboard,
  Package,
  UserPlus,
  DollarSign,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectSection =
  | "overview"
  | "script"
  | "schedule"
  | "cast"
  | "crew"
  | "scenes"
  | "gear"
  | "team"
  | "budget"
  | "settings";

interface SectionItem {
  id: ProjectSection;
  label: string;
  icon: React.ElementType;
  count?: number;
}

interface ProjectSidebarProps {
  activeSection: ProjectSection;
  onSectionChange: (section: ProjectSection) => void;
  counts: {
    scenes: number;
    cast: number;
    crew: number;
    shootingDays: number;
    gear: number;
    hasScript: boolean;
    team?: number;
    budgets?: number;
  };
  className?: string;
}

export function ProjectSidebar({
  activeSection,
  onSectionChange,
  counts,
  className,
}: ProjectSidebarProps) {
  const sections: SectionItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "scenes", label: "Scenes", icon: Clapperboard, count: counts.scenes },
    { id: "schedule", label: "Schedule", icon: Calendar, count: counts.shootingDays },
    { id: "cast", label: "Cast", icon: Users, count: counts.cast },
    { id: "crew", label: "Crew", icon: UserCircle, count: counts.crew },
    { id: "team", label: "Team Access", icon: UserPlus, count: counts.team },
    { id: "gear", label: "Gear & Props", icon: Package, count: counts.gear },
    { id: "budget", label: "Budget", icon: DollarSign, count: counts.budgets },
    { id: "script", label: "Script", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className={cn("py-2", className)}>
      <ul className="space-y-0.5 px-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <li key={section.id}>
              <button
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{section.label}</span>
                {section.count !== undefined && section.count > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {section.count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
