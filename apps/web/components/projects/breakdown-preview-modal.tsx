"use client";

import * as React from "react";
import { X, Check, Trash2, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExtractedScene, BreakdownResult } from "@/lib/actions/script-breakdown";

interface BreakdownPreviewModalProps {
  result: BreakdownResult;
  scenes: ExtractedScene[];
  onRemoveScene: (index: number) => void;
  onEditScene: (index: number, updates: Partial<ExtractedScene>) => void;
  onImport: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export function BreakdownPreviewModal({
  result,
  scenes,
  onRemoveScene,
  onEditScene,
  onImport,
  onCancel,
  isImporting,
}: BreakdownPreviewModalProps) {
  const [expandedScene, setExpandedScene] = React.useState<number | null>(null);
  const [editingScene, setEditingScene] = React.useState<number | null>(null);
  const [editValues, setEditValues] = React.useState<Partial<ExtractedScene>>({});

  const totalPages = scenes.reduce((sum, s) => sum + s.page_length_eighths / 8, 0);
  const uniqueCharacters = new Set(scenes.flatMap((s) => s.characters || []));
  const uniqueLocations = new Set(scenes.map((s) => s.set_name));

  const handleStartEdit = (index: number) => {
    setEditingScene(index);
    setEditValues(scenes[index]);
    setExpandedScene(index);
  };

  const handleSaveEdit = () => {
    if (editingScene !== null) {
      onEditScene(editingScene, editValues);
      setEditingScene(null);
      setEditValues({});
    }
  };

  const handleCancelEdit = () => {
    setEditingScene(null);
    setEditValues({});
  };

  const getStripColor = (intExt: string, timeOfDay: string) => {
    const isInt = intExt === "INT";
    const isDay = ["DAY", "MORNING", "AFTERNOON"].includes(timeOfDay.toUpperCase());

    if (isInt && isDay) return "bg-white border-gray-300";
    if (!isInt && isDay) return "bg-yellow-100 border-yellow-300";
    if (isInt && !isDay) return "bg-blue-100 border-blue-300";
    return "bg-green-100 border-green-300"; // EXT NIGHT
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Review Extracted Scenes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {scenes.length} scenes found. Edit or remove any scenes before importing.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold">{scenes.length}</p>
          <p className="text-xs text-muted-foreground">Scenes</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold">{totalPages.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Pages</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold">{uniqueCharacters.size}</p>
          <p className="text-xs text-muted-foreground">Characters</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold">{uniqueLocations.size}</p>
          <p className="text-xs text-muted-foreground">Locations</p>
        </div>
      </div>

      {/* Scene List */}
      <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
        {scenes.map((scene, index) => (
          <div
            key={index}
            className={cn(
              "border-b border-border last:border-b-0",
              expandedScene === index && "bg-muted/30"
            )}
          >
            {/* Scene Header */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50",
                getStripColor(scene.int_ext, scene.time_of_day),
                "border-l-4"
              )}
              onClick={() => setExpandedScene(expandedScene === index ? null : index)}
            >
              <span className="font-mono font-bold text-sm w-10">{scene.scene_number}</span>
              <Badge
                variant={scene.int_ext === "INT" ? "int" : "ext"}
                className="text-[9px] px-1 py-0"
              >
                {scene.int_ext}
              </Badge>
              <Badge
                variant={
                  ["DAY", "MORNING", "AFTERNOON"].includes(scene.time_of_day.toUpperCase())
                    ? "day"
                    : "night"
                }
                className="text-[9px] px-1 py-0"
              >
                {scene.time_of_day}
              </Badge>
              <span className="flex-1 text-sm truncate">{scene.set_name}</span>
              <span className="text-xs text-muted-foreground">
                {(scene.page_length_eighths / 8).toFixed(1)} pg
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(index);
                  }}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveScene(index);
                  }}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                {expandedScene === index ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedScene === index && (
              <div className="px-3 py-3 bg-card">
                {editingScene === index ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Scene Number
                        </label>
                        <Input
                          value={editValues.scene_number || ""}
                          onChange={(e) =>
                            setEditValues({ ...editValues, scene_number: e.target.value })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Page Eighths
                        </label>
                        <Input
                          type="number"
                          value={editValues.page_length_eighths || 1}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              page_length_eighths: parseInt(e.target.value) || 1,
                            })
                          }
                          className="h-8 text-sm"
                          min={1}
                          max={64}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Set Name
                      </label>
                      <Input
                        value={editValues.set_name || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, set_name: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Synopsis
                      </label>
                      <Input
                        value={editValues.synopsis || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, synopsis: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">{scene.synopsis || "No synopsis"}</p>
                    {scene.characters && scene.characters.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground mr-1">Characters:</span>
                        {scene.characters.map((char, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {char}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Pages {scene.script_page_start} - {scene.script_page_end}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onImport} disabled={scenes.length === 0 || isImporting}>
          {isImporting ? (
            "Importing..."
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              Import {scenes.length} Scenes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
