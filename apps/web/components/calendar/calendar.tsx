"use client";

import * as React from "react";
import {
  addMonths,
  subMonths,
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ShootingDay } from "@/lib/mock-data";

interface CalendarProps {
  shootingDays: ShootingDay[];
  onDayClick?: (date: Date, events: ShootingDay[]) => void;
  onAddClick?: (date: Date) => void;
  selectedDate?: Date;
  className?: string;
}

export function Calendar({
  shootingDays,
  onDayClick,
  onAddClick,
  selectedDate,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) =>
      isSameDay(new Date(day.date), date)
    );
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
        return "bg-red-400 line-through";
      default:
        return "bg-neutral-400";
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 flex-1 border-t border-l border-border rounded-lg overflow-hidden">
          {days.map((day, index) => {
            const events = getDayEvents(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentDay = isToday(day);

            return (
              <button
                key={index}
                onClick={() => {
                  if (events.length > 0) {
                    onDayClick?.(day, events);
                  } else {
                    onAddClick?.(day);
                  }
                }}
                className={cn(
                  "relative min-h-[100px] p-2 text-left border-b border-r border-border transition-colors",
                  "hover:bg-muted/40",
                  !isCurrentMonth && "bg-muted/20",
                  isSelected && "bg-muted/60"
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
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] text-white font-medium truncate",
                        getEventColor(event.status)
                      )}
                    >
                      Day {event.dayNumber}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">
                      +{events.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
