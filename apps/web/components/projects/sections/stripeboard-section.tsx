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
import { Plus, LayoutGrid, Columns3, Clapperboard, PanelLeftClose, PanelLeftOpen, Loader2, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
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

interface StripeboardSectionProps {
  projectId: string;
  scenes: Scene[];
  cast: CastMemberWithInviteStatus[];
  shootingDays: ShootingDay[];
}

const UNSCHEDULED_CONTAINER_ID = "unscheduled-pool";

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
  const [localScenes, setLocalScenes] = React.useState(scenes);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [itemsByContainer, setItemsByContainer] = React.useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [expandedSceneIds, setExpandedSceneIds] = React.useState<Set<string>>(new Set());

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

        if (activeContainer !== UNSCHEDULED_CONTAINER_ID) {
          setIsSaving(true);
          try {
            await updateSceneOrder(getDayId(activeContainer), nextItems);
            toast.success("Scene order updated");
          } catch (error) {
            console.error("Failed to update scene order:", error);
            setItemsByContainer(previousItems);
            toast.error("Failed to update scene order");
          } finally {
            setIsSaving(false);
          }
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

  const toggleExpandAll = React.useCallback(() => {
    if (allExpanded) {
      setExpandedSceneIds(new Set());
    } else {
      setExpandedSceneIds(new Set(localScenes.map((s) => s.id)));
    }
  }, [allExpanded, localScenes]);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{localScenes.length} scenes</span>
              <span>·</span>
              <span>{formatPageEighths(totalPageEighths)} pages</span>
              <span>·</span>
              <span>{scheduledScenes} scheduled</span>
              <span>·</span>
              <span>{completedScenes} completed</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            <Button size="sm" onClick={() => setShowAddScene(true)}>
              <Plus className="h-4 w-4" />
              Add Scene
            </Button>
          </div>
        </div>

        {/* Content */}
        {localScenes.length > 0 ? (
          <div className="flex gap-4">
            {/* Breakdown Panel (Left) */}
            {showBreakdownPanel && selectedScene && (
              <div className="w-80 flex-shrink-0 sticky top-4 self-start max-h-[calc(100vh-6rem)]">
                <BreakdownPanel
                  scene={selectedScene}
                  projectId={projectId}
                  cast={cast}
                  onUpdate={(updates) => handleUpdateScene(selectedScene.id, updates)}
                  onClose={() => setSelectedSceneId(null)}
                />
              </div>
            )}

            {/* Main Stripboard (Center) */}
            <div className="flex-1 min-w-0">
              {viewMode === "stripeboard" ? (
                <div className="space-y-4">
                  {/* Shooting Days */}
                  {shootingDays.length > 0 ? (
                    shootingDays.map((day) => (
                      <SortableContext
                        key={day.id}
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
                        />
                      </SortableContext>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        No shooting days scheduled yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Add shooting days in the Schedule section to start organizing scenes
                      </p>
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
            {viewMode === "stripeboard" && (
              <div className="w-64 flex-shrink-0">
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
