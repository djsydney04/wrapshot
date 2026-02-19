"use client";

import * as React from "react";
import { Plus, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecognizedElement {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  category: string;
  confidence: number;
  suggestion: string;
}

interface ElementHoverCardProps {
  element: RecognizedElement;
  children: React.ReactNode;
  onAdd?: () => void;
}

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  PROP: "Prop",
  WARDROBE: "Wardrobe",
  VEHICLE: "Vehicle",
  VFX: "Visual Effects",
  SFX: "Special Effects",
  ANIMAL: "Animal",
  MAKEUP: "Makeup",
  CAST: "Cast",
  LOCATION: "Location",
  SOUND: "Sound",
  SET_DRESSING: "Set Dressing",
  GREENERY: "Greenery",
  BACKGROUND: "Background",
};

// Category colors for the badge
const CATEGORY_COLORS: Record<string, string> = {
  PROP: "bg-blue-100 text-blue-700 border-blue-200",
  WARDROBE: "bg-pink-100 text-pink-700 border-pink-200",
  VEHICLE: "bg-slate-100 text-slate-700 border-slate-200",
  VFX: "bg-purple-100 text-purple-700 border-purple-200",
  SFX: "bg-orange-100 text-orange-700 border-orange-200",
  ANIMAL: "bg-lime-100 text-lime-700 border-lime-200",
  MAKEUP: "bg-rose-100 text-rose-700 border-rose-200",
  CAST: "bg-red-100 text-red-700 border-red-200",
  LOCATION: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SOUND: "bg-cyan-100 text-cyan-700 border-cyan-200",
  SET_DRESSING: "bg-teal-100 text-teal-700 border-teal-200",
  GREENERY: "bg-green-100 text-green-700 border-green-200",
  BACKGROUND: "bg-amber-100 text-amber-700 border-amber-200",
};

export function ElementHoverCard({
  element,
  children,
  onAdd,
}: ElementHoverCardProps) {
  const [isAdding, setIsAdding] = React.useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onAdd) return;

    setIsAdding(true);
    try {
      await onAdd();
    } finally {
      setIsAdding(false);
    }
  };

  const categoryLabel = CATEGORY_LABELS[element.category] || element.category;
  const categoryColor = CATEGORY_COLORS[element.category] || "bg-gray-100 text-gray-700 border-gray-200";

  // Confidence indicator
  const confidenceColor =
    element.confidence >= 0.9
      ? "text-green-600"
      : element.confidence >= 0.7
        ? "text-yellow-600"
        : "text-orange-600";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="w-56 p-0" sideOffset={8}>
          <div className="p-3 space-y-2.5">
            {/* Header with category badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-medium text-sm">{element.suggestion}</p>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border",
                    categoryColor
                  )}
                >
                  {categoryLabel}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                <Lightbulb className="h-3 w-3" />
                Wrapshot Intelligence
              </div>
            </div>

            {/* Confidence */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className={cn("font-medium", confidenceColor)}>
                {Math.round(element.confidence * 100)}%
              </span>
            </div>

            {/* Add button */}
            {onAdd && (
              <Button
                size="sm"
                className="w-full gap-1.5 h-7 text-xs"
                onClick={handleAdd}
                disabled={isAdding}
              >
                {isAdding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Add to Breakdown
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
