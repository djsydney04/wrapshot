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
  selectedDate?: Date;
  className?: string;
}

export function Calendar({
  shootingDays,
  onDayClick,
  selectedDate,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) =>
      isSameDay(new Date(day.date), date)
    );
  };

  const getStatusColor = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500";
      case "CONFIRMED":
        return "bg-blue-500";
      case "SCHEDULED":
        return "bg-yellow-500";
      case "TENTATIVE":
        return "bg-gray-400";
      case "CANCELLED":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
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
          {days.map((day, index) => {
            const events = getDayEvents(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentDay = isToday(day);

            return (
              <button
                key={index}
                onClick={() => onDayClick?.(day, events)}
                className={cn(
                  "relative min-h-[100px] p-2 text-left border-b border-r border-border transition-colors",
                  "hover:bg-[hsl(var(--notion-hover))]",
                  !isCurrentMonth && "bg-muted/30",
                  isSelected && "bg-[hsl(var(--notion-hover-strong))]",
                  index % 7 === 6 && "border-r-0"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                    !isCurrentMonth && "text-muted-foreground",
                    isCurrentDay && "bg-primary text-primary-foreground font-medium"
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Events */}
                <div className="mt-1 space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs text-white truncate",
                        getStatusColor(event.status)
                      )}
                    >
                      Day {event.dayNumber} • {event.generalCall}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{events.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
          <span>Tentative</span>
        </div>
      </div>
    </div>
  );
}
