"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AddProjectForm } from "@/components/forms/add-project-form";
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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [showAddProject, setShowAddProject] = React.useState(false);
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
  const upcomingDaysCount = upcomingDays.length;

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
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    return `in ${diff} days`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 gradient-mesh opacity-40 pointer-events-none" />
      <div className="grain-page" />

      <Header
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setShowAddProject(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="flex-1 overflow-auto relative">
        <div className="mx-auto max-w-5xl px-6 py-10">
          {projects.length === 0 ? (
            // Empty state
            <div className="card-premium">
              <div className="flex flex-col items-center justify-center py-20 px-8">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent-blue-soft to-accent-purple-soft flex items-center justify-center mb-6">
                  <Film className="h-8 w-8 text-accent-blue" />
                </div>
                <h1 className="text-2xl font-semibold mb-2 text-center">
                  Welcome to SetSync
                </h1>
                <p className="text-muted-foreground text-center max-w-sm mb-6">
                  Production management for filmmakers. Create your first project to begin.
                </p>
                <Button onClick={() => setShowAddProject(true)} className="gap-2 rounded-xl">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Next Shoot - Hero Card */}
              {nextShootDay ? (
                <Link href={`/projects/${nextShootDay.projectId}`} className="block group">
                  <div className="card-premium p-6 hover:shadow-soft-lg transition-shadow">
                    <div className="flex items-center gap-2 text-xs font-medium text-accent-emerald mb-4">
                      <div className="h-2 w-2 rounded-full bg-accent-emerald animate-pulse" />
                      Next Shoot {getDaysUntil(nextShootDay.date)}
                    </div>

                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-5">
                        {/* Date block */}
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent-blue-soft to-accent-purple-soft flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-2xl font-bold leading-none text-foreground">
                            {new Date(nextShootDay.date).getDate()}
                          </span>
                          <span className="text-[10px] uppercase text-muted-foreground mt-1 font-medium">
                            {new Date(nextShootDay.date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                        </div>

                        {/* Details */}
                        <div>
                          <h2 className="text-xl font-semibold group-hover:text-accent-blue transition-colors">
                            {nextProject?.name}
                          </h2>
                          <p className="text-muted-foreground mt-1">
                            Day {nextShootDay.dayNumber} · {nextShootDay.scenes.length} scenes
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              {nextShootDay.generalCall} call
                            </span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent-blue group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="card-premium p-6 border-dashed">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No shoots scheduled</p>
                        <p className="text-sm text-muted-foreground">Add shooting days to your projects</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <Link href="/schedule">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Schedule
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                {/* Scenes */}
                <div className="card-premium p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-purple-soft">
                      <Clapperboard className="h-5 w-5 text-accent-purple" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scenes</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-accent-emerald" />
                        Wrapped
                      </span>
                      <span className="font-semibold">{completedScenes}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm">
                        <Circle className="h-4 w-4 text-accent-amber" />
                        Scheduled
                      </span>
                      <span className="font-semibold">{scheduledScenes}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                      {totalScenes > 0 && (
                        <>
                          <div
                            className="h-full bg-accent-emerald transition-all"
                            style={{ width: `${(completedScenes / totalScenes) * 100}%` }}
                          />
                          <div
                            className="h-full bg-accent-amber transition-all"
                            style={{ width: `${(scheduledScenes / totalScenes) * 100}%` }}
                          />
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {totalScenes > 0
                        ? `${Math.round((completedScenes / totalScenes) * 100)}% complete`
                        : "No scenes yet"
                      }
                    </p>
                  </div>
                </div>

                {/* Shoot Days */}
                <div className="card-premium p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue-soft">
                      <Calendar className="h-5 w-5 text-accent-blue" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Schedule</span>
                  </div>

                  <div className="text-3xl font-bold">{upcomingDaysCount}</div>
                  <p className="text-sm text-muted-foreground mt-1">upcoming shoot days</p>

                  <Link
                    href="/schedule"
                    className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-sm hover:text-accent-blue transition-colors group"
                  >
                    <span>View calendar</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                {/* Team */}
                <div className="card-premium p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-teal-soft">
                      <Users className="h-5 w-5 text-accent-teal" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Team</span>
                  </div>

                  <div className="text-3xl font-bold">{cast.length + crew.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">total members</p>

                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{cast.length} cast</span>
                    <span>{crew.length} crew</span>
                  </div>
                </div>
              </div>

              {/* Projects + Upcoming side by side */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Projects */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">Projects</h2>
                    <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      View all <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="card-premium divide-y divide-border/50">
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
                          className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                        >
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent-blue-soft to-accent-purple-soft flex items-center justify-center flex-shrink-0">
                            <Film className="h-5 w-5 text-accent-blue" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{project.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {projectScenes.length} scenes · {progress}% wrapped
                            </p>
                          </div>
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className="h-full bg-accent-emerald transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })}

                    {projects.length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No projects yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Shoots */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">Upcoming Shoots</h2>
                    <Link href="/schedule" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      Calendar <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="card-premium divide-y divide-border/50">
                    {upcomingDays.slice(0, 4).map((day) => {
                      const project = projects.find((p) => p.id === day.projectId);
                      return (
                        <Link
                          key={day.id}
                          href={`/projects/${day.projectId}`}
                          className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                        >
                          <div className="h-10 w-10 rounded-xl bg-muted flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold leading-none">
                              {new Date(day.date).getDate()}
                            </span>
                            <span className="text-[8px] uppercase text-muted-foreground">
                              {new Date(day.date).toLocaleDateString("en-US", { month: "short" })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{project?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Day {day.dayNumber} · {day.scenes.length} scenes · {day.generalCall}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDateShort(day.date)}
                          </span>
                        </Link>
                      );
                    })}

                    {upcomingDays.length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No upcoming shoots
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddProjectForm open={showAddProject} onOpenChange={setShowAddProject} />
    </div>
  );
}
