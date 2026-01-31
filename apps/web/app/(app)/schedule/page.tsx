"use client";

import * as React from "react";
import { isSameDay, format } from "date-fns";
import { Plus, Calendar as CalendarIcon, List, CalendarDays, X, Clock, MapPin, CalendarRange } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { DraggableCalendar } from "@/components/calendar/draggable-calendar";
import { DraggableWeekCalendar } from "@/components/calendar/draggable-week-calendar";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { ShootingDayDetailPanel } from "@/components/schedule/shooting-day-detail-panel";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";
import type { ShootingDay } from "@/lib/mock-data";

export default function SchedulePage() {
  const { shootingDays, scenes, projects, locations, cast, updateShootingDay } = useProjectStore();

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<ShootingDay | null>(null);
  const [showDetailPanel, setShowDetailPanel] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"week" | "month" | "list">("week");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addFormDate, setAddFormDate] = React.useState<Date | undefined>();
  const [addFormStartTime, setAddFormStartTime] = React.useState<string | undefined>();
  const [addFormEndTime, setAddFormEndTime] = React.useState<string | undefined>();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Default to first project for now
  const defaultProjectId = projects[0]?.id || "proj-1";

  const handleDayClick = (date: Date, events: ShootingDay[]) => {
    setSelectedDate(date);
    if (events && events.length > 0) {
      setSelectedDay(events[0]);
      setShowDetailPanel(true);
    }
  };

  const handleClosePanel = () => {
    setShowDetailPanel(false);
    setSelectedDay(null);
  };

  const handleAddClick = (date?: Date, startTime?: string, endTime?: string) => {
    setAddFormDate(date);
    setAddFormStartTime(startTime);
    setAddFormEndTime(endTime);
    setShowAddForm(true);
  };

  const handleReschedule = async (shootingDayId: string, newDate: string) => {
    updateShootingDay(shootingDayId, { date: newDate });
    forceUpdate();
  };

  const handleAddSceneToDay = async (sceneId: string, shootingDayId: string) => {
    const shootingDay = shootingDays.find((d) => d.id === shootingDayId);
    if (!shootingDay) return;

    const newSceneIds = [...shootingDay.scenes, sceneId];
    updateShootingDay(shootingDayId, { scenes: newSceneIds });

    // Update selected day if it's the one being modified
    if (selectedDay && selectedDay.id === shootingDayId) {
      setSelectedDay({ ...selectedDay, scenes: newSceneIds });
    }
    forceUpdate();
  };

  const handleUpdateSceneOrder = async (shootingDayId: string, sceneIds: string[]) => {
    updateShootingDay(shootingDayId, { scenes: sceneIds });
    if (selectedDay && selectedDay.id === shootingDayId) {
      setSelectedDay({ ...selectedDay, scenes: sceneIds });
    }
    forceUpdate();
  };

  const handleUpdate = async (id: string, updates: Partial<ShootingDay>) => {
    updateShootingDay(id, updates);
    if (selectedDay && selectedDay.id === id) {
      setSelectedDay({ ...selectedDay, ...updates });
    }
    forceUpdate();
  };

  const handleDelete = async (id: string) => {
    // For mock data, we'd need a delete function in the store
    setSelectedDay(null);
    setShowDetailPanel(false);
    forceUpdate();
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
                <CalendarRange className="h-3.5 w-3.5" />
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
                <CalendarDays className="h-3.5 w-3.5" />
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

      <div className="flex flex-1 overflow-hidden p-6">
        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Page Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-foreground">Schedule</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {shootingDays.length > 0
                ? `${shootingDays.length} shooting day${shootingDays.length !== 1 ? "s" : ""} · ${shootingDays.filter(d => d.status === "COMPLETED").length} completed`
                : "Plan your shooting schedule"}
            </p>
          </div>

          {viewMode === "week" ? (
            <DraggableWeekCalendar
              shootingDays={shootingDays}
              scenes={scenes}
              cast={cast}
              locations={locations}
              onDayClick={handleDayClick}
              onAddClick={handleAddClick}
              onReschedule={handleReschedule}
              onAddSceneToDay={handleAddSceneToDay}
              selectedDate={selectedDate || undefined}
              className="flex-1 min-h-0"
            />
          ) : viewMode === "month" ? (
            <DraggableCalendar
              shootingDays={shootingDays}
              scenes={scenes}
              cast={cast}
              locations={locations}
              onDayClick={handleDayClick}
              onAddClick={handleAddClick}
              onReschedule={handleReschedule}
              selectedDate={selectedDate || undefined}
              className="flex-1 min-h-0"
            />
          ) : (
            <div className="space-y-4 flex-1 overflow-auto">
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
                            setSelectedDay(day);
                            setShowDetailPanel(true);
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
      </div>

      {/* Shooting Day Detail Panel */}
      <ShootingDayDetailPanel
        shootingDay={selectedDay}
        scenes={scenes}
        cast={cast}
        locations={locations}
        open={showDetailPanel}
        onOpenChange={setShowDetailPanel}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onUpdateSceneOrder={handleUpdateSceneOrder}
        useMockData={true}
      />

      {/* Add Shooting Day Form */}
      <AddShootingDayForm
        projectId={defaultProjectId}
        open={showAddForm}
        onOpenChange={setShowAddForm}
        defaultDate={addFormDate}
        defaultStartTime={addFormStartTime}
        defaultEndTime={addFormEndTime}
        onSuccess={forceUpdate}
      />
    </div>
  );
}
