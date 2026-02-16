"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SortableSceneStrip } from "./scene-strip";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/actions/scenes";

interface UnscheduledPoolProps {
  scenes: Scene[];
  onSceneClick?: (sceneId: string) => void;
  selectedSceneId?: string | null;
  activeId?: string | null;
}

export function UnscheduledPool({
  scenes,
  onSceneClick,
  selectedSceneId,
  activeId,
}: UnscheduledPoolProps) {
  const [search, setSearch] = React.useState("");

  const { isOver, setNodeRef } = useDroppable({
    id: "unscheduled-pool",
    data: { type: "unscheduled-pool" },
  });

  // Dim when dragging but not over this container
  const isDimmed = activeId && !isOver;

  // Filter scenes by search
  const filteredScenes = React.useMemo(() => {
    if (!search.trim()) return scenes;

    const searchLower = search.toLowerCase();
    return scenes.filter(
      (s) =>
        s.sceneNumber.toLowerCase().includes(searchLower) ||
        s.synopsis?.toLowerCase().includes(searchLower) ||
        s.setName?.toLowerCase().includes(searchLower) ||
        s.location?.name?.toLowerCase().includes(searchLower)
    );
  }, [scenes, search]);

  // Sort by scene number
  const sortedScenes = React.useMemo(() => {
    return [...filteredScenes].sort((a, b) => {
      // Try numeric sort first
      const aNum = parseInt(a.sceneNumber);
      const bNum = parseInt(b.sceneNumber);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      // Fallback to string sort
      return a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
    });
  }, [filteredScenes]);

  const sortableIds = React.useMemo(
    () => sortedScenes.map((scene) => scene.id),
    [sortedScenes]
  );

  const totalPages = scenes.reduce(
    (sum, s) => sum + (s.pageEighths ? s.pageEighths / 8 : s.pageCount),
    0
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full border border-border rounded-lg bg-card transition-all duration-200",
        isOver && "ring-2 ring-primary bg-primary/5 scale-[1.01]",
        isDimmed && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Unscheduled</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {scenes.length} · {totalPages.toFixed(1)}pg
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scenes..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Scenes List */}
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-auto p-2 space-y-1.5">
          {sortedScenes.length > 0 ? (
            sortedScenes.map((scene) => (
              <SortableSceneStrip
                key={scene.id}
                scene={scene}
                onClick={() => onSceneClick?.(scene.id)}
                isSelected={selectedSceneId === scene.id}
                layout="strip"
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              {search ? (
                <>
                  <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No scenes match</p>
                </>
              ) : (
                <>
                  <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">All scenes scheduled!</p>
                </>
              )}
            </div>
          )}
        </div>
      </SortableContext>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          Drag scenes to shooting days
        </p>
      </div>
    </div>
  );
}
