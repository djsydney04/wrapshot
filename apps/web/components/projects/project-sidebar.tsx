"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Calendar,
  Film,
  Paintbrush2,
  Camera,
  Lightbulb,
  Users,
  UserCircle,
  Clapperboard,
  Package,
  MapPin,
  DollarSign,
  Settings,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ProjectSection =
  | "dashboard"
  | "assistant"
  | "script"
  | "schedule"
  | "callsheets"
  | "art"
  | "camera"
  | "ge"
  | "cast"
  | "crew"
  | "locations"
  | "scenes"
  | "post"
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
  workflow?: {
    id: string;
    label: string;
    section: ProjectSection;
    status: "done" | "current" | "upcoming";
  }[];
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
  workflow,
  counts,
  className,
}: ProjectSidebarProps) {
  const activeWorkflowStep = React.useMemo(
    () => workflow?.find((step) => step.status === "current") ?? null,
    [workflow]
  );
  const completedWorkflowSteps = React.useMemo(
    () => workflow?.filter((step) => step.status === "done").length ?? 0,
    [workflow]
  );
  const activeInWorkflow = React.useMemo(
    () => workflow?.some((step) => step.section === activeSection) ?? false,
    [activeSection, workflow]
  );
  const [showDepartments, setShowDepartments] = React.useState(() => !activeInWorkflow);

  React.useEffect(() => {
    if (!activeInWorkflow) {
      setShowDepartments(true);
    }
  }, [activeInWorkflow]);

  const groups = React.useMemo<SidebarGroup[]>(
    () => [
      {
        id: "planning",
        label: "Planning",
        items: [
          { key: "dashboard", id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { key: "assistant", id: "assistant", label: "Agent", icon: Bot },
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
            key: "art",
            id: "art",
            label: "Art",
            icon: Paintbrush2,
          },
          {
            key: "camera",
            id: "camera",
            label: "Camera",
            icon: Camera,
          },
          {
            key: "ge",
            id: "ge",
            label: "G&E",
            icon: Lightbulb,
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
            key: "post",
            id: "post",
            label: "Post Production",
            icon: Film,
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
        {workflow && workflow.length > 0 && (
          <section className="skeuo-panel rounded-lg p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Workflow
              </p>
              <span className="text-[10px] text-muted-foreground">
                {completedWorkflowSteps}/{workflow.length}
              </span>
            </div>
            <ol className="space-y-1">
              {workflow.map((step, index) => {
                const isActive = activeSection === step.section;
                const statusClass =
                  step.status === "done"
                    ? "bg-foreground text-background"
                    : step.status === "current"
                      ? "skeuo-pressed text-foreground"
                      : "skeuo-chip text-muted-foreground";

                return (
                  <li key={step.id} className="relative">
                    {index < workflow.length - 1 && (
                      <span className="pointer-events-none absolute left-[11px] top-6 h-3 w-px bg-border/70" />
                    )}
                    <button
                      type="button"
                      onClick={() => onSectionChange(step.section)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left text-xs transition-colors",
                        isActive
                          ? "skeuo-pressed"
                          : "text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-[6px] text-[10px] font-semibold tabular-nums",
                          statusClass
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="flex-1 truncate font-medium">{step.label}</span>
                      {step.status === "done" ? (
                        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Done
                        </span>
                      ) : step.status === "current" ? (
                        <span className="text-[10px] uppercase tracking-[0.08em] text-foreground">
                          Next
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
            {activeWorkflowStep && activeSection !== activeWorkflowStep.section && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full text-xs"
                onClick={() => onSectionChange(activeWorkflowStep.section)}
              >
                Continue: {activeWorkflowStep.label}
              </Button>
            )}
          </section>
        )}

        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDepartments((previous) => !previous)}
            className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/40 hover:text-foreground"
          >
            <span>All Departments</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showDepartments ? "rotate-180" : ""
              )}
            />
          </button>

          {showDepartments && (
            <div className="space-y-3">
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
          )}
        </section>
      </div>
    </nav>
  );
}
