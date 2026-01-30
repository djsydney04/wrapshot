"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
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
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShootingDayCard } from "./shooting-day-card";
import type { ShootingDay, Scene, CastMember, Location } from "@/lib/mock-data";

interface DraggableCalendarProps {
  shootingDays: ShootingDay[];
  scenes?: Scene[];
  cast?: CastMember[];
  locations?: Location[];
  onDayClick?: (date: Date, events: ShootingDay[]) => void;
  onAddClick?: (date: Date) => void;
  onReschedule?: (shootingDayId: string, newDate: string) => Promise<void>;
  selectedDate?: Date;
  className?: string;
}

// Droppable day cell component
function DroppableCell({
  date,
  isCurrentMonth,
  isCurrentDay,
  isSelected,
  children,
  onAddClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  isSelected: boolean;
  children: React.ReactNode;
  onAddClick?: (date: Date) => void;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${dateStr}`,
    data: { date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-h-[100px] p-2 text-left border-b border-r border-border transition-colors",
        "hover:bg-muted/40",
        !isCurrentMonth && "bg-muted/20",
        isSelected && "bg-muted/60",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset"
      )}
      onClick={(e) => {
        // Only trigger add if clicking on empty space
        if (e.target === e.currentTarget) {
          onAddClick?.(date);
        }
      }}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
          !isCurrentMonth && "text-muted-foreground/60",
          isCurrentDay && "bg-foreground text-background font-medium"
        )}
      >
        {format(date, "d")}
      </span>

      {children}
    </div>
  );
}

// Draggable event component for month view
function DraggableMonthEvent({
  shootingDay,
  onClick,
}: {
  shootingDay: ShootingDay;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: shootingDay.id,
      data: { shootingDay },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
      }
    : undefined;

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
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-white font-medium cursor-pointer",
        getEventColor(shootingDay.status),
        isDragging && "opacity-50 ring-2 ring-primary shadow-lg"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing -ml-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="flex-1 truncate"
      >
        Day {shootingDay.dayNumber}
      </div>
    </div>
  );
}

export function DraggableCalendar({
  shootingDays,
  scenes = [],
  cast = [],
  locations = [],
  onDayClick,
  onAddClick,
  onReschedule,
  selectedDate,
  className,
}: DraggableCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) => isSameDay(new Date(day.date), date));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const shootingDayId = active.id as string;
    const dropTarget = over.id as string;

    // Check if dropped on a day cell
    if (dropTarget.startsWith("cell-")) {
      const newDate = dropTarget.replace("cell-", "");
      const shootingDay = shootingDays.find((d) => d.id === shootingDayId);

      if (shootingDay && shootingDay.date !== newDate) {
        // Call the reschedule handler
        await onReschedule?.(shootingDayId, newDate);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeShootingDay = activeId
    ? shootingDays.find((d) => d.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
                <DroppableCell
                  key={index}
                  date={day}
                  isCurrentMonth={isCurrentMonth}
                  isCurrentDay={isCurrentDay}
                  isSelected={isSelected || false}
                  onAddClick={events.length === 0 ? onAddClick : undefined}
                >
                  {/* Events */}
                  <div className="mt-1 space-y-0.5">
                    {events.slice(0, 3).map((event) => (
                      <DraggableMonthEvent
                        key={event.id}
                        shootingDay={event}
                        onClick={() => onDayClick?.(day, [event])}
                      />
                    ))}
                    {events.length > 3 && (
                      <button
                        className="text-[10px] text-muted-foreground pl-1 hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick?.(day, events);
                        }}
                      >
                        +{events.length - 3} more
                      </button>
                    )}
                  </div>
                </DroppableCell>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeShootingDay && (
          <div className="w-[180px]">
            <ShootingDayCard
              shootingDay={activeShootingDay}
              scenes={scenes}
              cast={cast}
              locations={locations}
              variant="expanded"
              className="shadow-xl ring-2 ring-primary"
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
