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
  rectIntersection,
} from "@dnd-kit/core";
import { Plus, LayoutGrid, Columns3, Clapperboard, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneStrip } from "@/components/stripeboard/scene-strip";
import { ShootDayContainer } from "@/components/stripeboard/shoot-day-container";
import { BreakdownPanel } from "@/components/stripeboard/breakdown-panel";
import { UnscheduledPool } from "@/components/stripeboard/unscheduled-pool";
import { AddSceneForm } from "@/components/forms/add-scene-form";
import { cn } from "@/lib/utils";
import {
  updateScene as updateSceneAction,
  deleteScene as deleteSceneAction,
  assignSceneToShootingDay,
  removeSceneFromShootingDay,
  type Scene,
} from "@/lib/actions/scenes";
import type { CastMember, ShootingDay } from "@/lib/mock-data";

type ViewMode = "stripeboard" | "list";

interface StripeboardSectionProps {
  projectId: string;
  scenes: Scene[];
  cast: CastMember[];
  shootingDays: ShootingDay[];
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

  // Get scenes assigned to a shooting day
  const getScenesForDay = (shootingDayId: string) => {
    const day = shootingDays.find((d) => d.id === shootingDayId);
    if (!day) return [];
    return localScenes.filter((s) => day.scenes.includes(s.id));
  };

  // Get unscheduled scenes
  const assignedSceneIds = new Set(shootingDays.flatMap((d) => d.scenes));
  const unscheduledScenes = localScenes.filter((s) => !assignedSceneIds.has(s.id));

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const sceneId = (active.id as string).replace("scene-", "");
    const overId = over.id as string;

    // Dropped on a shooting day
    if (overId.startsWith("day-")) {
      const shootingDayId = overId.replace("day-", "");
      await assignSceneToShootingDay(sceneId, shootingDayId, 0, projectId);
    }
    // Dropped on unscheduled pool
    else if (overId === "unscheduled-pool") {
      // Find which day this scene was in and unassign it
      for (const day of shootingDays) {
        if (day.scenes.includes(sceneId)) {
          await removeSceneFromShootingDay(sceneId, day.id, projectId);
          break;
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
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

  const activeScene = activeId
    ? localScenes.find((s) => s.id === activeId.replace("scene-", ""))
    : null;

  const totalPages = localScenes.reduce((sum, s) => sum + s.pageCount, 0);
  const completedScenes = localScenes.filter((s) => s.status === "COMPLETED").length;
  const scheduledScenes = localScenes.filter((s) => s.status === "SCHEDULED" || assignedSceneIds.has(s.id)).length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
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
              <span>{totalPages.toFixed(1)} pages</span>
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
                Stripeboard
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
          <div className="flex gap-4 min-h-[600px]">
            {/* Breakdown Panel (Left) */}
            {showBreakdownPanel && selectedScene && (
              <div className="w-80 flex-shrink-0">
                <BreakdownPanel
                  scene={selectedScene}
                  cast={cast}
                  onUpdate={(updates) => handleUpdateScene(selectedScene.id, updates)}
                  onClose={() => setSelectedSceneId(null)}
                />
              </div>
            )}

            {/* Main Stripeboard (Center) */}
            <div className="flex-1 min-w-0">
              {viewMode === "stripeboard" ? (
                <div className="space-y-4">
                  {/* Shooting Days */}
                  {shootingDays.length > 0 ? (
                    shootingDays.map((day) => (
                      <ShootDayContainer
                        key={day.id}
                        shootingDay={day}
                        scenes={getScenesForDay(day.id)}
                        onSceneClick={setSelectedSceneId}
                        selectedSceneId={selectedSceneId}
                      />
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
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Unscheduled Pool (Right) */}
            {viewMode === "stripeboard" && (
              <div className="w-64 flex-shrink-0">
                <UnscheduledPool
                  scenes={unscheduledScenes}
                  onSceneClick={setSelectedSceneId}
                  selectedSceneId={selectedSceneId}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <Clapperboard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">No scenes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add scenes manually or use AI breakdown to extract them from your script
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
      <DragOverlay>
        {activeScene && (
          <SceneStrip
            scene={activeScene}
            isSelected={false}
            isDragging
            layout="strip"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
