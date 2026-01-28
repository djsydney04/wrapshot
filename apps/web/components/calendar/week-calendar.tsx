"use client";

import * as React from "react";
import {
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ShootingDay, Scene } from "@/lib/mock-data";

interface WeekCalendarProps {
  shootingDays: ShootingDay[];
  scenes: Scene[];
  onDayClick?: (date: Date, events: ShootingDay[]) => void;
  onAddClick?: (date: Date) => void;
  selectedDate?: Date;
  className?: string;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 AM to 10 PM (extended range)
const HOUR_HEIGHT = 48; // pixels per hour

export function WeekCalendar({
  shootingDays,
  scenes,
  onDayClick,
  onAddClick,
  selectedDate,
  className,
}: WeekCalendarProps) {
  const [currentWeek, setCurrentWeek] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) =>
      isSameDay(parseISO(day.date), date)
    );
  };

  const getEventPosition = (callTime: string) => {
    const [hours, minutes] = callTime.split(":").map(Number);
    const startHour = 5; // Calendar starts at 5 AM
    const top = ((hours - startHour) * 60 + minutes) * (HOUR_HEIGHT / 60);
    return top;
  };

  const getEventDuration = (event: ShootingDay) => {
    const [startHours, startMinutes] = event.generalCall.split(":").map(Number);

    if (event.wrapTime) {
      const [endHours, endMinutes] = event.wrapTime.split(":").map(Number);
      let startTotal = startHours * 60 + startMinutes;
      let endTotal = endHours * 60 + endMinutes;

      // Handle overnight shoots (wrap time is next day)
      if (endTotal <= startTotal) {
        endTotal += 24 * 60;
      }

      const durationMinutes = endTotal - startTotal;
      return (durationMinutes / 60) * HOUR_HEIGHT;
    }

    // Default to 8 hours if no wrap time
    return 8 * HOUR_HEIGHT;
  };

  const formatDuration = (event: ShootingDay) => {
    const [startHours, startMinutes] = event.generalCall.split(":").map(Number);

    if (event.wrapTime) {
      const [endHours, endMinutes] = event.wrapTime.split(":").map(Number);
      let startTotal = startHours * 60 + startMinutes;
      let endTotal = endHours * 60 + endMinutes;

      if (endTotal <= startTotal) {
        endTotal += 24 * 60;
      }

      const durationMinutes = endTotal - startTotal;
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;

      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    }

    return "~8h";
  };

  const getStatusColor = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/90 border-green-600 hover:bg-green-500";
      case "CONFIRMED":
        return "bg-blue-500/90 border-blue-600 hover:bg-blue-500";
      case "SCHEDULED":
        return "bg-yellow-500/90 border-yellow-600 hover:bg-yellow-500";
      case "TENTATIVE":
        return "bg-gray-400/90 border-gray-500 hover:bg-gray-400";
      case "CANCELLED":
        return "bg-red-500/90 border-red-600 hover:bg-red-500";
      default:
        return "bg-gray-400/90 border-gray-500 hover:bg-gray-400";
    }
  };

  const getSceneCount = (day: ShootingDay) => {
    return day.scenes.length;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(currentWeek, "MMMM yyyy")}
          </h2>
          <span className="text-sm text-muted-foreground">
            Week of {format(currentWeek, "MMM d")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentWeek((prev) => subWeeks(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentWeek((prev) => addWeeks(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border border-border rounded-lg overflow-hidden flex flex-col min-h-0">
        {/* Day Headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/50 flex-shrink-0">
          <div className="p-2" /> {/* Time column header */}
          {weekDays.map((day, index) => {
            const isCurrentDay = isToday(day);
            const events = getDayEvents(day);
            return (
              <div
                key={index}
                className={cn(
                  "p-2 text-center border-l border-border",
                  isCurrentDay && "bg-primary/5"
                )}
              >
                <div className="text-xs text-muted-foreground uppercase">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "text-lg font-medium mt-0.5",
                    isCurrentDay &&
                      "bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                  )}
                >
                  {format(day, "d")}
                </div>
                {events.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {events.length} shoot{events.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ minHeight: `${HOURS.length * HOUR_HEIGHT}px` }}>
            {/* Time Labels */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-border pr-2 text-right"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-xs text-muted-foreground -mt-2 block">
                    {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {weekDays.map((day, dayIndex) => {
              const events = getDayEvents(day);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "relative border-l border-border",
                    isCurrentDay && "bg-primary/5"
                  )}
                >
                  {/* Hour Lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() => onAddClick?.(day)}
                    >
                      <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full transition-opacity">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}

                  {/* Events */}
                  {events.map((event) => {
                    const top = getEventPosition(event.generalCall);
                    const height = getEventDuration(event);
                    const sceneCount = getSceneCount(event);
                    const duration = formatDuration(event);

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute left-1 right-1 rounded-md px-2 py-1.5 text-white text-xs cursor-pointer",
                          "border-l-4 shadow-sm transition-all overflow-hidden",
                          getStatusColor(event.status)
                        )}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, HOUR_HEIGHT)}px`,
                          minHeight: `${HOUR_HEIGHT}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick?.(day, [event]);
                        }}
                      >
                        <div className="font-semibold text-sm">Day {event.dayNumber}</div>
                        <div className="opacity-90 flex items-center gap-1 mt-0.5">
                          <span>{event.generalCall}</span>
                          {event.wrapTime && (
                            <>
                              <span>—</span>
                              <span>{event.wrapTime}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] opacity-80">
                          <span>{event.unit}</span>
                          {sceneCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{sceneCount} scene{sceneCount > 1 ? "s" : ""}</span>
                            </>
                          )}
                        </div>
                        {height >= HOUR_HEIGHT * 2 && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] opacity-70">
                            <Clock className="h-3 w-3" />
                            <span>{duration}</span>
                          </div>
                        )}
                        {event.notes && height >= HOUR_HEIGHT * 3 && (
                          <div className="mt-2 text-[11px] opacity-70 line-clamp-2">
                            {event.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-yellow-500" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gray-400" />
          <span>Tentative</span>
        </div>
      </div>
    </div>
  );
}
