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
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableSceneCard } from "./scene-card";
import type { Scene, CastMember } from "@/lib/mock-data";

interface SceneGridProps {
  scenes: Scene[];
  cast: CastMember[];
  onReorder: (sceneIds: string[]) => void;
  onEdit?: (scene: Scene) => void;
  onDelete?: (id: string) => void;
  layout: "grid" | "list";
}

export function SceneGrid({
  scenes,
  cast,
  onReorder,
  onEdit,
  onDelete,
  layout,
}: SceneGridProps) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(scenes, oldIndex, newIndex);
      onReorder(newOrder.map((s) => s.id));
    }
  };

  const sceneIds = scenes.map((s) => s.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sceneIds}
        strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div
          className={
            layout === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              : "space-y-3"
          }
        >
          {scenes.map((scene) => (
            <SortableSceneCard
              key={scene.id}
              scene={scene}
              cast={cast}
              onEdit={onEdit}
              onDelete={onDelete}
              compact={layout === "grid"}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
