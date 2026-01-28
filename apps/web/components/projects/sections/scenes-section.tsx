"use client";

import * as React from "react";
import { Plus, LayoutGrid, Columns3, GanttChart, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SceneGrid } from "@/components/scenes/scene-grid";
import { SceneKanban } from "@/components/scenes/scene-kanban";
import { SceneTimeline } from "@/components/scenes/scene-timeline";
import { AddSceneForm } from "@/components/forms/add-scene-form";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/stores/project-store";
import type { Scene, CastMember, ShootingDay } from "@/lib/mock-data";

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
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { reorderScenes, updateScene, deleteScene } = useProjectStore();

  // Sort scenes by sortOrder
  const sortedScenes = React.useMemo(() => {
    return [...scenes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [scenes]);

  const handleReorder = (sceneIds: string[]) => {
    reorderScenes(projectId, sceneIds);
    forceUpdate();
  };

  const handleStatusChange = (sceneId: string, status: Scene["status"]) => {
    updateScene(sceneId, { status });
    forceUpdate();
  };

  const handleDelete = (id: string) => {
    deleteScene(id);
    forceUpdate();
  };

  const handleEdit = (scene: Scene) => {
    setEditingScene(scene);
  };

  const totalPages = scenes.reduce((sum, s) => sum + s.pageCount, 0);
  const completedScenes = scenes.filter((s) => s.status === "COMPLETED").length;

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
            <span>{scenes.length} scenes</span>
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

          <Button size="sm" onClick={() => setShowAddScene(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Scene
          </Button>
        </div>
      </div>

      {/* Content */}
      {scenes.length > 0 ? (
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
          <Button onClick={() => setShowAddScene(true)}>
            <Plus className="h-4 w-4 mr-1" />
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
          forceUpdate();
        }}
        editScene={editingScene}
      />
    </div>
  );
}
