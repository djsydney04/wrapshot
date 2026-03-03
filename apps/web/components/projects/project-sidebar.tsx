"use client";

import * as React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Calendar,
  ListTodo,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectSection =
  | "dashboard"
  | "assistant"
  | "script"
  | "tasks"
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
  counts: {
    scenes: number;
    tasks?: number;
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

const CORE_WORKFLOW_SECTIONS: ProjectSection[] = [
  "script",
  "scenes",
  "schedule",
  "callsheets",
];

export function ProjectSidebar({
  activeSection,
  onSectionChange,
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
  const activeInDepartmentWorkflow = React.useMemo(
    () =>
      workflow?.some(
        (step) =>
          step.section === activeSection &&
          !CORE_WORKFLOW_SECTIONS.includes(step.section)
      ) ?? false,
    [activeSection, workflow]
  );
  const [showDepartmentWorkflow, setShowDepartmentWorkflow] = React.useState(
    () => activeInDepartmentWorkflow
  );

  React.useEffect(() => {
    if (activeInDepartmentWorkflow) {
      setShowDepartmentWorkflow(true);
    }
  }, [activeInDepartmentWorkflow]);

  const departmentWorkflowStepCount = React.useMemo(
    () =>
      workflow?.filter((step) => !CORE_WORKFLOW_SECTIONS.includes(step.section))
        .length ?? 0,
    [workflow]
  );
  const visibleWorkflowSteps = React.useMemo(() => {
    if (!workflow) return [];
    if (showDepartmentWorkflow) return workflow;
    return workflow.filter((step) => CORE_WORKFLOW_SECTIONS.includes(step.section));
  }, [showDepartmentWorkflow, workflow]);

  const quickAccessItems = React.useMemo<SidebarItem[]>(
    () => [
      { key: "dashboard", id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "assistant", id: "assistant", label: "Agent", icon: MessageSquare },
      {
        key: "script",
        id: "script",
        label: "Script",
        icon: FileText,
        badge: counts.hasScript ? undefined : "Upload",
      },
      { key: "scenes", id: "scenes", label: "Scenes", icon: Clapperboard, count: counts.scenes },
      {
        key: "tasks",
        id: "tasks",
        label: "Tasks",
        icon: ListTodo,
        count: counts.tasks,
      },
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
    ],
    [counts]
  );

  const quickAccessSectionIds = React.useMemo(
    () =>
      quickAccessItems
        .map((item) => item.id)
        .filter((id): id is ProjectSection => Boolean(id)),
    [quickAccessItems]
  );
  const activeInQuickAccess = quickAccessSectionIds.includes(activeSection);
  const [showAdvancedTools, setShowAdvancedTools] = React.useState(() => !activeInQuickAccess);

  React.useEffect(() => {
    if (!activeInQuickAccess) {
      setShowAdvancedTools(true);
    }
  }, [activeInQuickAccess]);

  const advancedGroups = React.useMemo<SidebarGroup[]>(
    () => [
      {
        id: "departments",
        label: "Departments",
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
          {
            key: "post",
            id: "post",
            label: "Post Production",
            icon: Film,
          },
        ],
      },
      {
        id: "team-resources",
        label: "Team & Resources",
        items: [
          { key: "cast", id: "cast", label: "Cast", icon: Users, count: counts.cast },
          { key: "crew", id: "crew", label: "Crew", icon: UserCircle, count: counts.crew },
          {
            key: "locations",
            id: "locations",
            label: "Locations",
            icon: MapPin,
            count: counts.locations,
          },
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

  const renderItem = (item: SidebarItem) => {
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
                (item.disabled || !item.id) && "bg-muted/55 text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
                  isActive ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
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
  };

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
              {visibleWorkflowSteps.map((step, index) => {
                const isActive = activeSection === step.section;
                const statusClass =
                  step.status === "done"
                    ? "bg-foreground text-background"
                    : step.status === "current"
                      ? "skeuo-pressed text-foreground"
                      : "skeuo-chip text-muted-foreground";

                return (
                  <li key={step.id} className="relative">
                    {index < visibleWorkflowSteps.length - 1 && (
                      <span className="pointer-events-none absolute left-[11px] top-6 h-3 w-px bg-border/70" />
                    )}
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
            </ol>
            {departmentWorkflowStepCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 w-full justify-start px-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowDepartmentWorkflow((previous) => !previous)}
              >
                {showDepartmentWorkflow
                  ? "Show Core Workflow"
                  : `Show Department Workflow (+${departmentWorkflowStepCount})`}
              </Button>
            )}
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
          <div>
            <p className="mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              <span>Quick Access</span>
            </p>
            <ul className="space-y-0.5">{quickAccessItems.map((item) => renderItem(item))}</ul>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedTools((previous) => !previous)}
            className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/40 hover:text-foreground"
          >
            <span>Advanced Tools</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showAdvancedTools ? "rotate-180" : ""
              )}
            />
          </button>
          <p className="px-2 text-[11px] text-muted-foreground/80">
            Hidden by default. Open when you need deeper planning and admin tools.
          </p>

          {showAdvancedTools && (
            <div className="space-y-3">
              {advancedGroups.map((group) => (
                <section key={group.id}>
                  <p className="mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-border" />
                    <span>{group.label}</span>
                  </p>
                  <ul className="space-y-0.5">{group.items.map((item) => renderItem(item))}</ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </nav>
  );
}
