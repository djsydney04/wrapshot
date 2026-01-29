"use client";

import * as React from "react";
import { isSameDay, format } from "date-fns";
import { Plus, Calendar as CalendarIcon, List, CalendarDays, X, Clock, MapPin, Clapperboard } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/calendar/calendar";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";
import type { ShootingDay } from "@/lib/mock-data";

export default function SchedulePage() {
  const { shootingDays, scenes, projects } = useProjectStore();

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = React.useState<ShootingDay[]>([]);
  const [viewMode, setViewMode] = React.useState<"week" | "month" | "list">("week");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addFormDate, setAddFormDate] = React.useState<Date | undefined>();

  // Default to first project for now
  const defaultProjectId = projects[0]?.id || "proj-1";

  const handleDayClick = (date: Date, events: ShootingDay[]) => {
    setSelectedDate(date);
    setSelectedDayEvents(events);
  };

  const handleClosePanel = () => {
    setSelectedDate(null);
    setSelectedDayEvents([]);
  };

  const handleAddClick = (date?: Date) => {
    setAddFormDate(date);
    setShowAddForm(true);
  };

  const sortedDays = React.useMemo(() => {
    return [...shootingDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [shootingDays]);

  const getSceneDetails = (sceneIds: string[]) => {
    return scenes.filter((s) => sceneIds.includes(s.id));
  };

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.name || "Unknown Project";
  };

  const getStatusBadge = (status: ShootingDay["status"]) => {
    const variants: Record<string, string> = {
      COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      SCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      TENTATIVE: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
      CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return variants[status] || variants.TENTATIVE;
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="grain-page" />

      <Header
        breadcrumbs={[{ label: "Schedule" }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border p-0.5">
              <button
                onClick={() => setViewMode("week")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "week"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "month"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Month
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
            <Button size="sm" onClick={() => handleAddClick()}>
              <Plus className="h-4 w-4" />
              Add Day
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Schedule</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {shootingDays.length > 0
                ? `${shootingDays.length} shooting day${shootingDays.length !== 1 ? "s" : ""} · ${shootingDays.filter(d => d.status === "COMPLETED").length} completed`
                : "Plan your shooting schedule"}
            </p>
          </div>

          {viewMode === "week" ? (
            <WeekCalendar
              shootingDays={shootingDays}
              scenes={scenes}
              onDayClick={handleDayClick}
              onAddClick={handleAddClick}
              selectedDate={selectedDate || undefined}
              className="h-full"
            />
          ) : viewMode === "month" ? (
            <Calendar
              shootingDays={shootingDays}
              onDayClick={handleDayClick}
              onAddClick={handleAddClick}
              selectedDate={selectedDate || undefined}
              className="h-full"
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Shooting Days</h2>
                <span className="text-sm text-muted-foreground">
                  {shootingDays.length} total · {shootingDays.filter(d => d.status === "COMPLETED").length} completed
                </span>
              </div>

              {sortedDays.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Day</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Project</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Call</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Wrap</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scenes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedDays.map((day) => (
                        <tr
                          key={day.id}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedDate(new Date(day.date));
                            setSelectedDayEvents(shootingDays.filter((d) =>
                              isSameDay(new Date(d.date), new Date(day.date))
                            ));
                          }}
                        >
                          <td className="px-4 py-3 font-medium">Day {day.dayNumber}</td>
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(day.date), "EEE, MMM d")}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {getProjectName(day.projectId)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{day.generalCall}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{day.wrapTime || "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{day.scenes.length}</td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusBadge(day.status))}>
                              {day.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg px-4 py-16 text-center">
                  <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium mb-1">No shooting days scheduled</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first shooting day to get started
                  </p>
                  <Button onClick={() => handleAddClick()}>
                    <Plus className="h-4 w-4" />
                    Add Shooting Day
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Day Detail Panel */}
        {selectedDate && (
          <div className="w-[380px] border-l border-border bg-card overflow-auto flex-shrink-0">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div>
                <h3 className="font-semibold">
                  {format(selectedDate, "EEEE, MMMM d")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedDayEvents.length} shoot{selectedDayEvents.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClosePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-5">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    No shoots scheduled for this day
                  </p>
                  <Button variant="outline" size="sm" onClick={() => handleAddClick(selectedDate)}>
                    <Plus className="h-4 w-4" />
                    Add Shooting Day
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedDayEvents.map((day) => {
                    const dayScenes = getSceneDetails(day.scenes);

                    return (
                      <div
                        key={day.id}
                        className="rounded-xl border border-border bg-background p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">Day {day.dayNumber}</h4>
                              {day.unit !== "MAIN" && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                  {day.unit}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {getProjectName(day.projectId)}
                            </p>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusBadge(day.status))}>
                            {day.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {day.generalCall}
                            {day.wrapTime && ` – ${day.wrapTime}`}
                          </span>
                        </div>

                        {day.notes && (
                          <p className="text-sm text-muted-foreground mb-3 pb-3 border-b border-border">
                            {day.notes}
                          </p>
                        )}

                        {dayScenes.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Scenes ({dayScenes.length})
                            </h5>
                            <div className="space-y-2">
                              {dayScenes.map((scene) => (
                                <div
                                  key={scene.id}
                                  className="rounded-lg bg-muted/50 p-3"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-semibold">
                                      {scene.sceneNumber}
                                    </span>
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                      scene.intExt === "INT"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    )}>
                                      {scene.intExt}
                                    </span>
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                      scene.dayNight === "DAY"
                                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                    )}>
                                      {scene.dayNight}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {scene.synopsis}
                                  </p>
                                  {scene.location && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{scene.location}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                          <Button variant="outline" size="sm" className="flex-1">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            Call Sheet
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Shooting Day Form */}
      <AddShootingDayForm
        projectId={defaultProjectId}
        open={showAddForm}
        onOpenChange={setShowAddForm}
        defaultDate={addFormDate}
      />
    </div>
  );
}
