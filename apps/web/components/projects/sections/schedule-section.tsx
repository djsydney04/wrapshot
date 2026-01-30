"use client";

import * as React from "react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  Plus,
  Calendar as CalendarIcon,
  Trash2,
  LayoutList,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { DraggableWeekCalendar } from "@/components/calendar/draggable-week-calendar";
import { DraggableCalendar } from "@/components/calendar/draggable-calendar";
import { ShootingDayDetailPanel } from "@/components/schedule/shooting-day-detail-panel";
import { useProjectStore } from "@/lib/stores/project-store";
import {
  deleteShootingDay as deleteShootingDayAction,
  rescheduleShootingDay,
  updateShootingDay,
  updateSceneOrder,
  updateCastCallTimes,
  updateDepartmentCallTimes,
} from "@/lib/actions/shooting-days";
import { cn } from "@/lib/utils";
import type { ShootingDay, Scene, Location, CastMember } from "@/lib/mock-data";

type ViewMode = "week" | "month" | "list";

interface ScheduleSectionProps {
  projectId: string;
  shootingDays: ShootingDay[];
  scenes: Scene[];
  locations?: Location[];
  cast?: CastMember[];
  useMockData?: boolean;
}

export function ScheduleSection({
  projectId,
  shootingDays,
  scenes,
  locations = [],
  cast = [],
  useMockData = true,
}: ScheduleSectionProps) {
  const [showAddDay, setShowAddDay] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<ShootingDay | null>(null);
  const [showDetailPanel, setShowDetailPanel] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [deleting, setDeleting] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const {
    deleteShootingDay: deleteFromStore,
    updateShootingDay: updateInStore,
  } = useProjectStore();

  const sortedDays = React.useMemo(() => {
    return [...shootingDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [shootingDays]);

  // Handler for rescheduling shooting days via drag and drop
  const handleReschedule = async (shootingDayId: string, newDate: string) => {
    try {
      if (useMockData) {
        updateInStore(shootingDayId, { date: newDate });
      } else {
        const result = await rescheduleShootingDay(shootingDayId, newDate);
        if (result.error) {
          console.error("Failed to reschedule:", result.error);
          return;
        }
      }
      forceUpdate();
    } catch (error) {
      console.error("Error rescheduling shooting day:", error);
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
      setSelectedDay(null);
      setShowDetailPanel(false);
      forceUpdate();
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
      // Update selected day with new values
      if (selectedDay && selectedDay.id === id) {
        setSelectedDay({ ...selectedDay, ...updates });
      }
      forceUpdate();
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
      // Update selected day with new scene order
      if (selectedDay && selectedDay.id === shootingDayId) {
        setSelectedDay({ ...selectedDay, scenes: sceneIds });
      }
      forceUpdate();
    } catch (error) {
      console.error("Error updating scene order:", error);
    }
  };

  const handleAddSceneToDay = async (sceneId: string, shootingDayId: string) => {
    try {
      const shootingDay = shootingDays.find((d) => d.id === shootingDayId);
      if (!shootingDay) return;

      // Add scene to the shooting day's scenes list
      const newSceneIds = [...shootingDay.scenes, sceneId];

      if (useMockData) {
        updateInStore(shootingDayId, { scenes: newSceneIds });
      } else {
        const result = await updateSceneOrder(shootingDayId, newSceneIds);
        if (result.error) {
          console.error("Failed to add scene to day:", result.error);
          return;
        }
      }
      // Update selected day with new scene order
      if (selectedDay && selectedDay.id === shootingDayId) {
        setSelectedDay({ ...selectedDay, scenes: newSceneIds });
      }
      forceUpdate();
    } catch (error) {
      console.error("Error adding scene to day:", error);
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
      forceUpdate();
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
      forceUpdate();
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
      const dayEvents = shootingDays.filter((day) =>
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

  const handleAddClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddDay(true);
  };

  const getSceneNumbers = (sceneIds: string[]) => {
    return sceneIds
      .map((id) => scenes.find((s) => s.id === id)?.sceneNumber)
      .filter(Boolean)
      .join(", ");
  };

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) => isSameDay(new Date(day.date), date));
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

  // Navigation handlers for list view
  const navigatePrev = () => {
    if (viewMode === "week") {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => subMonths(prev, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "week") {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Main Calendar Area */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {shootingDays.length} day{shootingDays.length !== 1 ? "s" : ""} ·{" "}
              {shootingDays.filter((d) => d.status === "COMPLETED").length} wrapped
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
            </div>

            <Button size="sm" onClick={() => setShowAddDay(true)}>
              <Plus className="h-4 w-4" />
              Add Day
            </Button>
          </div>
        </div>

        {/* Draggable Week Calendar */}
        {viewMode === "week" && (
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
          />
        )}

        {/* Draggable Month Calendar */}
        {viewMode === "month" && (
          <DraggableCalendar
            shootingDays={shootingDays}
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
                <Button onClick={() => setShowAddDay(true)}>
                  <Plus className="h-4 w-4" />
                  Schedule First Day
                </Button>
              </div>
            )}
          </>
        )}
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
        onOpenChange={setShowAddDay}
        onSuccess={forceUpdate}
        defaultDate={selectedDate || undefined}
        useMockData={useMockData}
      />
    </div>
  );
}
