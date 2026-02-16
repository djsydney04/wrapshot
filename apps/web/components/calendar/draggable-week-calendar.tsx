"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { ChevronLeft, ChevronRight, GripVertical, FileText, PanelRightOpen, PanelRightClose, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShootingDayCard } from "./shooting-day-card";
import type { ShootingDay, Scene, CastMember, Location } from "@/lib/types";

interface DraggableWeekCalendarProps {
  shootingDays: ShootingDay[];
  scenes: Scene[];
  cast?: CastMember[];
  locations?: Location[];
  onDayClick?: (date: Date, events: ShootingDay[]) => void;
  onAddClick?: (date: Date, startTime?: string, endTime?: string) => void;
  onReschedule?: (shootingDayId: string, newDate: string) => Promise<void>;
  onAddSceneToDay?: (sceneId: string, shootingDayId: string) => Promise<void>;
  onRemoveSceneFromDay?: (sceneId: string, shootingDayId: string) => Promise<void>;
  onUpdateSceneOrder?: (shootingDayId: string, sceneIds: string[]) => Promise<void>;
  selectedDate?: Date;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // Full 24 hours (midnight to midnight)
const HOUR_HEIGHT = 52; // pixels per hour
const SCENE_PREFIX = "scene-";
const UNSCHEDULED_CONTAINER_ID = "unscheduled-scenes";

const toSceneItemId = (id: string) => `${SCENE_PREFIX}${id}`;
const fromSceneItemId = (id: string) => id.replace(SCENE_PREFIX, "");

// Draggable scene card for the sidebar
function DraggableSceneItem({
  scene,
  isDragging,
}: {
  scene: Scene;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: toSceneItemId(scene.id),
    data: { scene, type: "scene" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: 100,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 p-2 rounded-lg border border-border bg-card cursor-grab active:cursor-grabbing transition-all hover:bg-muted/50",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold">
            {scene.sceneNumber}
          </span>
          <Badge
            variant={scene.intExt === "INT" ? "int" : "ext"}
            className="text-[9px] px-1 py-0"
          >
            {scene.intExt}
          </Badge>
          <Badge
            variant={scene.dayNight === "DAY" ? "day" : "night"}
            className="text-[9px] px-1 py-0"
          >
            {scene.dayNight}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">
          {scene.synopsis || "No synopsis"}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          <span>{scene.pageCount} pg</span>
          {scene.estimatedMinutes && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {scene.estimatedMinutes}m
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Scene card overlay for dragging
function SceneCardOverlay({ scene }: { scene: Scene }) {
  return (
    <div className="w-[180px] p-2 rounded-lg border-2 border-primary bg-card shadow-xl">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold">
          {scene.sceneNumber}
        </span>
        <Badge
          variant={scene.intExt === "INT" ? "int" : "ext"}
          className="text-[9px] px-1 py-0"
        >
          {scene.intExt}
        </Badge>
        <Badge
          variant={scene.dayNight === "DAY" ? "day" : "night"}
          className="text-[9px] px-1 py-0"
        >
          {scene.dayNight}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2">
        {scene.synopsis || "No synopsis"}
      </p>
    </div>
  );
}

// Droppable day column component
function DroppableDay({
  date,
  isCurrentDay,
  shootingDayId,
  children,
  onMouseDown,
  isCreating,
  createPreview,
}: {
  date: Date;
  isCurrentDay: boolean;
  shootingDayId?: string;
  children: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent, date: Date) => void;
  isCreating?: boolean;
  createPreview?: { top: number; height: number; startTime: string; endTime: string } | null;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dropId = shootingDayId ? `shootingday-${shootingDayId}` : `day-${dateStr}`;

  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { date: dateStr, shootingDayId, type: shootingDayId ? "shootingday" : "day" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-l border-border h-full select-none",
        isCurrentDay && "bg-blue-50/30 dark:bg-blue-950/10",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset"
      )}
      onMouseDown={(e) => onMouseDown?.(e, date)}
    >
      {/* Hour Lines - includes line at midnight end (24th hour) */}
      {[...HOURS, 24].map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/50"
          style={{ top: `${i * HOUR_HEIGHT}px` }}
        />
      ))}

      {/* Creation preview */}
      {isCreating && createPreview && (
        <div
          className="absolute left-1 right-1 bg-blue-500/30 border-2 border-blue-500 border-dashed rounded-lg z-20 pointer-events-none"
          style={{
            top: `${createPreview.top}px`,
            height: `${Math.max(createPreview.height, 20)}px`,
          }}
        >
          <div className="px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
            {createPreview.startTime} - {createPreview.endTime}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

function SortableMiniSceneBlock({
  scene,
  totalScenes,
  shootingDayHeight,
}: {
  scene: Scene;
  totalScenes: number;
  shootingDayHeight: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: toSceneItemId(scene.id),
    data: { scene, type: "scene" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mx-1 px-1.5 py-0.5 rounded text-[9px] bg-white/20 truncate flex items-center gap-1 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60"
      )}
      {...attributes}
      {...listeners}
    >
      <span className="font-semibold">{scene.sceneNumber}</span>
      <span className="opacity-70 truncate">
        {scene.synopsis?.slice(0, 20)}
      </span>
    </div>
  );
}

// Enhanced draggable event card component with scenes
function DraggableEvent({
  shootingDay,
  scenes,
  cast,
  locations,
  top,
  height,
  onClick,
  showScenes = true,
}: {
  shootingDay: ShootingDay;
  scenes: Scene[];
  cast?: CastMember[];
  locations?: Location[];
  top: number;
  height: number;
  onClick?: () => void;
  showScenes?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: shootingDay.id,
      data: { shootingDay, type: "shootingday" },
    });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `scenes-${shootingDay.id}`,
    data: { shootingDayId: shootingDay.id, type: "scene-container" },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const dayScenes = scenes;
  const maxVisible = Math.floor((height - 50) / 24);
  const visibleScenes = dayScenes.slice(0, maxVisible);

  const STATUS_COLORS: Record<ShootingDay["status"], string> = {
    COMPLETED: "bg-emerald-500",
    CONFIRMED: "bg-blue-500",
    SCHEDULED: "bg-amber-500",
    TENTATIVE: "bg-neutral-400",
    CANCELLED: "bg-red-400",
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      data-shooting-day="true"
      style={{
        ...style,
        position: "absolute",
        top: `${top}px`,
        height: `${Math.max(height, HOUR_HEIGHT)}px`,
        minHeight: "48px",
        left: "4px",
        right: "4px",
        zIndex: isDragging ? 100 : 10,
      }}
      className={cn(
        "group rounded-lg text-white overflow-hidden cursor-grab active:cursor-grabbing",
        STATUS_COLORS[shootingDay.status],
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary",
        isOver && "ring-2 ring-yellow-400"
      )}
      {...attributes}
    >
      {/* Header with drag indicator */}
      <div
        className="flex items-center justify-between px-2 py-1 border-b border-white/20"
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5 text-white/50" />
          <span className="font-semibold text-xs">Day {shootingDay.dayNumber}</span>
        </div>
        <span className="text-[10px] opacity-70">
          {shootingDay.generalCall} - {shootingDay.wrapTime || "?"}
        </span>
      </div>

      {/* Scenes list */}
      {showScenes && height > 80 && (
        <div
          className="flex-1 py-1 space-y-0.5 overflow-hidden"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {dayScenes.length > 0 ? (
            <SortableContext
              items={visibleScenes.map((scene) => toSceneItemId(scene.id))}
              strategy={verticalListSortingStrategy}
            >
              {visibleScenes.map((scene) => (
                <SortableMiniSceneBlock
                  key={scene.id}
                  scene={scene}
                  totalScenes={dayScenes.length}
                  shootingDayHeight={height}
                />
              ))}
            </SortableContext>
          ) : (
            <div className="px-2 py-1 text-[10px] opacity-60 italic">
              Drop scenes here
            </div>
          )}
          {dayScenes.length > maxVisible && (
            <div className="px-2 text-[9px] opacity-60">
              +{dayScenes.length - maxVisible} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DraggableWeekCalendar({
  shootingDays,
  scenes,
  cast = [],
  locations = [],
  onDayClick,
  onAddClick,
  onReschedule,
  onAddSceneToDay,
  onRemoveSceneFromDay,
  onUpdateSceneOrder,
  selectedDate,
  className,
}: DraggableWeekCalendarProps) {
  const [currentWeek, setCurrentWeek] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeType, setActiveType] = React.useState<"scene" | "shootingday" | null>(null);
  const [showScenesSidebar, setShowScenesSidebar] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [itemsByContainer, setItemsByContainer] = React.useState<Record<string, string[]>>({});
  const { setNodeRef: setUnscheduledRef, isOver: isUnscheduledOver } = useDroppable({
    id: UNSCHEDULED_CONTAINER_ID,
    data: { type: "scene-container" },
  });

  // Drag-to-create state
  const [isCreating, setIsCreating] = React.useState(false);
  const [createStart, setCreateStart] = React.useState<{ date: Date; y: number } | null>(null);
  const [createCurrentY, setCreateCurrentY] = React.useState<number | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const sceneById = React.useMemo(() => {
    return new Map(scenes.map((scene) => [scene.id, scene]));
  }, [scenes]);

  const buildItemsByContainer = React.useCallback(() => {
    const next: Record<string, string[]> = {};
    const assigned = new Set<string>();

    shootingDays.forEach((day) => {
      const ids = (day.scenes || []).filter((id) => sceneById.has(id));
      next[`scenes-${day.id}`] = ids.map(toSceneItemId);
      ids.forEach((id) => assigned.add(id));
    });

    const unscheduled = scenes
      .filter((scene) => !assigned.has(scene.id))
      .sort((a, b) => {
        const aNum = parseInt(a.sceneNumber);
        const bNum = parseInt(b.sceneNumber);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
      })
      .map((scene) => toSceneItemId(scene.id));

    next[UNSCHEDULED_CONTAINER_ID] = unscheduled;
    return next;
  }, [sceneById, scenes, shootingDays]);

  React.useEffect(() => {
    if (activeId) return;
    setItemsByContainer(buildItemsByContainer());
  }, [activeId, buildItemsByContainer]);

  const resolveScenes = React.useCallback(
    (sceneItemIds: string[]) =>
      sceneItemIds
        .map((id) => sceneById.get(fromSceneItemId(id)))
        .filter(Boolean) as Scene[],
    [sceneById]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getDayEvents = (date: Date) => {
    return shootingDays.filter((day) =>
      isSameDay(parseISO(day.date), date)
    );
  };

  const getEventPosition = (callTime: string) => {
    const [hours, minutes] = callTime.split(":").map(Number);
    const startHour = 0; // Calendar starts at midnight
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

  // Convert Y position to time string (snapped to 15-minute intervals)
  const yToTime = (y: number): string => {
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round((totalMinutes % 60) / 15) * 15;
    const adjustedHours = hours + Math.floor(minutes / 60);
    const adjustedMinutes = minutes % 60;
    return `${Math.min(23, Math.max(0, adjustedHours)).toString().padStart(2, '0')}:${adjustedMinutes.toString().padStart(2, '0')}`;
  };

  // Handle mouse down on calendar grid to start creating
  const handleGridMouseDown = (e: React.MouseEvent, date: Date) => {
    // Only start if clicking directly on the grid background
    if ((e.target as HTMLElement).closest('[data-shooting-day]')) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);

    setIsCreating(true);
    setCreateStart({ date, y });
    setCreateCurrentY(y);
  };

  // Handle mouse move during creation
  const handleGridMouseMove = (e: React.MouseEvent) => {
    if (!isCreating || !createStart || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    setCreateCurrentY(Math.max(0, Math.min(y, HOURS.length * HOUR_HEIGHT)));
  };

  // Handle mouse up to finish creation
  const handleGridMouseUp = () => {
    if (!isCreating || !createStart || createCurrentY === null) {
      setIsCreating(false);
      setCreateStart(null);
      setCreateCurrentY(null);
      return;
    }

    const startY = Math.min(createStart.y, createCurrentY);
    const endY = Math.max(createStart.y, createCurrentY);

    // Only create if drag distance is meaningful (at least 15 minutes / quarter hour)
    if (endY - startY >= HOUR_HEIGHT / 4) {
      const startTime = yToTime(startY);
      const endTime = yToTime(endY);
      onAddClick?.(createStart.date, startTime, endTime);
    }

    setIsCreating(false);
    setCreateStart(null);
    setCreateCurrentY(null);
  };

  // Handle mouse leave to cancel creation
  const handleGridMouseLeave = () => {
    if (isCreating) {
      setIsCreating(false);
      setCreateStart(null);
      setCreateCurrentY(null);
    }
  };

  // Scroll to working hours (6 AM) on mount
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 6 * HOUR_HEIGHT;
    }
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);

    if (id.startsWith(SCENE_PREFIX)) {
      setActiveType("scene");
    } else {
      setActiveType("shootingday");
    }
  };

  const findContainer = React.useCallback(
    (id: string) => {
      if (id in itemsByContainer) return id;
      return Object.keys(itemsByContainer).find((containerId) =>
        itemsByContainer[containerId].includes(id)
      );
    },
    [itemsByContainer]
  );

  const handleDragOver = (event: DragOverEvent) => {
    if (activeType !== "scene") return;
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeContainer = findContainer(activeIdStr);
    const overContainer = findContainer(overIdStr);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItemsByContainer((prev) => {
      const activeItems = prev[activeContainer].filter((id) => id !== activeIdStr);
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(overIdStr);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;

      const nextOverItems = [
        ...overItems.slice(0, newIndex),
        activeIdStr,
        ...overItems.slice(newIndex),
      ];

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: nextOverItems,
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;
    // Handle scene drop
    if (activeIdStr.startsWith(SCENE_PREFIX)) {
      const activeContainer = findContainer(activeIdStr);
      const overContainer = findContainer(overIdStr);
      if (!activeContainer || !overContainer) {
        setItemsByContainer(buildItemsByContainer());
        return;
      }

      const sceneId = fromSceneItemId(activeIdStr);

      if (activeContainer === overContainer) {
        const items = itemsByContainer[activeContainer] || [];
        const oldIndex = items.indexOf(activeIdStr);
        const overIndex = items.indexOf(overIdStr);
        const newIndex = overIndex >= 0 ? overIndex : items.length - 1;

        if (oldIndex !== newIndex) {
          const nextItems = arrayMove(items, oldIndex, newIndex);
          setItemsByContainer((prev) => ({ ...prev, [activeContainer]: nextItems }));

          if (activeContainer !== UNSCHEDULED_CONTAINER_ID) {
            const shootingDayId = activeContainer.replace("scenes-", "");
            await onUpdateSceneOrder?.(
              shootingDayId,
              nextItems.map((id) => fromSceneItemId(id))
            );
          }
        }

        return;
      }

      const sourceDayId =
        activeContainer !== UNSCHEDULED_CONTAINER_ID
          ? activeContainer.replace("scenes-", "")
          : null;
      const targetDayId =
        overContainer !== UNSCHEDULED_CONTAINER_ID
          ? overContainer.replace("scenes-", "")
          : null;

      let targetItems = itemsByContainer[overContainer] || [];
      if (!targetItems.includes(activeIdStr)) {
        targetItems = [...targetItems, activeIdStr];
      }

      const sourceItems =
        itemsByContainer[activeContainer]?.filter((id) => id !== activeIdStr) || [];

      setItemsByContainer((prev) => ({
        ...prev,
        [activeContainer]: sourceItems,
        [overContainer]: targetItems,
      }));

      if (targetDayId) {
        await onAddSceneToDay?.(sceneId, targetDayId);
        await onUpdateSceneOrder?.(
          targetDayId,
          targetItems.map((id) => fromSceneItemId(id))
        );
        if (sourceDayId && sourceDayId !== targetDayId) {
          await onUpdateSceneOrder?.(
            sourceDayId,
            sourceItems.map((id) => fromSceneItemId(id))
          );
        }
      } else if (sourceDayId) {
        await onRemoveSceneFromDay?.(sceneId, sourceDayId);
        await onUpdateSceneOrder?.(
          sourceDayId,
          sourceItems.map((id) => fromSceneItemId(id))
        );
      }

      return;
    }
    // Handle shooting day reschedule
    else {
      const shootingDayId = activeIdStr;

      if (overIdStr.startsWith("day-")) {
        const newDate = overIdStr.replace("day-", "");
        const shootingDay = shootingDays.find((d) => d.id === shootingDayId);

        if (shootingDay && shootingDay.date !== newDate) {
          await onReschedule?.(shootingDayId, newDate);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
    setItemsByContainer(buildItemsByContainer());
  };

  const activeShootingDay = activeType === "shootingday" && activeId
    ? shootingDays.find((d) => d.id === activeId)
    : null;

  const activeScene = activeType === "scene" && activeId
    ? scenes.find((s) => s.id === fromSceneItemId(activeId))
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={cn("flex gap-4 h-full", className)}>
        {/* Main Calendar */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">
                {format(currentWeek, "MMMM yyyy")}
              </h2>
              <span className="text-sm text-muted-foreground">
                Week of {format(currentWeek, "MMM d")}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
                  onClick={() =>
                    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))
                  }
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
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setShowScenesSidebar(!showScenesSidebar)}
              >
                {showScenesSidebar ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
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
                          <div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-blue-500"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div ref={scrollRef} className="flex-1 overflow-auto">
              <div
                ref={gridRef}
                className="grid grid-cols-[56px_repeat(7,1fr)] relative"
                style={{ height: `${(HOURS.length + 1) * HOUR_HEIGHT}px` }}
                onMouseMove={handleGridMouseMove}
                onMouseUp={handleGridMouseUp}
                onMouseLeave={handleGridMouseLeave}
              >
                {/* Time Labels */}
                <div className="relative border-r border-border">
                  {HOURS.map((hour, i) => (
                    <div
                      key={hour}
                      className="absolute right-2 text-[11px] text-muted-foreground"
                      style={{ top: `${i * HOUR_HEIGHT + 4}px` }}
                    >
                      {hour === 0
                        ? "12 AM"
                        : hour === 12
                        ? "12 PM"
                        : hour > 12
                        ? `${hour - 12} PM`
                        : `${hour} AM`}
                    </div>
                  ))}
                  {/* End of day label */}
                  <div
                    className="absolute right-2 text-[11px] text-muted-foreground"
                    style={{ top: `${24 * HOUR_HEIGHT + 4}px` }}
                  >
                    12 AM
                  </div>
                </div>

                {/* Day Columns */}
                {weekDays.map((day, dayIndex) => {
                  const events = getDayEvents(day);
                  const isCurrentDay = isToday(day);

                  // Calculate creation preview for this day
                  const isCreatingOnThisDay = isCreating && createStart && isSameDay(createStart.date, day) ? true : false;
                  let createPreview = null;
                  if (isCreatingOnThisDay && createStart && createCurrentY !== null) {
                    const startY = Math.min(createStart.y, createCurrentY);
                    const endY = Math.max(createStart.y, createCurrentY);
                    createPreview = {
                      top: startY,
                      height: endY - startY,
                      startTime: yToTime(startY),
                      endTime: yToTime(endY),
                    };
                  }

                  return (
                    <DroppableDay
                      key={dayIndex}
                      date={day}
                      isCurrentDay={isCurrentDay}
                      onMouseDown={handleGridMouseDown}
                      isCreating={isCreatingOnThisDay}
                      createPreview={createPreview}
                    >
                      {events.map((event) => {
                        const top = getEventPosition(event.generalCall);
                        const height = getEventDuration(event);
                        const dayScenes =
                          itemsByContainer[`scenes-${event.id}`] || [];

                        return (
                          <DraggableEvent
                            key={event.id}
                            shootingDay={event}
                            scenes={resolveScenes(dayScenes)}
                            cast={cast}
                            locations={locations}
                            top={top}
                            height={height}
                            onClick={() => onDayClick?.(day, [event])}
                          />
                        );
                      })}
                    </DroppableDay>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scenes Sidebar */}
        {showScenesSidebar && (
          <div
            ref={setUnscheduledRef}
            className={cn(
              "w-64 flex-shrink-0 border border-border rounded-lg flex flex-col bg-card",
              isUnscheduledOver && "ring-2 ring-primary bg-primary/5"
            )}
          >
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Unassigned Scenes</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {itemsByContainer[UNSCHEDULED_CONTAINER_ID]?.length || 0}
              </span>
            </div>
            <SortableContext
              items={itemsByContainer[UNSCHEDULED_CONTAINER_ID] || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex-1 overflow-auto p-2 space-y-2">
                {itemsByContainer[UNSCHEDULED_CONTAINER_ID]?.length ? (
                  resolveScenes(itemsByContainer[UNSCHEDULED_CONTAINER_ID] || []).map(
                    (scene) => (
                      <DraggableSceneItem
                        key={scene.id}
                        scene={scene}
                        isDragging={activeId === toSceneItemId(scene.id)}
                      />
                    )
                  )
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>All scenes assigned</p>
                  </div>
                )}
              </div>
            </SortableContext>
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                Drag scenes onto shooting days
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeShootingDay && (
          <div className="w-[200px]">
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
        {activeScene && <SceneCardOverlay scene={activeScene} />}
      </DragOverlay>
    </DndContext>
  );
}
