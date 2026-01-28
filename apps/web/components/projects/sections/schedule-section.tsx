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
  isBefore,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";
import type { ShootingDay, Scene, Location } from "@/lib/mock-data";

type ViewMode = "week" | "month" | "list";

interface ScheduleSectionProps {
  projectId: string;
  shootingDays: ShootingDay[];
  scenes: Scene[];
  locations?: Location[];
}

export function ScheduleSection({
  projectId,
  shootingDays,
  scenes,
  locations = [],
}: ScheduleSectionProps) {
  const [showAddDay, setShowAddDay] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { deleteShootingDay } = useProjectStore();

  const sortedDays = React.useMemo(() => {
    return [...shootingDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [shootingDays]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this shooting day?")) {
      deleteShootingDay(id);
      forceUpdate();
    }
  };

  const handleDayClick = (date: Date) => {
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

  const getStatusColor = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-[hsl(var(--status-success))]";
      case "CONFIRMED":
        return "bg-[hsl(var(--status-info))]";
      case "SCHEDULED":
        return "bg-[hsl(var(--status-warning))]";
      case "TENTATIVE":
        return "bg-muted-foreground/50";
      case "CANCELLED":
        return "bg-destructive";
      default:
        return "bg-muted-foreground/50";
    }
  };

  const statusVariant = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "completed";
      case "CONFIRMED":
        return "production";
      case "SCHEDULED":
        return "pre-production";
      case "CANCELLED":
        return "destructive";
      default:
        return "secondary";
    }
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
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-lg font-semibold">
            {viewMode === "week"
              ? `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`
              : format(currentDate, "MMMM yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <span className="text-sm text-muted-foreground mr-2">
            {shootingDays.length} days · {shootingDays.filter((d) => d.status === "COMPLETED").length} completed
          </span>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          <Button size="sm" onClick={() => setShowAddDay(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Day
          </Button>
        </div>
      </div>

      {/* Calendar View (Week or Month) */}
      {viewMode !== "list" && (
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
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
              const isPast = isBefore(day, new Date()) && !isCurrentDay;

              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "relative p-2 text-left border-b border-r border-border transition-colors",
                    viewMode === "week" ? "min-h-[140px]" : "min-h-[100px]",
                    "hover:bg-muted/50",
                    !isCurrentMonth && "bg-muted/30",
                    isPast && "opacity-60",
                    index % 7 === 6 && "border-r-0",
                    // Last row
                    index >= calendarDays.length - 7 && "border-b-0"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                      !isCurrentMonth && "text-muted-foreground",
                      isCurrentDay && "bg-primary text-primary-foreground font-medium"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Events */}
                  <div className="mt-1 space-y-1">
                    {events.slice(0, viewMode === "week" ? 4 : 2).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "rounded px-1.5 py-1 text-xs text-white truncate",
                          getStatusColor(event.status)
                        )}
                      >
                        <div className="font-medium">Day {event.dayNumber}</div>
                        {viewMode === "week" && (
                          <div className="opacity-80">
                            {event.generalCall} · {event.scenes.length} scenes
                          </div>
                        )}
                      </div>
                    ))}
                    {events.length > (viewMode === "week" ? 4 : 2) && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{events.length - (viewMode === "week" ? 4 : 2)} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List underneath calendar (when in week/month view) */}
      {viewMode !== "list" && sortedDays.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            All Shooting Days
          </h3>
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {sortedDays.map((day) => (
              <div
                key={day.id}
                className="flex items-center gap-4 p-4 bg-card hover:bg-muted/30 transition-colors group"
              >
                {/* Date badge */}
                <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-muted shrink-0">
                  <span className="text-[10px] uppercase text-muted-foreground font-medium">
                    {format(new Date(day.date), "MMM")}
                  </span>
                  <span className="text-xl font-bold leading-none">
                    {format(new Date(day.date), "d")}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Day {day.dayNumber}</span>
                    <Badge variant={statusVariant(day.status)} className="text-xs">
                      {day.status}
                    </Badge>
                    {day.unit !== "MAIN" && (
                      <Badge variant="outline" className="text-xs">
                        {day.unit}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {day.generalCall}
                      {day.wrapTime && ` - ${day.wrapTime}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clapperboard className="h-3.5 w-3.5" />
                      {day.scenes.length} scenes
                      {day.scenes.length > 0 && ` (${getSceneNumbers(day.scenes)})`}
                    </span>
                    {getLocationName(day) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {getLocationName(day)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(day.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View Only */}
      {viewMode === "list" && (
        <>
          {sortedDays.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Day</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Call</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Wrap</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scenes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedDays.map((day) => (
                    <tr key={day.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 font-medium">Day {day.dayNumber}</td>
                      <td className="px-4 py-3">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={day.unit === "MAIN" ? "default" : "secondary"}>
                          {day.unit}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{day.generalCall}</td>
                      <td className="px-4 py-3 text-muted-foreground">{day.wrapTime || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {day.scenes.length > 0 ? getSceneNumbers(day.scenes) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(day.status)}>
                          {day.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(day.id)}
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
            <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
              <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="font-medium mb-1">No shooting days scheduled</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add shooting days to build your production schedule
              </p>
              <Button onClick={() => setShowAddDay(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Schedule First Day
              </Button>
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-success))]" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-info))]" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-warning))]" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
          <span>Tentative</span>
        </div>
      </div>

      <AddShootingDayForm
        projectId={projectId}
        open={showAddDay}
        onOpenChange={setShowAddDay}
        onSuccess={forceUpdate}
        defaultDate={selectedDate || undefined}
      />
    </div>
  );
}
