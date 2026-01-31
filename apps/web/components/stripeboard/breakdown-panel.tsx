"use client";

import * as React from "react";
import {
  X,
  Save,
  Clock,
  Users,
  MapPin,
  FileText,
  Shirt,
  Car,
  Sparkles,
  Camera,
  Lightbulb,
  Mic,
  Trees,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/actions/scenes";
import type { CastMember } from "@/lib/mock-data";

interface BreakdownPanelProps {
  scene: Scene;
  cast: CastMember[];
  onUpdate: (updates: Partial<Scene>) => void;
  onClose: () => void;
}

// Industry-standard breakdown categories with colors
const ELEMENT_CATEGORIES = [
  { key: "CAST", label: "Cast", icon: Users, color: "bg-red-100 text-red-700" },
  { key: "BACKGROUND", label: "Background", icon: Users, color: "bg-orange-100 text-orange-700" },
  { key: "PROP", label: "Props", icon: FileText, color: "bg-purple-100 text-purple-700" },
  { key: "WARDROBE", label: "Wardrobe", icon: Shirt, color: "bg-blue-100 text-blue-700" },
  { key: "VEHICLE", label: "Vehicles", icon: Car, color: "bg-yellow-100 text-yellow-700" },
  { key: "VFX", label: "VFX", icon: Sparkles, color: "bg-pink-100 text-pink-700" },
  { key: "SFX", label: "SFX", icon: Sparkles, color: "bg-indigo-100 text-indigo-700" },
  { key: "CAMERA", label: "Camera", icon: Camera, color: "bg-cyan-100 text-cyan-700" },
  { key: "ELECTRIC", label: "Lighting", icon: Lightbulb, color: "bg-amber-100 text-amber-700" },
  { key: "SOUND", label: "Sound", icon: Mic, color: "bg-green-100 text-green-700" },
  { key: "GREENERY", label: "Greenery", icon: Trees, color: "bg-emerald-100 text-emerald-700" },
  { key: "SAFETY_NOTES", label: "Safety", icon: AlertTriangle, color: "bg-red-100 text-red-700" },
] as const;

export function BreakdownPanel({
  scene,
  cast,
  onUpdate,
  onClose,
}: BreakdownPanelProps) {
  const [editedScene, setEditedScene] = React.useState(scene);
  const [isDirty, setIsDirty] = React.useState(false);

  // Reset when scene changes
  React.useEffect(() => {
    setEditedScene(scene);
    setIsDirty(false);
  }, [scene]);

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
    actorName: sc.castMember?.actorName || null,
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

        {/* Synopsis */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Synopsis
          </label>
          <Textarea
            value={editedScene.synopsis || ""}
            onChange={(e) => handleChange("synopsis", e.target.value)}
            placeholder="Scene description..."
            className="text-sm min-h-[60px] resize-none"
          />
        </div>

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

        {/* Element Categories (placeholder for future expansion) */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Elements
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {ELEMENT_CATEGORIES.slice(0, 8).map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs",
                    cat.color,
                    "opacity-50 hover:opacity-100 transition-opacity"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>
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
