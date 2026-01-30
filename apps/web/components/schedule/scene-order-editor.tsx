"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Clock, FileText, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ShootingDay, Scene } from "@/lib/mock-data";

interface SceneOrderEditorProps {
  shootingDay: ShootingDay;
  scenes: Scene[]; // Scenes currently in this shooting day
  allScenes: Scene[]; // All scenes in the project
  onReorder?: (sceneIds: string[]) => Promise<void>;
  onAddScene?: (sceneId: string) => Promise<void>;
  onRemoveScene?: (sceneId: string) => Promise<void>;
}

function SortableSceneCard({
  scene,
  onRemove,
}: {
  scene: Scene;
  onRemove?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-all",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted -ml-1"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Scene Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-semibold">
            {scene.sceneNumber}
          </span>
          <Badge
            variant={scene.intExt === "INT" ? "int" : "ext"}
            className="text-[10px] px-1.5"
          >
            {scene.intExt}
          </Badge>
          <Badge
            variant={scene.dayNight === "DAY" ? "day" : "night"}
            className="text-[10px] px-1.5"
          >
            {scene.dayNight}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {scene.pageCount} pg
          </span>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {scene.synopsis || "No synopsis"}
        </p>

        {scene.estimatedMinutes && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            ~{scene.estimatedMinutes} min
          </div>
        )}
      </div>

      {/* Remove Button */}
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function SceneCard({ scene }: { scene: Scene }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex-shrink-0 p-0.5 -ml-1">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-semibold">
            {scene.sceneNumber}
          </span>
          <Badge
            variant={scene.intExt === "INT" ? "int" : "ext"}
            className="text-[10px] px-1.5"
          >
            {scene.intExt}
          </Badge>
          <Badge
            variant={scene.dayNight === "DAY" ? "day" : "night"}
            className="text-[10px] px-1.5"
          >
            {scene.dayNight}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {scene.synopsis || "No synopsis"}
        </p>
      </div>
    </div>
  );
}

export function SceneOrderEditor({
  shootingDay,
  scenes,
  allScenes,
  onReorder,
  onAddScene,
  onRemoveScene,
}: SceneOrderEditorProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [showAddScenes, setShowAddScenes] = React.useState(false);

  // Get the current scene order
  const orderedScenes = React.useMemo(() => {
    return shootingDay.scenes
      .map((id) => scenes.find((s) => s.id === id))
      .filter((s): s is Scene => s !== undefined);
  }, [shootingDay.scenes, scenes]);

  // Get scenes not in this shooting day
  const availableScenes = React.useMemo(() => {
    const assignedIds = new Set(shootingDay.scenes);
    return allScenes.filter((s) => !assignedIds.has(s.id));
  }, [allScenes, shootingDay.scenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = orderedScenes.findIndex((s) => s.id === active.id);
    const newIndex = orderedScenes.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(orderedScenes, oldIndex, newIndex);
      await onReorder?.(newOrder.map((s) => s.id));
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeScene = activeId
    ? orderedScenes.find((s) => s.id === activeId)
    : null;

  const handleAddScene = async (sceneId: string) => {
    await onAddScene?.(sceneId);
  };

  const handleRemoveScene = async (sceneId: string) => {
    await onRemoveScene?.(sceneId);
  };

  // Calculate total pages and estimated time
  const totalPages = orderedScenes.reduce((sum, s) => sum + s.pageCount, 0);
  const totalMinutes = orderedScenes.reduce(
    (sum, s) => sum + (s.estimatedMinutes || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {orderedScenes.length} scene{orderedScenes.length !== 1 ? "s" : ""} ·{" "}
          {totalPages.toFixed(1)} pages
          {totalMinutes > 0 && ` · ~${totalMinutes} min`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddScenes(!showAddScenes)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Scene
        </Button>
      </div>

      {/* Add Scenes Panel */}
      {showAddScenes && (
        <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Available Scenes</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowAddScenes(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {availableScenes.length > 0 ? (
            <div className="max-h-48 overflow-auto space-y-1">
              {availableScenes.map((scene) => (
                <button
                  key={scene.id}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left text-sm"
                  onClick={() => handleAddScene(scene.id)}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium">
                    {scene.sceneNumber}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {scene.synopsis || "No synopsis"}
                  </span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              All scenes have been assigned
            </p>
          )}
        </div>
      )}

      {/* Scene List */}
      {orderedScenes.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={orderedScenes.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {orderedScenes.map((scene, index) => (
                <div key={scene.id} className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs text-muted-foreground font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <SortableSceneCard
                      scene={scene}
                      onRemove={
                        onRemoveScene
                          ? () => handleRemoveScene(scene.id)
                          : undefined
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeScene && <SceneCard scene={activeScene} />}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="border border-dashed border-border rounded-lg px-4 py-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No scenes assigned</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &quot;Add Scene&quot; to assign scenes to this day
          </p>
        </div>
      )}
    </div>
  );
}
