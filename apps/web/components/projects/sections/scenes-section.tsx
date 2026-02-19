"use client";

import * as React from "react";
import { Plus, LayoutGrid, Columns3, GanttChart, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneGrid } from "@/components/scenes/scene-grid";
import { SceneKanban } from "@/components/scenes/scene-kanban";
import { SceneTimeline } from "@/components/scenes/scene-timeline";
import { AddSceneForm } from "@/components/forms/add-scene-form";
import { cn } from "@/lib/utils";
import {
  reorderScenes as reorderScenesAction,
  updateScene as updateSceneAction,
  deleteScene as deleteSceneAction,
  type Scene,
  type SceneStatus
} from "@/lib/actions/scenes";
import type { CastMember, ShootingDay } from "@/lib/types";

type ViewMode = "grid" | "list" | "kanban" | "timeline";

interface ScenesSectionProps {
  projectId: string;
  scenes: Scene[];
  cast: CastMember[];
  shootingDays: ShootingDay[];
}

export function ScenesSection({
  projectId,
  scenes,
  cast,
  shootingDays,
}: ScenesSectionProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [showAddScene, setShowAddScene] = React.useState(false);
  const [editingScene, setEditingScene] = React.useState<Scene | null>(null);
  const [localScenes, setLocalScenes] = React.useState(scenes);

  // Update local scenes when props change
  React.useEffect(() => {
    setLocalScenes(scenes);
  }, [scenes]);

  // Sort scenes by sortOrder
  const sortedScenes = React.useMemo(() => {
    return [...localScenes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [localScenes]);

  const handleReorder = async (sceneIds: string[]) => {
    // Optimistic update
    const reorderedScenes = sceneIds.map((id, index) => {
      const scene = localScenes.find((s) => s.id === id);
      return scene ? { ...scene, sortOrder: index } : null;
    }).filter(Boolean) as Scene[];
    setLocalScenes(reorderedScenes);

    await reorderScenesAction(projectId, sceneIds);
  };

  const handleStatusChange = async (sceneId: string, status: SceneStatus) => {
    // Optimistic update
    setLocalScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, status } : s))
    );

    await updateSceneAction(sceneId, { status });
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setLocalScenes((prev) => prev.filter((s) => s.id !== id));

    await deleteSceneAction(id, projectId);
  };

  const handleEdit = (scene: Scene) => {
    setEditingScene(scene);
  };

  const totalPages = localScenes.reduce((sum, s) => sum + s.pageCount, 0);
  const completedScenes = localScenes.filter((s) => s.status === "COMPLETED").length;

  const viewModes: { id: ViewMode; label: string; icon: React.ElementType }[] = [
    { id: "list", label: "List", icon: LayoutGrid },
    { id: "grid", label: "Grid", icon: LayoutGrid },
    { id: "kanban", label: "Kanban", icon: Columns3 },
    { id: "timeline", label: "Timeline", icon: GanttChart },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{localScenes.length} scenes</span>
            <span>·</span>
            <span>{totalPages.toFixed(1)} pages</span>
            <span>·</span>
            <span>{completedScenes} completed</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border p-1">
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    viewMode === mode.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          <Button variant="skeuo" size="sm" onClick={() => setShowAddScene(true)}>
            <Plus className="h-4 w-4" />
            Add Scene
          </Button>
        </div>
      </div>

      {/* Content */}
      {localScenes.length > 0 ? (
        <>
          {(viewMode === "grid" || viewMode === "list") && (
            <SceneGrid
              scenes={sortedScenes}
              cast={cast}
              onReorder={handleReorder}
              onEdit={handleEdit}
              onDelete={handleDelete}
              layout={viewMode === "grid" ? "grid" : "list"}
            />
          )}

          {viewMode === "kanban" && (
            <SceneKanban
              scenes={sortedScenes}
              cast={cast}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

          {viewMode === "timeline" && (
            <SceneTimeline
              scenes={sortedScenes}
              cast={cast}
              shootingDays={shootingDays}
              onReorder={handleReorder}
              onEdit={handleEdit}
            />
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <Clapperboard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium mb-1">No scenes yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first scene to start building your shot list
          </p>
          <Button variant="skeuo" onClick={() => setShowAddScene(true)}>
            <Plus className="h-4 w-4" />
            Add First Scene
          </Button>
        </div>
      )}

      {/* Add/Edit Scene Form */}
      <AddSceneForm
        projectId={projectId}
        open={showAddScene || !!editingScene}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddScene(false);
            setEditingScene(null);
          }
        }}
        onSuccess={() => {
          setShowAddScene(false);
          setEditingScene(null);
        }}
        editScene={editingScene}
      />
    </div>
  );
}
