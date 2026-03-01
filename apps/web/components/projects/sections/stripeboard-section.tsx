"use client";

import * as React from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  LayoutGrid,
  Columns3,
  Clapperboard,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  ChevronsDownUp,
  ChevronsUpDown,
  Focus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SceneStrip, type SceneStripSize } from "@/components/stripeboard/scene-strip";
import { ShootDayContainer } from "@/components/stripeboard/shoot-day-container";
import { BreakdownPanel } from "@/components/stripeboard/breakdown-panel";
import { UnscheduledPool } from "@/components/stripeboard/unscheduled-pool";
import { AddSceneForm } from "@/components/forms/add-scene-form";
import { cn } from "@/lib/utils";
import { formatPageEighths, sumPageEighths } from "@/lib/utils/page-eighths";
import {
  updateScene as updateSceneAction,
  deleteScene as deleteSceneAction,
  assignSceneToShootingDay,
  removeSceneFromShootingDay,
  type Scene,
} from "@/lib/actions/scenes";
import { updateSceneOrder } from "@/lib/actions/shooting-days";
import type { ShootingDay } from "@/lib/types";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";

type ViewMode = "stripeboard" | "list";
type StripLayoutMode = "vertical" | "horizontal";

interface StripeboardSectionProps {
  projectId: string;
  scenes: Scene[];
  cast: CastMemberWithInviteStatus[];
  shootingDays: ShootingDay[];
}

const UNSCHEDULED_CONTAINER_ID = "unscheduled-pool";
const DEFAULT_BREAKDOWN_WIDTH = 320;
const DEFAULT_UNSCHEDULED_WIDTH = 256;
const INSPECTOR_MIN_WIDTH = 280;
const INSPECTOR_MAX_WIDTH = 480;
const UNSCHEDULED_MIN_WIDTH = 220;
const UNSCHEDULED_MAX_WIDTH = 420;

function findContainerInMap(
  containers: Record<string, string[]>,
  id: string
): string | undefined {
  if (id in containers) return id;
  return Object.keys(containers).find((containerId) => containers[containerId].includes(id));
}

function getSortableContainerId(
  item: { id: UniqueIdentifier; data: { current?: unknown } } | null | undefined
): string | undefined {
  if (!item) return undefined;
  const sortable = (item.data.current as { sortable?: { containerId?: string } } | undefined)
    ?.sortable;
  return sortable?.containerId;
}

function formatDayBreakLabel(currentDay: ShootingDay, nextDay: ShootingDay): string {
  const currentDate = new Date(currentDay.date);
  const nextDate = new Date(nextDay.date);
  if (Number.isNaN(currentDate.getTime()) || Number.isNaN(nextDate.getTime())) {
    return "Day break";
  }

  const currentUtc = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const nextUtc = Date.UTC(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  const dayGap = Math.max(0, Math.round((nextUtc - currentUtc) / 86_400_000));
  const darkDays = Math.max(0, dayGap - 1);

  if (darkDays > 0) {
    return `${darkDays} dark day${darkDays === 1 ? "" : "s"}`;
  }

  return "Standard turnaround";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function StripeboardSection({
  projectId,
  scenes,
  cast,
  shootingDays,
}: StripeboardSectionProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("stripeboard");
  const [showAddScene, setShowAddScene] = React.useState(false);
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const [showBreakdownPanel, setShowBreakdownPanel] = React.useState(true);
  const [stripLayoutMode, setStripLayoutMode] = React.useState<StripLayoutMode>("vertical");
  const [localScenes, setLocalScenes] = React.useState(scenes);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [itemsByContainer, setItemsByContainer] = React.useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [expandedSceneIds, setExpandedSceneIds] = React.useState<Set<string>>(new Set());
  const [showUnscheduledPanel, setShowUnscheduledPanel] = React.useState(true);
  const [focusedDayId, setFocusedDayId] = React.useState<string | null>(null);
  const [collapsedDayIds, setCollapsedDayIds] = React.useState<Set<string>>(new Set());
  const [breakdownWidth, setBreakdownWidth] = React.useState(DEFAULT_BREAKDOWN_WIDTH);
  const [unscheduledWidth, setUnscheduledWidth] = React.useState(DEFAULT_UNSCHEDULED_WIDTH);
  const [activeResizeTarget, setActiveResizeTarget] = React.useState<"inspector" | "unscheduled" | null>(null);

  // Update local scenes when props change
  React.useEffect(() => {
    setLocalScenes(scenes);
  }, [scenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sceneById = React.useMemo(() => {
    return new Map(localScenes.map((scene) => [scene.id, scene]));
  }, [localScenes]);

  const buildItemsByContainer = React.useCallback(() => {
    const sceneIds = new Set(localScenes.map((scene) => scene.id));
    const next: Record<string, string[]> = {};
    const assigned = new Set<string>();

    shootingDays.forEach((day) => {
      const ids = (day.scenes || []).filter((id) => sceneIds.has(id));
      next[`day-${day.id}`] = ids;
      ids.forEach((id) => assigned.add(id));
    });

    const unscheduled = localScenes
      .filter((scene) => !assigned.has(scene.id))
      .sort((a, b) => {
        const aSort = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER;
        const bSort = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) {
          return aSort - bSort;
        }
        const aNum = parseInt(a.sceneNumber);
        const bNum = parseInt(b.sceneNumber);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.sceneNumber.localeCompare(b.sceneNumber, undefined, {
          numeric: true,
        });
      })
      .map((scene) => scene.id);

    next[UNSCHEDULED_CONTAINER_ID] = unscheduled;

    return next;
  }, [localScenes, shootingDays]);

  React.useEffect(() => {
    if (activeId) return;
    setItemsByContainer(buildItemsByContainer());
  }, [buildItemsByContainer, activeId]);

  React.useEffect(() => {
    const dayIds = new Set(shootingDays.map((day) => day.id));
    if (focusedDayId && !dayIds.has(focusedDayId)) {
      setFocusedDayId(null);
    }
    setCollapsedDayIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (dayIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [shootingDays, focusedDayId]);

  const assignedSceneIds = React.useMemo(() => {
    const ids = new Set<string>();
    Object.entries(itemsByContainer).forEach(([containerId, sceneIds]) => {
      if (containerId !== UNSCHEDULED_CONTAINER_ID) {
        sceneIds.forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [itemsByContainer]);

  const resolveScenes = React.useCallback(
    (sceneIds: string[]) =>
      sceneIds.map((id) => sceneById.get(id)).filter(Boolean) as Scene[],
    [sceneById]
  );

  // Sort scenes by sortOrder
  const sortedScenes = React.useMemo(() => {
    return [...localScenes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [localScenes]);

  // Selected scene
  const selectedScene = selectedSceneId
    ? localScenes.find((s) => s.id === selectedSceneId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const findContainer = React.useCallback(
    (id: string) => {
      return findContainerInMap(itemsByContainer, id);
    },
    [itemsByContainer]
  );

  const getDayId = (containerId: string) => containerId.replace("day-", "");

  const persistUnscheduledOrder = React.useCallback(
    async (sceneIds: string[]) => {
      const results = await Promise.all(
        sceneIds.map((sceneId, index) =>
          updateSceneAction(sceneId, { sortOrder: index, projectId })
        )
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error);
      }

      const orderMap = new Map(sceneIds.map((id, index) => [id, index]));
      setLocalScenes((prev) =>
        prev.map((scene) => ({
          ...scene,
          sortOrder: orderMap.get(scene.id) ?? scene.sortOrder,
        }))
      );
    },
    [projectId]
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    setItemsByContainer((prev) => {
      const activeContainer =
        getSortableContainerId(active) || findContainerInMap(prev, activeIdStr);
      const overContainer =
        getSortableContainerId(over) || findContainerInMap(prev, overIdStr);

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return prev;
      }

      // Guard against undefined containers
      if (!prev[activeContainer] || !prev[overContainer]) {
        return prev;
      }

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

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeContainer =
      getSortableContainerId(active) || findContainer(activeIdStr);
    const overContainer =
      getSortableContainerId(over) || findContainer(overIdStr);

    if (!activeContainer || !overContainer) return;

    // Store previous state for rollback
    const previousItems = { ...itemsByContainer };
    const previousScenes = [...localScenes];

    if (activeContainer === overContainer) {
      const items = itemsByContainer[activeContainer] || [];
      const oldIndex = items.indexOf(activeIdStr);
      const overIndex = items.indexOf(overIdStr);
      const newIndex = overIndex >= 0 ? overIndex : items.length - 1;

      if (oldIndex !== newIndex) {
        const nextItems = arrayMove(items, oldIndex, newIndex);
        setItemsByContainer((prev) => ({ ...prev, [activeContainer]: nextItems }));

        setIsSaving(true);
        try {
          if (activeContainer !== UNSCHEDULED_CONTAINER_ID) {
            await updateSceneOrder(getDayId(activeContainer), nextItems);
          } else {
            await persistUnscheduledOrder(nextItems);
          }
          toast.success("Scene order updated");
        } catch (error) {
          console.error("Failed to update scene order:", error);
          setItemsByContainer(previousItems);
          setLocalScenes(previousScenes);
          toast.error("Failed to update scene order");
        } finally {
          setIsSaving(false);
        }
      }

      return;
    }

    const sourceDayId =
      activeContainer !== UNSCHEDULED_CONTAINER_ID ? getDayId(activeContainer) : null;
    const targetDayId =
      overContainer !== UNSCHEDULED_CONTAINER_ID ? getDayId(overContainer) : null;

    let targetItems = itemsByContainer[overContainer] || [];
    if (!targetItems.includes(activeIdStr)) {
      targetItems = [...targetItems, activeIdStr];
    }

    const nextSourceItems =
      itemsByContainer[activeContainer]?.filter((id) => id !== activeIdStr) || [];

    // Optimistic update
    setItemsByContainer((prev) => ({
      ...prev,
      [activeContainer]: nextSourceItems,
      [overContainer]: targetItems,
    }));

    setIsSaving(true);
    try {
      if (targetDayId) {
        const insertIndex = targetItems.indexOf(activeIdStr);
        await assignSceneToShootingDay(activeIdStr, targetDayId, Math.max(insertIndex, 0), projectId);
        await updateSceneOrder(targetDayId, targetItems);
        setLocalScenes((prev) =>
          prev.map((scene) =>
            scene.id === activeIdStr ? { ...scene, status: "SCHEDULED" } : scene
          )
        );
        toast.success("Scene scheduled");
      } else if (sourceDayId) {
        await removeSceneFromShootingDay(activeIdStr, sourceDayId, projectId);
        setLocalScenes((prev) =>
          prev.map((scene) =>
            scene.id === activeIdStr ? { ...scene, status: "NOT_SCHEDULED" } : scene
          )
        );
        toast.success("Scene unscheduled");
      }

      if (sourceDayId) {
        await updateSceneOrder(sourceDayId, nextSourceItems);
      }
    } catch (error) {
      console.error("Failed to move scene:", error);
      // Rollback on error
      setItemsByContainer(previousItems);
      setLocalScenes(previousScenes);
      toast.error("Failed to move scene. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setItemsByContainer(buildItemsByContainer());
  };

  const handleDeleteScene = async (id: string) => {
    setLocalScenes((prev) => prev.filter((s) => s.id !== id));
    if (selectedSceneId === id) setSelectedSceneId(null);
    await deleteSceneAction(id, projectId);
  };

  const handleUpdateScene = async (id: string, updates: Partial<Scene>) => {
    setLocalScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    await updateSceneAction(id, updates as Parameters<typeof updateSceneAction>[1]);
  };

  const activeScene = activeId ? sceneById.get(activeId) || null : null;

  const totalPageEighths = sumPageEighths(localScenes);
  const completedScenes = localScenes.filter((s) => s.status === "COMPLETED").length;
  const scheduledScenes = localScenes.filter(
    (s) => s.status === "SCHEDULED" || assignedSceneIds.has(s.id)
  ).length;
  const sceneSize: SceneStripSize = "comfortable";

  const toggleExpandedScene = React.useCallback((sceneId: string) => {
    setExpandedSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  }, []);

  const allExpanded = expandedSceneIds.size > 0 && expandedSceneIds.size >= localScenes.length;
  const hasShootingDays = shootingDays.length > 0;
  const visibleShootingDays = React.useMemo(() => {
    if (!focusedDayId) return shootingDays;
    return shootingDays.filter((day) => day.id === focusedDayId);
  }, [shootingDays, focusedDayId]);

  const toggleExpandAll = React.useCallback(() => {
    if (allExpanded) {
      setExpandedSceneIds(new Set());
    } else {
      setExpandedSceneIds(new Set(localScenes.map((s) => s.id)));
    }
  }, [allExpanded, localScenes]);

  const toggleFocusedDay = React.useCallback((dayId: string) => {
    setFocusedDayId((prev) => (prev === dayId ? null : dayId));
  }, []);

  const toggleCollapsedDay = React.useCallback((dayId: string) => {
    setCollapsedDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  }, []);

  const startResize = React.useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      target: "inspector" | "unscheduled",
      direction: "left" | "right"
    ) => {
      event.preventDefault();

      const startX = event.clientX;
      const startWidth = target === "inspector" ? breakdownWidth : unscheduledWidth;
      setActiveResizeTarget(target);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const rawWidth = startWidth + (direction === "right" ? delta : -delta);
        const nextWidth =
          target === "inspector"
            ? clamp(rawWidth, INSPECTOR_MIN_WIDTH, INSPECTOR_MAX_WIDTH)
            : clamp(rawWidth, UNSCHEDULED_MIN_WIDTH, UNSCHEDULED_MAX_WIDTH);

        if (target === "inspector") {
          setBreakdownWidth(nextWidth);
        } else {
          setUnscheduledWidth(nextWidth);
        }
      };

      const handlePointerUp = () => {
        setActiveResizeTarget(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [breakdownWidth, unscheduledWidth]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{localScenes.length} scenes</span>
              <span>·</span>
              <span>{formatPageEighths(totalPageEighths)} pages</span>
              <span>·</span>
              <span>{scheduledScenes} scheduled</span>
              <span>·</span>
              <span>{completedScenes} completed</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border p-1">
              <button
                onClick={() => setViewMode("stripeboard")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  viewMode === "stripeboard"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Stripboard
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                List
              </button>
            </div>
            {viewMode === "list" && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                className="gap-1.5"
              >
                {allExpanded ? (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                )}
                {allExpanded ? "Collapse" : "Expand"}
              </Button>
            )}
            {viewMode === "stripeboard" && (
              <div className="flex items-center rounded-lg border border-border p-1">
                <button
                  type="button"
                  onClick={() => setStripLayoutMode("vertical")}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    stripLayoutMode === "vertical"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Vertical
                </button>
                <button
                  type="button"
                  onClick={() => setStripLayoutMode("horizontal")}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    stripLayoutMode === "horizontal"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Horizontal
                </button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBreakdownPanel(!showBreakdownPanel)}
            >
              {showBreakdownPanel ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>

            {viewMode === "stripeboard" && hasShootingDays && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnscheduledPanel(!showUnscheduledPanel)}
              >
                {showUnscheduledPanel ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            )}

            {focusedDayId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setFocusedDayId(null)}
              >
                <Focus className="h-3.5 w-3.5" />
                Exit Focus
              </Button>
            )}

            <Button size="sm" onClick={() => setShowAddScene(true)}>
              <Plus className="h-4 w-4" />
              Add Scene
            </Button>
          </div>
        </div>

        {/* Content */}
        {localScenes.length > 0 ? (
          <div className="flex min-w-0 gap-4">
            {/* Breakdown Panel (Left) */}
            {showBreakdownPanel && selectedScene && (
              <div
                className="sticky top-4 max-h-[calc(100vh-6rem)] flex-shrink-0 self-start"
                style={{ width: breakdownWidth }}
              >
                <BreakdownPanel
                  scene={selectedScene}
                  projectId={projectId}
                  cast={cast}
                  onUpdate={(updates) => handleUpdateScene(selectedScene.id, updates)}
                  onClose={() => setSelectedSceneId(null)}
                />
              </div>
            )}
            {showBreakdownPanel && selectedScene && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize inspector panel"
                onPointerDown={(event) => startResize(event, "inspector", "right")}
                className="hidden w-2 flex-shrink-0 cursor-col-resize md:block"
              >
                <div
                  className={cn(
                    "mx-auto h-full w-px bg-border transition-colors",
                    activeResizeTarget === "inspector" && "bg-primary"
                  )}
                />
              </div>
            )}

            {/* Main Stripboard (Center) */}
            <div className="flex-1 min-w-0">
              {viewMode === "stripeboard" ? (
                <div className="space-y-4">
                  {/* Shooting Days */}
                  {hasShootingDays ? (
                    stripLayoutMode === "vertical" ? (
                      visibleShootingDays.map((day, index) => {
                        const nextDay = visibleShootingDays[index + 1];
                        return (
                          <React.Fragment key={day.id}>
                            <SortableContext
                              items={itemsByContainer[`day-${day.id}`] || []}
                              strategy={verticalListSortingStrategy}
                            >
                              <ShootDayContainer
                                shootingDay={day}
                                scenes={resolveScenes(itemsByContainer[`day-${day.id}`] || [])}
                                onSceneClick={setSelectedSceneId}
                                selectedSceneId={selectedSceneId}
                                activeId={activeId}
                                isSaving={isSaving}
                                sceneSize={sceneSize}
                                collapsed={collapsedDayIds.has(day.id)}
                                focused={focusedDayId === day.id}
                                onToggleCollapsed={() => toggleCollapsedDay(day.id)}
                                onToggleFocused={() => toggleFocusedDay(day.id)}
                              />
                            </SortableContext>
                            {nextDay && (
                              <div className="flex items-center gap-2 px-2">
                                <span className="h-px flex-1 bg-border/80" />
                                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Day Break · {formatDayBreakLabel(day, nextDay)}
                                </span>
                                <span className="h-px flex-1 bg-border/80" />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <div className="overflow-x-auto pb-2">
                        <div className="flex min-w-max items-start gap-4">
                          {showUnscheduledPanel && (
                            <div
                              className="flex-shrink-0"
                              style={{ width: unscheduledWidth }}
                            >
                              <UnscheduledPool
                                scenes={resolveScenes(itemsByContainer[UNSCHEDULED_CONTAINER_ID] || [])}
                                onSceneClick={setSelectedSceneId}
                                selectedSceneId={selectedSceneId}
                                activeId={activeId}
                                sceneSize={sceneSize}
                                layout="board"
                              />
                            </div>
                          )}
                          {showUnscheduledPanel && (
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              aria-label="Resize unscheduled panel"
                              onPointerDown={(event) => startResize(event, "unscheduled", "right")}
                              className="w-2 flex-shrink-0 cursor-col-resize"
                            >
                              <div
                                className={cn(
                                  "mx-auto h-full w-px bg-border transition-colors",
                                  activeResizeTarget === "unscheduled" && "bg-primary"
                                )}
                              />
                            </div>
                          )}
                          {visibleShootingDays.map((day, index) => {
                            const nextDay = visibleShootingDays[index + 1];
                            return (
                              <React.Fragment key={day.id}>
                                <div className="w-[340px] max-w-[80vw] flex-shrink-0">
                                  <SortableContext
                                    items={itemsByContainer[`day-${day.id}`] || []}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <ShootDayContainer
                                      shootingDay={day}
                                      scenes={resolveScenes(itemsByContainer[`day-${day.id}`] || [])}
                                      onSceneClick={setSelectedSceneId}
                                      selectedSceneId={selectedSceneId}
                                      activeId={activeId}
                                      isSaving={isSaving}
                                      sceneSize={sceneSize}
                                      collapsed={collapsedDayIds.has(day.id)}
                                      focused={focusedDayId === day.id}
                                      onToggleCollapsed={() => toggleCollapsedDay(day.id)}
                                      onToggleFocused={() => toggleFocusedDay(day.id)}
                                    />
                                  </SortableContext>
                                </div>
                                {nextDay && (
                                  <div className="flex min-h-[120px] flex-shrink-0 items-center">
                                    <span className="h-px w-10 bg-border/80" />
                                    <span className="mx-2 whitespace-nowrap rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                      Day Break · {formatDayBreakLabel(day, nextDay)}
                                    </span>
                                    <span className="h-px w-10 bg-border/80" />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-dashed border-border p-4">
                        <p className="text-sm font-medium">Build your stripboard before shoot days</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          You can sequence scenes now. Create shooting days later and drag strips
                          into day columns when ready.
                        </p>
                      </div>
                      <UnscheduledPool
                        scenes={resolveScenes(itemsByContainer[UNSCHEDULED_CONTAINER_ID] || [])}
                        onSceneClick={setSelectedSceneId}
                        selectedSceneId={selectedSceneId}
                        activeId={activeId}
                        sceneSize={sceneSize}
                        layout="board"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedScenes.map((scene) => (
                    <SceneStrip
                      key={scene.id}
                      scene={scene}
                      onClick={() => setSelectedSceneId(scene.id)}
                      isSelected={selectedSceneId === scene.id}
                      onDelete={() => handleDeleteScene(scene.id)}
                      layout="list"
                      sceneSize={sceneSize}
                      isExpanded={expandedSceneIds.has(scene.id)}
                      onToggleExpand={() => toggleExpandedScene(scene.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Unscheduled Pool (Right) */}
            {viewMode === "stripeboard" &&
              hasShootingDays &&
              stripLayoutMode === "vertical" &&
              showUnscheduledPanel && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize unscheduled panel"
                onPointerDown={(event) => startResize(event, "unscheduled", "left")}
                className="hidden w-2 flex-shrink-0 cursor-col-resize md:block"
              >
                <div
                  className={cn(
                    "mx-auto h-full w-px bg-border transition-colors",
                    activeResizeTarget === "unscheduled" && "bg-primary"
                  )}
                />
              </div>
            )}
            {viewMode === "stripeboard" &&
              hasShootingDays &&
              stripLayoutMode === "vertical" &&
              showUnscheduledPanel && (
              <div
                className="flex-shrink-0"
                style={{ width: unscheduledWidth }}
              >
                <UnscheduledPool
                  scenes={resolveScenes(itemsByContainer[UNSCHEDULED_CONTAINER_ID] || [])}
                  onSceneClick={setSelectedSceneId}
                  selectedSceneId={selectedSceneId}
                  activeId={activeId}
                  sceneSize={sceneSize}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <Clapperboard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">No scenes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add scenes manually or use Wrapshot Intelligence breakdown to extract them from your
              script
            </p>
            <Button onClick={() => setShowAddScene(true)}>
              <Plus className="h-4 w-4" />
              Add First Scene
            </Button>
          </div>
        )}

        {/* Add Scene Form */}
        <AddSceneForm
          projectId={projectId}
          open={showAddScene}
          onOpenChange={setShowAddScene}
          onSuccess={() => setShowAddScene(false)}
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
        {activeScene && (
          <SceneStrip
            scene={activeScene}
            isSelected={false}
            isDragging
            layout="strip"
            sceneSize={sceneSize}
            className="shadow-xl rotate-1"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
