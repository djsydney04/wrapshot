"use client";

import * as React from "react";
import {
  X,
  Save,
  Clock,
  Users,
  MapPin,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/actions/scenes";
import { SmartSynopsisField } from "@/components/ai/smart-synopsis-field";
import { TimeEstimationWidget } from "@/components/ai/time-estimation-widget";
import { SceneBreakdownEditor } from "@/components/scenes/scene-breakdown-editor";
import { getElements, getSceneElements, type Element } from "@/lib/actions/elements";
import { getLocations, type Location } from "@/lib/actions/locations";
import { getCastMembers, type CastMember, type CastMemberWithInviteStatus } from "@/lib/actions/cast";
import type { SceneElementItem } from "@/components/scenes/breakdown-category";

interface BreakdownPanelProps {
  scene: Scene;
  projectId: string;
  cast: CastMemberWithInviteStatus[];
  onUpdate: (updates: Partial<Scene>) => void;
  onClose: () => void;
}

export function BreakdownPanel({
  scene,
  projectId,
  cast: _cast,
  onUpdate,
  onClose,
}: BreakdownPanelProps) {
  const [editedScene, setEditedScene] = React.useState(scene);
  const [isDirty, setIsDirty] = React.useState(false);
  const [loadingBreakdownData, setLoadingBreakdownData] = React.useState(true);
  const [elements, setElements] = React.useState<Element[]>([]);
  const [sceneElements, setSceneElements] = React.useState<SceneElementItem[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [castMembers, setCastMembers] = React.useState<CastMember[]>([]);

  // Reset when scene changes
  React.useEffect(() => {
    setEditedScene(scene);
    setIsDirty(false);
  }, [scene]);

  const fetchBreakdownData = React.useCallback(async () => {
    setLoadingBreakdownData(true);
    try {
      const [elementsResult, sceneElementsResult, locationsResult, castResult] = await Promise.all([
        getElements(projectId),
        getSceneElements(scene.id),
        getLocations(projectId),
        getCastMembers(projectId),
      ]);

      if (elementsResult.data) {
        setElements(elementsResult.data);
      }
      if (locationsResult.data) {
        setLocations(locationsResult.data);
      }
      if (castResult.data) {
        setCastMembers(castResult.data);
      }
      if (sceneElementsResult.data) {
        const mapped = sceneElementsResult.data.map(
          (item: {
            id: string;
            elementId: string;
            quantity: number;
            notes: string | null;
            element: Element;
          }) => ({
            id: item.id,
            elementId: item.elementId,
            quantity: item.quantity,
            notes: item.notes,
            element: item.element,
          })
        );
        setSceneElements(mapped);
      } else {
        setSceneElements([]);
      }
    } finally {
      setLoadingBreakdownData(false);
    }
  }, [projectId, scene.id]);

  React.useEffect(() => {
    fetchBreakdownData();
  }, [fetchBreakdownData]);

  const handleChange = (key: keyof Scene, value: unknown) => {
    setEditedScene((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onUpdate(editedScene);
    setIsDirty(false);
  };

  // Get cast members for this scene
  const sceneCast = scene.cast?.map((sc) => ({
    id: sc.castMemberId,
    characterName: sc.castMember?.characterName || "Unknown",
    actorName: sc.castMember?.actorName || undefined,
  })) || [];

  const stripColor = getStripColor(scene.intExt, scene.dayNight);

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center justify-between", stripColor)}>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg">{scene.sceneNumber}</span>
          <Badge variant={scene.intExt === "INT" ? "int" : "ext"} className="text-[10px]">
            {scene.intExt}
          </Badge>
          <Badge
            variant={
              ["DAY", "MORNING", "AFTERNOON"].includes(scene.dayNight) ? "day" : "night"
            }
            className="text-[10px]"
          >
            {scene.dayNight}
          </Badge>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Set Name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <MapPin className="h-3 w-3 inline mr-1" />
            Set Name
          </label>
          <Input
            value={editedScene.setName || scene.location?.name || ""}
            onChange={(e) => handleChange("setName", e.target.value)}
            placeholder="Location / Set name"
            className="h-8 text-sm"
          />
        </div>

        {/* Page Count */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <FileText className="h-3 w-3 inline mr-1" />
              Page 1/8ths
            </label>
            <Input
              type="number"
              value={editedScene.pageEighths || Math.round(scene.pageCount * 8)}
              onChange={(e) => handleChange("pageEighths", parseInt(e.target.value) || 1)}
              min={1}
              max={64}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Clock className="h-3 w-3 inline mr-1" />
              Est. Hours
            </label>
            <Input
              type="number"
              step="0.5"
              value={editedScene.estimatedHours || ""}
              onChange={(e) => handleChange("estimatedHours", parseFloat(e.target.value) || null)}
              placeholder="0.0"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* AI Time Estimation Widget */}
        <TimeEstimationWidget
          sceneId={scene.id}
          projectId={projectId}
          sceneNumber={scene.sceneNumber}
          location={editedScene.setName || scene.location?.name}
          intExt={scene.intExt}
          dayNight={scene.dayNight}
          pageCount={scene.pageCount}
          pageEighths={editedScene.pageEighths || Math.round(scene.pageCount * 8)}
          cast={sceneCast}
          elements={scene.elements?.map((e: string) => ({ category: "UNKNOWN", name: e })) || []}
          synopsis={editedScene.synopsis || undefined}
          scriptText={scene.scriptText || undefined}
          currentEstimate={editedScene.estimatedHours || undefined}
          onEstimateChange={(hours) => handleChange("estimatedHours", hours)}
        />

        {/* Synopsis with AI generation */}
        <SmartSynopsisField
          sceneId={scene.id}
          projectId={projectId}
          sceneNumber={scene.sceneNumber}
          location={editedScene.setName || scene.location?.name}
          dayNight={scene.dayNight}
          scriptText={scene.scriptText || undefined}
          initialSynopsis={editedScene.synopsis || ""}
          onChange={(synopsis) => handleChange("synopsis", synopsis)}
        />

        {/* Cast */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            <Users className="h-3 w-3 inline mr-1" />
            Cast ({sceneCast.length})
          </label>
          {sceneCast.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sceneCast.map((member) => (
                <Badge
                  key={member.id}
                  variant="secondary"
                  className="text-[10px] bg-red-100 text-red-700 hover:bg-red-200"
                >
                  {member.characterName}
                  {member.actorName && (
                    <span className="opacity-60 ml-1">({member.actorName})</span>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No cast assigned</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Notes
          </label>
          <Textarea
            value={editedScene.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Production notes..."
            className="text-sm min-h-[60px] resize-none"
          />
        </div>

        {/* Breakdown Status */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Breakdown Status
          </label>
          <div className="flex gap-2">
            {(["PENDING", "IN_PROGRESS", "COMPLETED", "NEEDS_REVIEW"] as const).map((status) => (
              <Button
                key={status}
                variant={editedScene.breakdownStatus === status ? "default" : "outline"}
                size="sm"
                className="text-[10px] h-7"
                onClick={() => handleChange("breakdownStatus", status)}
              >
                {status.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        {/* Element Breakdown */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Elements
          </label>
          {loadingBreakdownData ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading scene breakdown tools...
            </div>
          ) : (
            <SceneBreakdownEditor
              scene={editedScene}
              projectId={projectId}
              cast={castMembers}
              elements={elements}
              sceneElements={sceneElements}
              locations={locations}
              onUpdate={fetchBreakdownData}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      {isDirty && (
        <div className="px-4 py-3 border-t border-border bg-muted/50">
          <Button onClick={handleSave} className="w-full" size="sm">
            <Save className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper to get strip color
function getStripColor(intExt: string, dayNight: string) {
  const isInt = intExt === "INT";
  const timeOfDay = dayNight?.toUpperCase() || "DAY";

  if (["DAY", "MORNING", "AFTERNOON"].includes(timeOfDay)) {
    return isInt
      ? "bg-white border-b border-gray-200"
      : "bg-yellow-50 border-b border-yellow-200";
  }

  if (["NIGHT", "EVENING"].includes(timeOfDay)) {
    return isInt
      ? "bg-blue-50 border-b border-blue-200"
      : "bg-green-50 border-b border-green-200";
  }

  if (["DAWN", "DUSK"].includes(timeOfDay)) {
    return "bg-pink-50 border-b border-pink-200";
  }

  return "bg-white border-b border-gray-200";
}
