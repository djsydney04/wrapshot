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
  Clapperboard,
  CalendarRange,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { useProjectStore } from "@/lib/stores/project-store";
import { deleteShootingDay as deleteShootingDayAction } from "@/lib/actions/shooting-days";
import { cn } from "@/lib/utils";
import type { ShootingDay, Scene, Location } from "@/lib/mock-data";

type ViewMode = "week" | "month" | "list";

interface ScheduleSectionProps {
  projectId: string;
  shootingDays: ShootingDay[];
  scenes: Scene[];
  locations?: Location[];
  useMockData?: boolean; // Flag to use mock data instead of database
}

export function ScheduleSection({
  projectId,
  shootingDays,
  scenes,
  locations = [],
  useMockData = true, // Default to mock data for now
}: ScheduleSectionProps) {
  const [showAddDay, setShowAddDay] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<ShootingDay | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [deleting, setDeleting] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { deleteShootingDay: deleteFromStore } = useProjectStore();

  const sortedDays = React.useMemo(() => {
    return [...shootingDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [shootingDays]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this shooting day?")) {
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
        forceUpdate();
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleDayClick = (date: Date) => {
    const events = getDayEvents(date);
    if (events.length > 0) {
      setSelectedDate(date);
      setSelectedDay(events[0]);
    } else {
      setSelectedDate(date);
      setShowAddDay(true);
    }
  };

  const getSceneNumbers = (sceneIds: string[]) => {
    return sceneIds
      .map((id) => scenes.find((s) => s.id === id)?.sceneNumber)
      .filter(Boolean)
      .join(", ");
  };

  const getSceneDetails = (sceneIds: string[]) => {
    return scenes.filter((s) => sceneIds.includes(s.id));
  };

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) => isSameDay(new Date(day.date), date));
  };

  const getEventColor = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500";
      case "CONFIRMED":
        return "bg-blue-500";
      case "SCHEDULED":
        return "bg-amber-500";
      case "TENTATIVE":
        return "bg-neutral-400";
      case "CANCELLED":
        return "bg-red-400";
      default:
        return "bg-neutral-400";
    }
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

  // Navigation handlers
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

  // Calculate calendar days
  const calendarDays = React.useMemo(() => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  }, [currentDate, viewMode]);

  const getLocationName = (day: ShootingDay) => {
    if (day.locationId) {
      const location = locations.find((l) => l.id === day.locationId);
      return location?.name;
    }
    return null;
  };

  return (
    <div className="flex gap-6">
      {/* Main Calendar Area */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={navigatePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <h2 className="text-lg font-semibold">
              {viewMode === "week"
                ? format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d") + " – " + format(endOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d, yyyy")
                : format(currentDate, "MMMM yyyy")}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">
              {shootingDays.length} day{shootingDays.length !== 1 ? "s" : ""} · {shootingDays.filter((d) => d.status === "COMPLETED").length} wrapped
            </span>

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

        {/* Calendar View (Week or Month) */}
        {viewMode !== "list" && (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-muted/30">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground border-b border-border"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const events = getDayEvents(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "relative p-2 text-left border-b border-r border-border transition-colors",
                      viewMode === "week" ? "min-h-[140px]" : "min-h-[100px]",
                      "hover:bg-muted/40",
                      !isCurrentMonth && "bg-muted/20",
                      isSelected && "bg-muted/60",
                      index % 7 === 6 && "border-r-0",
                      index >= calendarDays.length - 7 && "border-b-0"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                        !isCurrentMonth && "text-muted-foreground/60",
                        isCurrentDay && "bg-foreground text-background font-medium"
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {/* Events */}
                    <div className="mt-1 space-y-0.5">
                      {events.slice(0, viewMode === "week" ? 3 : 2).map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] text-white font-medium truncate",
                            getEventColor(event.status)
                          )}
                        >
                          Day {event.dayNumber}
                          {viewMode === "week" && (
                            <span className="opacity-80 ml-1">· {event.generalCall}</span>
                          )}
                        </div>
                      ))}
                      {events.length > (viewMode === "week" ? 3 : 2) && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          +{events.length - (viewMode === "week" ? 3 : 2)} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <>
            {sortedDays.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Call</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Wrap</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scenes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
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
                        }}
                      >
                        <td className="px-4 py-3 font-medium">
                          Day {day.dayNumber}
                          {day.unit !== "MAIN" && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({day.unit})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {format(new Date(day.date), "EEE, MMM d")}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{day.generalCall}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{day.wrapTime || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {day.scenes.length > 0 ? getSceneNumbers(day.scenes) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusBadge(day.status))}>
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
                              handleDelete(day.id);
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

      {/* Side Panel - Day Details */}
      {selectedDay && (
        <div className="w-[320px] border border-border rounded-lg bg-card overflow-hidden flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
            <div>
              <h3 className="font-semibold">Day {selectedDay.dayNumber}</h3>
              <p className="text-sm text-muted-foreground">
                {format(new Date(selectedDay.date), "EEEE, MMMM d")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                setSelectedDay(null);
                setSelectedDate(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Status & Unit */}
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusBadge(selectedDay.status))}>
                {selectedDay.status}
              </span>
              {selectedDay.unit !== "MAIN" && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                  {selectedDay.unit} Unit
                </span>
              )}
            </div>

            {/* Times */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Call:</span>
                <span className="font-medium">{selectedDay.generalCall}</span>
              </div>
              {selectedDay.wrapTime && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Wrap:</span>
                  <span className="font-medium">{selectedDay.wrapTime}</span>
                </div>
              )}
              {getLocationName(selectedDay) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getLocationName(selectedDay)}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {selectedDay.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">{selectedDay.notes}</p>
              </div>
            )}

            {/* Scenes */}
            {selectedDay.scenes.length > 0 && (
              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Scenes ({selectedDay.scenes.length})
                </h4>
                <div className="space-y-2">
                  {getSceneDetails(selectedDay.scenes).map((scene) => (
                    <div key={scene.id} className="rounded-lg bg-muted/50 p-2.5">
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1">
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={deleting}
                onClick={() => handleDelete(selectedDay.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

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
