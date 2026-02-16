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
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SceneCard } from "./scene-card";
import { cn } from "@/lib/utils";
import type { Scene, SceneStatus } from "@/lib/actions/scenes";
import type { CastMember } from "@/lib/types";

const COLUMNS = [
  { id: "NOT_SCHEDULED", label: "Not Scheduled", color: "bg-muted" },
  { id: "SCHEDULED", label: "Scheduled", color: "bg-blue-500/10" },
  { id: "PARTIALLY_SHOT", label: "Partially Shot", color: "bg-yellow-500/10" },
  { id: "COMPLETED", label: "Completed", color: "bg-green-500/10" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

interface SceneKanbanProps {
  scenes: Scene[];
  cast: CastMember[];
  onStatusChange: (sceneId: string, status: SceneStatus) => void;
  onEdit?: (scene: Scene) => void;
  onDelete?: (id: string) => void;
}

export function SceneKanban({
  scenes,
  cast,
  onStatusChange,
  onEdit,
  onDelete,
}: SceneKanbanProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

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

  const activeScene = activeId ? scenes.find((s) => s.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const sceneId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const column = COLUMNS.find((c) => c.id === overId);
    if (column) {
      const scene = scenes.find((s) => s.id === sceneId);
      if (scene && scene.status !== column.id) {
        onStatusChange(sceneId, column.id);
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sceneId = active.id as string;
    const overId = over.id as string;

    // Check if hovering over a different scene
    const overScene = scenes.find((s) => s.id === overId);
    if (overScene) {
      const activeScene = scenes.find((s) => s.id === sceneId);
      if (activeScene && activeScene.status !== overScene.status) {
        onStatusChange(sceneId, overScene.status);
      }
    }
  };

  // Group scenes by status
  const scenesByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = scenes.filter((s) => s.status === col.id || (col.id === "NOT_SCHEDULED" && s.status === "CUT"));
      return acc;
    },
    {} as Record<ColumnId, Scene[]>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            scenes={scenesByStatus[column.id]}
            cast={cast}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <DragOverlay>
        {activeScene && (
          <SceneCard
            scene={activeScene}
            cast={cast}
            compact
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  scenes,
  cast,
  onEdit,
  onDelete,
}: {
  column: (typeof COLUMNS)[number];
  scenes: Scene[];
  cast: CastMember[];
  onEdit?: (scene: Scene) => void;
  onDelete?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-72 rounded-lg border border-border",
        column.color,
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{column.label}</h3>
          <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded">
            {scenes.length}
          </span>
        </div>
      </div>

      <SortableContext
        items={scenes.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-2 space-y-2 min-h-[200px]">
          {scenes.map((scene) => (
            <KanbanCard
              key={scene.id}
              scene={scene}
              cast={cast}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {scenes.length === 0 && (
            <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
              Drag scenes here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function KanbanCard({
  scene,
  cast,
  onEdit,
  onDelete,
}: {
  scene: Scene;
  cast: CastMember[];
  onEdit?: (scene: Scene) => void;
  onDelete?: (id: string) => void;
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
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <SceneCard
        scene={scene}
        cast={cast}
        onEdit={onEdit}
        onDelete={onDelete}
        compact
      />
    </div>
  );
}
