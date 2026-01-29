"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/stores/project-store";
import Link from "next/link";
import {
  Plus,
  ChevronRight,
  Calendar,
  Film,
  Users,
  Clock,
  Clapperboard,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Send,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { projects, scenes, shootingDays, cast, crew } = useProjectStore();

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Upcoming shooting days
  const upcomingDays = React.useMemo(() => {
    return shootingDays
      .filter((d) => {
        const date = new Date(d.date);
        date.setHours(0, 0, 0, 0);
        return date >= today && d.status !== "CANCELLED";
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [shootingDays, today]);

  const nextShootDay = upcomingDays[0];
  const nextProject = nextShootDay
    ? projects.find((p) => p.id === nextShootDay.projectId)
    : null;

  // Stats
  const totalScenes = scenes.length;
  const completedScenes = scenes.filter((s) => s.status === "COMPLETED").length;
  const scheduledScenes = scenes.filter((s) => s.status === "SCHEDULED").length;
  const pendingScenes = totalScenes - completedScenes - scheduledScenes;

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    const isToday = date.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
  };

  // Quick actions based on current state
  const quickActions = React.useMemo(() => {
    const actions = [];

    if (nextShootDay) {
      actions.push({
        label: "Generate Call Sheet",
        description: `For ${nextProject?.name} - Day ${nextShootDay.dayNumber}`,
        icon: FileText,
        href: `/projects/${nextShootDay.projectId}/call-sheets`,
        color: "bg-accent-blue text-white",
      });
    }

    if (pendingScenes > 0) {
      actions.push({
        label: "Schedule Scenes",
        description: `${pendingScenes} scenes need scheduling`,
        icon: Calendar,
        href: "/schedule",
        color: "bg-accent-amber text-white",
      });
    }

    if (projects.length > 0 && cast.length + crew.length === 0) {
      actions.push({
        label: "Add Team Members",
        description: "Build your cast & crew list",
        icon: Users,
        href: "/settings/team",
        color: "bg-accent-purple text-white",
      });
    }

    return actions;
  }, [nextShootDay, nextProject, pendingScenes, projects.length, cast.length, crew.length]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="grain-page" />

      <Header
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <Button size="sm" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {projects.length === 0 ? (
            // Empty state - action oriented
            <div className="flex items-center justify-center min-h-[600px]">
              <div className="text-center max-w-md">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                  <Film className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  No projects yet
                </h2>
                <p className="text-muted-foreground mb-6">
                  Create your first project to start managing scenes, schedules, and call sheets for your production.
                </p>
                <Button size="lg" asChild>
                  <Link href="/projects/new">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </Link>
                </Button>

                {/* Feature Highlights */}
                <div className="mt-12 grid gap-4 text-left">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Clapperboard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-0.5">Scene Management</h4>
                      <p className="text-sm text-muted-foreground">
                        Organize and track all your scenes with detailed breakdowns
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-0.5">Smart Scheduling</h4>
                      <p className="text-sm text-muted-foreground">
                        Plan shooting days and manage your production calendar
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-0.5">Call Sheets</h4>
                      <p className="text-sm text-muted-foreground">
                        Generate professional call sheets with one click
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {projects.length} project{projects.length !== 1 ? "s" : ""} · {upcomingDays.length} upcoming shoot{upcomingDays.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Quick Actions - only show if there are actions */}
              {quickActions.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {quickActions.map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={i}
                        href={action.href}
                        className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", action.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{action.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Next Shoot - prominent but grounded */}
              {nextShootDay && (
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-accent-emerald" />
                        <span className="text-sm font-medium">Next Shoot · {getDaysUntil(nextShootDay.date)}</span>
                      </div>
                      <Link
                        href={`/projects/${nextShootDay.projectId}`}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        View project <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start gap-5">
                      {/* Date block */}
                      <div className="h-16 w-16 rounded-xl bg-muted flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-bold leading-none">
                          {new Date(nextShootDay.date).getDate()}
                        </span>
                        <span className="text-[10px] uppercase text-muted-foreground mt-1 font-medium">
                          {new Date(nextShootDay.date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold">{nextProject?.name}</h2>
                        <p className="text-muted-foreground text-sm">
                          Day {nextShootDay.dayNumber} · {nextShootDay.scenes.length} scene{nextShootDay.scenes.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {nextShootDay.generalCall} call
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/projects/${nextShootDay.projectId}/call-sheets`}>
                            <FileText className="h-4 w-4 mr-1.5" />
                            Call Sheet
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats row - compact and actionable */}
              <div className="grid grid-cols-4 gap-3">
                <Link
                  href="/projects"
                  className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <Film className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold leading-none">{projects.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Projects</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/schedule"
                  className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold leading-none">{upcomingDays.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Shoot Days</p>
                    </div>
                  </div>
                </Link>

                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <Clapperboard className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold leading-none">{completedScenes}<span className="text-muted-foreground text-lg">/{totalScenes}</span></p>
                      <p className="text-xs text-muted-foreground mt-1">Scenes Wrapped</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                      <Users className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold leading-none">{cast.length + crew.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Team Members</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two column layout */}
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Projects list */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="font-medium text-sm">Projects</h2>
                    <Link
                      href="/projects"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="divide-y divide-border">
                    {projects.slice(0, 4).map((project) => {
                      const projectScenes = scenes.filter((s) => s.projectId === project.id);
                      const projectCompleted = projectScenes.filter((s) => s.status === "COMPLETED").length;
                      const progress = projectScenes.length > 0
                        ? Math.round((projectCompleted / projectScenes.length) * 100)
                        : 0;

                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Film className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{project.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {projectScenes.length} scenes
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-foreground/60 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                          </div>
                        </Link>
                      );
                    })}

                    {projects.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No projects yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming shoots */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="font-medium text-sm">Upcoming Shoots</h2>
                    <Link
                      href="/schedule"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Calendar
                    </Link>
                  </div>
                  <div className="divide-y divide-border">
                    {upcomingDays.slice(0, 4).map((day) => {
                      const project = projects.find((p) => p.id === day.projectId);
                      return (
                        <Link
                          key={day.id}
                          href={`/projects/${day.projectId}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-lg bg-muted flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold leading-none">
                              {new Date(day.date).getDate()}
                            </span>
                            <span className="text-[7px] uppercase text-muted-foreground leading-none mt-0.5">
                              {new Date(day.date).toLocaleDateString("en-US", { month: "short" })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{project?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Day {day.dayNumber} · {day.scenes.length} scenes
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateShort(day.date)}
                          </span>
                        </Link>
                      );
                    })}

                    {upcomingDays.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No shoots scheduled</p>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/schedule">
                            <Plus className="h-3.5 w-3.5" />
                            Add shoot day
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
