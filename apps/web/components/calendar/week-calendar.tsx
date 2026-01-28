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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM
const HOUR_HEIGHT = 52; // pixels per hour

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
    const startHour = 6; // Calendar starts at 6 AM
    const top = ((hours - startHour) * 60 + minutes) * (HOUR_HEIGHT / 60);
    return Math.max(0, top);
  };

  const getEventDuration = (event: ShootingDay) => {
    const [startHours, startMinutes] = event.generalCall.split(":").map(Number);

    if (event.wrapTime) {
      const [endHours, endMinutes] = event.wrapTime.split(":").map(Number);
      let startTotal = startHours * 60 + startMinutes;
      let endTotal = endHours * 60 + endMinutes;

      // Handle overnight shoots
      if (endTotal <= startTotal) {
        endTotal += 24 * 60;
      }

      const durationMinutes = endTotal - startTotal;
      return (durationMinutes / 60) * HOUR_HEIGHT;
    }

    // Default to 10 hours if no wrap time
    return 10 * HOUR_HEIGHT;
  };

  const getEventColor = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/90 hover:bg-emerald-500";
      case "CONFIRMED":
        return "bg-blue-500/90 hover:bg-blue-500";
      case "SCHEDULED":
        return "bg-amber-500/90 hover:bg-amber-500";
      case "TENTATIVE":
        return "bg-neutral-400/90 hover:bg-neutral-400";
      case "CANCELLED":
        return "bg-red-400/90 hover:bg-red-400";
      default:
        return "bg-neutral-400/90 hover:bg-neutral-400";
    }
  };

  const formatTimeRange = (event: ShootingDay) => {
    const start = event.generalCall;
    const end = event.wrapTime || "—";
    return `${start} – ${end}`;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">
            {format(currentWeek, "MMMM yyyy")}
          </h2>
          <span className="text-sm text-muted-foreground">
            Week of {format(currentWeek, "MMM d")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCurrentWeek((prev) => subWeeks(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm"
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCurrentWeek((prev) => addWeeks(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border border-border rounded-lg overflow-hidden flex flex-col min-h-0">
        {/* Day Headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border bg-muted/30 flex-shrink-0">
          <div className="p-2" />
          {weekDays.map((day, index) => {
            const isCurrentDay = isToday(day);
            const events = getDayEvents(day);
            return (
              <div
                key={index}
                className={cn(
                  "py-3 px-2 text-center border-l border-border",
                  isCurrentDay && "bg-blue-50/50 dark:bg-blue-950/20"
                )}
              >
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold mt-0.5",
                    isCurrentDay && "text-blue-600 dark:text-blue-400"
                  )}
                >
                  {format(day, "d")}
                </div>
                {events.length > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {events.slice(0, 3).map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="flex-1 overflow-auto">
          <div
            className="grid grid-cols-[56px_repeat(7,1fr)] relative"
            style={{ minHeight: `${HOURS.length * HOUR_HEIGHT}px` }}
          >
            {/* Time Labels */}
            <div className="relative border-r border-border">
              {HOURS.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                  style={{ top: `${i * HOUR_HEIGHT}px` }}
                >
                  {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
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
                    isCurrentDay && "bg-blue-50/30 dark:bg-blue-950/10"
                  )}
                >
                  {/* Hour Lines */}
                  {HOURS.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: `${i * HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {/* Click to add overlay */}
                  <button
                    className="absolute inset-0 hover:bg-muted/20 transition-colors group"
                    onClick={() => onAddClick?.(day)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>

                  {/* Events */}
                  {events.map((event) => {
                    const top = getEventPosition(event.generalCall);
                    const height = getEventDuration(event);

                    return (
                      <button
                        key={event.id}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg px-2.5 py-2 text-white text-left cursor-pointer z-10",
                          "transition-all shadow-sm",
                          getEventColor(event.status)
                        )}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, HOUR_HEIGHT)}px`,
                          minHeight: "48px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick?.(day, [event]);
                        }}
                      >
                        <div className="font-semibold text-sm">Day {event.dayNumber}</div>
                        <div className="text-xs opacity-90 mt-0.5">
                          {formatTimeRange(event)}
                        </div>
                        {height >= HOUR_HEIGHT * 2 && (
                          <>
                            <div className="text-xs opacity-80 mt-1">
                              {event.unit} Unit
                            </div>
                            {event.scenes.length > 0 && (
                              <div className="text-xs opacity-70 mt-0.5">
                                {event.scenes.length} scene{event.scenes.length !== 1 ? "s" : ""}
                              </div>
                            )}
                          </>
                        )}
                        {height >= HOUR_HEIGHT * 4 && event.notes && (
                          <div className="text-[11px] opacity-60 mt-2 line-clamp-2">
                            {event.notes}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
