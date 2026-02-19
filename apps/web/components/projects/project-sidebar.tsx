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
  MapPin,
  DollarSign,
  Settings,
  ClipboardList,
  MessageSquare,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectSection =
  | "overview"
  | "script"
  | "schedule"
  | "callsheets"
  | "assistant"
  | "cast"
  | "crew"
  | "locations"
  | "scenes"
  | "gear"
  | "budget"
  | "settings";

interface SidebarItem {
  key: string;
  id?: ProjectSection;
  label: string;
  icon: React.ElementType;
  count?: number;
  badge?: string;
  disabled?: boolean;
}

interface SidebarGroup {
  id: string;
  label: string;
  items: SidebarItem[];
}

interface ProjectSidebarProps {
  activeSection: ProjectSection;
  onSectionChange: (section: ProjectSection) => void;
  counts: {
    scenes: number;
    cast: number;
    crew: number;
    shootingDays: number;
    callSheets?: number;
    locations?: number;
    gear: number;
    hasScript: boolean;
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
  const groups = React.useMemo<SidebarGroup[]>(
    () => [
      {
        id: "planning",
        label: "Planning",
        items: [
          { key: "overview", id: "overview", label: "Overview", icon: LayoutDashboard },
          {
            key: "assistant",
            id: "assistant",
            label: "Smart Assistant",
            icon: MessageSquare,
          },
          {
            key: "script",
            id: "script",
            label: "Script",
            icon: FileText,
            badge: counts.hasScript ? undefined : "Upload",
          },
        ],
      },
      {
        id: "production",
        label: "Production Department",
        items: [
          {
            key: "shotlist",
            label: "Shot List",
            icon: ListChecks,
            badge: "Soon",
            disabled: true,
          },
          { key: "scenes", id: "scenes", label: "Scenes", icon: Clapperboard, count: counts.scenes },
          {
            key: "schedule",
            id: "schedule",
            label: "Schedule",
            icon: Calendar,
            count: counts.shootingDays,
          },
          {
            key: "callsheets",
            id: "callsheets",
            label: "Call Sheets",
            icon: ClipboardList,
            count: counts.callSheets,
          },
          {
            key: "locations",
            id: "locations",
            label: "Locations",
            icon: MapPin,
            count: counts.locations,
          },
        ],
      },
      {
        id: "team",
        label: "People Department",
        items: [
          { key: "cast", id: "cast", label: "Cast", icon: Users, count: counts.cast },
          { key: "crew", id: "crew", label: "Crew", icon: UserCircle, count: counts.crew },
          {
            key: "gear",
            id: "gear",
            label: "Elements & Props",
            icon: Package,
            count: counts.gear,
          },
        ],
      },
      {
        id: "admin",
        label: "Finance & Admin",
        items: [
          {
            key: "budget",
            id: "budget",
            label: "Budget",
            icon: DollarSign,
            count: counts.budgets,
          },
          { key: "settings", id: "settings", label: "Settings", icon: Settings },
        ],
      },
    ],
    [counts]
  );

  return (
    <nav className={cn("flex h-full flex-col py-2", className)}>
      <div className="flex-1 space-y-3 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {groups.map((group) => (
          <section key={group.id}>
            <p className="mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              <span>{group.label}</span>
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id ? activeSection === item.id : false;

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      disabled={item.disabled || !item.id}
                      onClick={() => item.id && onSectionChange(item.id)}
                      className={cn(
                        "group w-full rounded-md border border-transparent px-2 py-1.5 text-sm transition-all",
                        isActive
                          ? "skeuo-pressed text-foreground"
                          : "text-muted-foreground hover:border-border/60 hover:bg-muted/50 hover:text-foreground",
                        (item.disabled || !item.id) &&
                          "cursor-not-allowed opacity-65 hover:border-transparent hover:bg-transparent hover:text-muted-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-md",
                            isActive
                              ? "skeuo-chip border-border/90 bg-card text-foreground"
                              : "bg-muted/80 text-muted-foreground group-hover:text-foreground",
                            (item.disabled || !item.id) &&
                              "bg-muted/55 text-muted-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
                              isActive
                                ? "bg-foreground/10 text-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.count}
                          </span>
                        )}
                        {item.badge && (
                          <span className="rounded-sm border border-border/70 bg-card/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
