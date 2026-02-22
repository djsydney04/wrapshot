"use client";

import * as React from "react";
import {
  format,
  isSameDay,
} from "date-fns";
import {
  Plus,
  Calendar as CalendarIcon,
  Trash2,
  Lightbulb,
  Loader2,
  LayoutList,
  Columns3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { DraggableWeekCalendar } from "@/components/calendar/draggable-week-calendar";
import { DraggableCalendar } from "@/components/calendar/draggable-calendar";
import { ShootingDayDetailPanel } from "@/components/schedule/shooting-day-detail-panel";
import { DailyFilmSchedule } from "@/components/schedule/daily-film-schedule";
import { StripeboardSection } from "./stripeboard-section";
import { useProjectStore } from "@/lib/stores/project-store";
import {
  deleteShootingDay as deleteShootingDayAction,
  rescheduleShootingDay,
  updateShootingDay,
  updateSceneOrder,
  updateCastCallTimes,
  updateDepartmentCallTimes,
} from "@/lib/actions/shooting-days";
import {
  assignSceneToShootingDay,
  removeSceneFromShootingDay,
} from "@/lib/actions/scenes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ShootingDay, Scene, Location, CastMember } from "@/lib/types";
import type { Scene as StripeboardScene } from "@/lib/actions/scenes";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";

type ViewMode = "week" | "month" | "list" | "stripeboard";

interface ScheduleSectionProps {
  projectId: string;
  shootingDays: ShootingDay[];
  scenes: Scene[];
  locations?: Location[];
  cast?: CastMember[];
  stripeboardScenes?: StripeboardScene[];
  stripeboardCast?: CastMemberWithInviteStatus[];
  useMockData?: boolean;
}

export function ScheduleSection({
  projectId,
  shootingDays: initialShootingDays,
  scenes,
  locations = [],
  cast = [],
  stripeboardScenes = [],
  stripeboardCast = [],
  useMockData = false,
}: ScheduleSectionProps) {
  const viewModeLabel: Record<ViewMode, string> = {
    week: "Week",
    month: "Month",
    list: "List",
    stripeboard: "Stripboard",
  };

  const [showAddDay, setShowAddDay] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<ShootingDay | null>(null);
  const [showDetailPanel, setShowDetailPanel] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [deleting, setDeleting] = React.useState(false);
  const [isAiBuilding, setIsAiBuilding] = React.useState(false);
  const [aiAssumptions, setAiAssumptions] = React.useState<string[]>([]);
  const [defaultStartTime, setDefaultStartTime] = React.useState<string | undefined>();
  const [defaultEndTime, setDefaultEndTime] = React.useState<string | undefined>();

  // Local state for optimistic updates
  const [localShootingDays, setLocalShootingDays] = React.useState(initialShootingDays);

  // Sync local state with props when props change (e.g., after server revalidation)
  React.useEffect(() => {
    setLocalShootingDays(initialShootingDays);
  }, [initialShootingDays]);

  const {
    deleteShootingDay: deleteFromStore,
    updateShootingDay: updateInStore,
    updateScene: updateSceneInStore,
  } = useProjectStore();

  const sortedDays = React.useMemo(() => {
    return [...localShootingDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [localShootingDays]);

  const featuredDay = React.useMemo(() => {
    if (selectedDay) {
      return localShootingDays.find((day) => day.id === selectedDay.id) ?? selectedDay;
    }

    if (sortedDays.length === 0) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sortedDays.find((day) => new Date(day.date).getTime() >= today.getTime()) || sortedDays[0];
  }, [selectedDay, localShootingDays, sortedDays]);

  const featuredDayIndex = React.useMemo(() => {
    if (!featuredDay) return -1;
    return sortedDays.findIndex((day) => day.id === featuredDay.id);
  }, [featuredDay, sortedDays]);

  // Handler for rescheduling shooting days via drag and drop
  const handleReschedule = async (shootingDayId: string, newDate: string) => {
    // Find the original shooting day for potential rollback
    const originalDay = localShootingDays.find((d) => d.id === shootingDayId);
    if (!originalDay) return;

    const originalDate = originalDay.date;

    // Optimistic update - immediately update local state
    setLocalShootingDays((prev) =>
      prev.map((d) => (d.id === shootingDayId ? { ...d, date: newDate } : d))
    );

    try {
      if (useMockData) {
        updateInStore(shootingDayId, { date: newDate });
      } else {
        const result = await rescheduleShootingDay(shootingDayId, newDate);
        if (result.error) {
          console.error("Failed to reschedule:", result.error);
          // Rollback on error
          setLocalShootingDays((prev) =>
            prev.map((d) => (d.id === shootingDayId ? { ...d, date: originalDate } : d))
          );
          return;
        }
      }
    } catch (error) {
      console.error("Error rescheduling shooting day:", error);
      // Rollback on error
      setLocalShootingDays((prev) =>
        prev.map((d) => (d.id === shootingDayId ? { ...d, date: originalDate } : d))
      );
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      if (useMockData) {
        deleteFromStore(id);
      } else {
        const result = await deleteShootingDayAction(id, projectId);
        if (result.error) {
          alert("Failed to delete shooting day: " + result.error);
          return;
        }
      }
      // Optimistically remove from local state
      setLocalShootingDays((prev) => prev.filter((d) => d.id !== id));
      setSelectedDay(null);
      setShowDetailPanel(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<ShootingDay>) => {
    try {
      if (useMockData) {
        updateInStore(id, updates);
      } else {
        const result = await updateShootingDay(id, updates);
        if (result.error) {
          console.error("Failed to update:", result.error);
          return;
        }
      }
      // Optimistically update local state
      setLocalShootingDays((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      );
      // Update selected day with new values
      if (selectedDay && selectedDay.id === id) {
        setSelectedDay({ ...selectedDay, ...updates });
      }
    } catch (error) {
      console.error("Error updating shooting day:", error);
    }
  };

  const handleUpdateSceneOrder = async (shootingDayId: string, sceneIds: string[]) => {
    try {
      if (useMockData) {
        updateInStore(shootingDayId, { scenes: sceneIds });
      } else {
        const result = await updateSceneOrder(shootingDayId, sceneIds);
        if (result.error) {
          console.error("Failed to update scene order:", result.error);
          return;
        }
      }
      // Optimistically update local state
      setLocalShootingDays((prev) =>
        prev.map((d) => (d.id === shootingDayId ? { ...d, scenes: sceneIds } : d))
      );
      // Update selected day with new scene order
      if (selectedDay && selectedDay.id === shootingDayId) {
        setSelectedDay({ ...selectedDay, scenes: sceneIds });
      }
    } catch (error) {
      console.error("Error updating scene order:", error);
    }
  };

  const handleAddSceneToDay = async (sceneId: string, shootingDayId: string) => {
    try {
      const shootingDay = localShootingDays.find((d) => d.id === shootingDayId);
      if (!shootingDay) return;

      // Add scene to the shooting day's scenes list
      const newSceneIds = [...shootingDay.scenes, sceneId];

      if (useMockData) {
        updateInStore(shootingDayId, { scenes: newSceneIds });
        updateSceneInStore(sceneId, { status: "SCHEDULED" });
      } else {
        const result = await assignSceneToShootingDay(
          sceneId,
          shootingDayId,
          newSceneIds.length - 1,
          projectId
        );
        if (result.error) {
          console.error("Failed to add scene to day:", result.error);
          return;
        }
      }
      // Optimistically update local state
      setLocalShootingDays((prev) =>
        prev.map((d) => (d.id === shootingDayId ? { ...d, scenes: newSceneIds } : d))
      );
      // Update selected day with new scene order
      if (selectedDay && selectedDay.id === shootingDayId) {
        setSelectedDay({ ...selectedDay, scenes: newSceneIds });
      }
    } catch (error) {
      console.error("Error adding scene to day:", error);
    }
  };

  const handleRemoveSceneFromDay = async (sceneId: string, shootingDayId: string) => {
    try {
      const shootingDay = localShootingDays.find((d) => d.id === shootingDayId);
      if (!shootingDay) return;

      const newSceneIds = shootingDay.scenes.filter((id) => id !== sceneId);

      if (useMockData) {
        updateInStore(shootingDayId, { scenes: newSceneIds });
        updateSceneInStore(sceneId, { status: "NOT_SCHEDULED" });
      } else {
        const result = await removeSceneFromShootingDay(sceneId, shootingDayId, projectId);
        if (result.error) {
          console.error("Failed to remove scene from day:", result.error);
          return;
        }
      }
      // Optimistically update local state
      setLocalShootingDays((prev) =>
        prev.map((d) => (d.id === shootingDayId ? { ...d, scenes: newSceneIds } : d))
      );
      if (selectedDay && selectedDay.id === shootingDayId) {
        setSelectedDay({ ...selectedDay, scenes: newSceneIds });
      }
    } catch (error) {
      console.error("Error removing scene from day:", error);
    }
  };

  const handleUpdateCastCallTimes = async (
    shootingDayId: string,
    castTimes: Array<{
      castMemberId: string;
      workStatus: string;
      pickupTime?: string;
      muHairCall?: string;
      onSetCall?: string;
      remarks?: string;
    }>
  ) => {
    try {
      if (!useMockData) {
        const result = await updateCastCallTimes(
          shootingDayId,
          castTimes as Parameters<typeof updateCastCallTimes>[1]
        );
        if (result.error) {
          console.error("Failed to update cast call times:", result.error);
          return;
        }
      }
    } catch (error) {
      console.error("Error updating cast call times:", error);
    }
  };

  const handleUpdateDepartmentCallTimes = async (
    shootingDayId: string,
    deptTimes: Array<{
      department: string;
      callTime: string;
      notes?: string;
    }>
  ) => {
    try {
      if (!useMockData) {
        const result = await updateDepartmentCallTimes(shootingDayId, deptTimes);
        if (result.error) {
          console.error("Failed to update department call times:", result.error);
          return;
        }
      }
    } catch (error) {
      console.error("Error updating department call times:", error);
    }
  };

  const handleDayClick = (date: Date, events?: ShootingDay[]) => {
    if (events && events.length > 0) {
      setSelectedDate(date);
      setSelectedDay(events[0]);
      setShowDetailPanel(true);
    } else {
      const dayEvents = localShootingDays.filter((day) =>
        isSameDay(new Date(day.date), date)
      );
      if (dayEvents.length > 0) {
        setSelectedDate(date);
        setSelectedDay(dayEvents[0]);
        setShowDetailPanel(true);
      } else {
        setSelectedDate(date);
        setShowAddDay(true);
      }
    }
  };

  const handleAddClick = (date: Date, startTime?: string, endTime?: string) => {
    setSelectedDate(date);
    setDefaultStartTime(startTime);
    setDefaultEndTime(endTime);
    setShowAddDay(true);
  };

  const handleAiBuildSchedule = async () => {
    if (isAiBuilding) return;

    if (scenes.length === 0) {
      toast.error("No scenes available to schedule yet");
      return;
    }

    if (
      localShootingDays.length > 0 &&
      !confirm(
        "Smart build will replace the current shooting-day schedule for this project. Continue?"
      )
    ) {
      return;
    }

    setIsAiBuilding(true);
    setAiAssumptions([]);

    try {
      const response = await fetch("/api/ai/schedule/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          replaceExisting: true,
          maxScenesPerDay: 8,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        data?: {
          shootingDays?: ShootingDay[];
          assumptions?: string[];
          stats?: {
            daysCreated: number;
            scenesAssigned: number;
            scenesUnscheduled: number;
          };
        };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to build schedule");
      }

      const plannedDays = payload.data?.shootingDays || [];
      setLocalShootingDays(plannedDays);
      setAiAssumptions(payload.data?.assumptions || []);

      if (plannedDays.length > 0) {
        setSelectedDay(plannedDays[0]);
        setSelectedDate(new Date(plannedDays[0].date));
      } else {
        setSelectedDay(null);
        setSelectedDate(null);
      }

      const stats = payload.data?.stats;
      if (stats) {
        toast.success(
          `Smart schedule created: ${stats.daysCreated} days, ${stats.scenesAssigned} scenes assigned`
        );
      } else {
        toast.success("Smart schedule built successfully");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to build Smart schedule";
      toast.error(message);
    } finally {
      setIsAiBuilding(false);
    }
  };

  const getSceneNumbers = (sceneIds: string[]) => {
    return sceneIds
      .map((id) => scenes.find((s) => s.id === id)?.sceneNumber)
      .filter(Boolean)
      .join(", ");
  };

  const getDayEvents = (date: Date) => {
    return localShootingDays.filter((day) => isSameDay(new Date(day.date), date));
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

  const selectDayContext = (day: ShootingDay) => {
    setSelectedDay(day);
    setSelectedDate(new Date(day.date));
  };

  const navigateDayContext = (direction: -1 | 1) => {
    if (featuredDayIndex < 0) return;
    const nextIndex = featuredDayIndex + direction;
    if (nextIndex < 0 || nextIndex >= sortedDays.length) return;
    selectDayContext(sortedDays[nextIndex]);
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Main Calendar Area */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {localShootingDays.length} day{localShootingDays.length !== 1 ? "s" : ""} ·{" "}
              {localShootingDays.filter((d) => d.status === "COMPLETED").length} wrapped
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
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
                <LayoutList className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("stripeboard")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "stripeboard"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Stripboard
              </button>
            </div>

            <Button size="sm" variant="skeuo" onClick={() => setShowAddDay(true)}>
              <Plus className="h-4 w-4" />
              Add Day
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleAiBuildSchedule()}
              disabled={isAiBuilding || scenes.length === 0}
            >
              {isAiBuilding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4 text-primary" />
              )}
              Smart Build Schedule
            </Button>
          </div>
        </div>

        {aiAssumptions.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="text-xs font-medium text-primary">Smart assumptions</p>
            <p className="text-xs text-muted-foreground mt-1">
              {aiAssumptions.slice(0, 2).join(" ")}
            </p>
          </div>
        )}

        <div
          className={cn(
            "grid gap-4",
            viewMode === "stripeboard"
              ? "grid-cols-1"
              : "xl:grid-cols-[minmax(0,1fr)_340px]"
          )}
        >
          <div className="min-w-0">
            {/* Draggable Week Calendar */}
            {viewMode === "week" && (
              <DraggableWeekCalendar
                shootingDays={localShootingDays}
                scenes={scenes}
                cast={cast}
                locations={locations}
                onDayClick={handleDayClick}
                onAddClick={handleAddClick}
                onReschedule={handleReschedule}
                onAddSceneToDay={handleAddSceneToDay}
                onRemoveSceneFromDay={handleRemoveSceneFromDay}
                onUpdateSceneOrder={handleUpdateSceneOrder}
                selectedDate={selectedDate || undefined}
              />
            )}

            {/* Draggable Month Calendar */}
            {viewMode === "month" && (
              <DraggableCalendar
                shootingDays={localShootingDays}
                scenes={scenes}
                cast={cast}
                locations={locations}
                onDayClick={handleDayClick}
                onAddClick={handleAddClick}
                onReschedule={handleReschedule}
                selectedDate={selectedDate || undefined}
              />
            )}

            {/* List View */}
            {viewMode === "list" && (
              <>
                {sortedDays.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Day
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Call
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Wrap
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Scenes
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sortedDays.map((day) => (
                          <tr
                            key={day.id}
                            className="hover:bg-muted/40 transition-colors cursor-pointer group"
                            onClick={() => {
                              setSelectedDate(new Date(day.date));
                              setSelectedDay(day);
                              setShowDetailPanel(true);
                            }}
                          >
                            <td className="px-4 py-3 font-medium">
                              Day {day.dayNumber}
                              {day.unit !== "MAIN" && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  ({day.unit})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {format(new Date(day.date), "EEE, MMM d")}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {day.generalCall}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {day.wrapTime || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {day.scenes.length > 0
                                ? getSceneNumbers(day.scenes)
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-medium",
                                  getStatusBadge(day.status)
                                )}
                              >
                                {day.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                disabled={deleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this shooting day?"
                                    )
                                  ) {
                                    handleDelete(day.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-lg px-4 py-12 text-center">
                    <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <h3 className="font-medium mb-1">No shooting days scheduled</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add shooting days to build your production schedule
                    </p>
                    <Button variant="skeuo" onClick={() => setShowAddDay(true)}>
                      <Plus className="h-4 w-4" />
                      Schedule First Day
                    </Button>
                  </div>
                )}
              </>
            )}

            {viewMode === "stripeboard" && (
              <StripeboardSection
                projectId={projectId}
                scenes={stripeboardScenes}
                cast={stripeboardCast}
                shootingDays={localShootingDays}
              />
            )}
          </div>

          {viewMode !== "stripeboard" && (
          <aside className="min-w-0">
            <div className="rounded-lg border border-border bg-muted/20 p-3 xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/70">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {viewModeLabel[viewMode]} view context
                  </p>
                  {featuredDay ? (
                    <p className="text-sm font-medium mt-0.5">
                      Day {featuredDay.dayNumber} ·{" "}
                      {format(new Date(featuredDay.date), "EEE, MMM d")}
                    </p>
                  ) : (
                    <p className="text-sm font-medium mt-0.5">No shooting days yet</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="h-7 w-7"
                    disabled={featuredDayIndex <= 0}
                    onClick={() => navigateDayContext(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="h-7 w-7"
                    disabled={featuredDayIndex < 0 || featuredDayIndex >= sortedDays.length - 1}
                    onClick={() => navigateDayContext(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <DailyFilmSchedule
                shootingDay={featuredDay}
                sceneCount={featuredDay?.scenes.length || 0}
                title={featuredDay ? "Day Run-of-Day" : "Daily Film Schedule Template"}
                description={
                  featuredDay
                    ? "Synced to the selected day in your current schedule view."
                    : "Add or select a shooting day to sync this timeline."
                }
                className="mt-3 border-0 bg-transparent p-0"
              />

              <Button
                variant="outline"
                className="w-full mt-3"
                disabled={!featuredDay}
                onClick={() => {
                  if (!featuredDay) return;
                  selectDayContext(featuredDay);
                  setShowDetailPanel(true);
                }}
              >
                Open Day Details
              </Button>
            </div>
          </aside>
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
        onUpdateCastCallTimes={handleUpdateCastCallTimes}
        onUpdateDepartmentCallTimes={handleUpdateDepartmentCallTimes}
        useMockData={useMockData}
      />

      <AddShootingDayForm
        projectId={projectId}
        open={showAddDay}
        onOpenChange={(open) => {
          setShowAddDay(open);
          if (!open) {
            // Reset times when form closes
            setDefaultStartTime(undefined);
            setDefaultEndTime(undefined);
          }
        }}
        defaultDate={selectedDate || undefined}
        defaultStartTime={defaultStartTime}
        defaultEndTime={defaultEndTime}
        useMockData={useMockData}
        existingShootingDays={localShootingDays}
        availableScenes={scenes}
        onSuccess={() => {
          // The realtime subscription should handle the update,
          // but we can also trigger a refetch via page revalidation
          // by updating local state optimistically
        }}
      />
    </div>
  );
}
