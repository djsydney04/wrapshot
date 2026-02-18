"use client";

import * as React from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ElementHoverCard } from "./element-hover-card";

interface RecognizedElement {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  category: string;
  confidence: number;
  suggestion: string;
}

interface HighlightedScriptTextProps {
  sceneId: string;
  projectId: string;
  scriptText: string;
  onAddElement?: (category: string, name: string) => Promise<void>;
  className?: string;
}

export function HighlightedScriptText({
  sceneId,
  projectId,
  scriptText,
  onAddElement,
  className,
}: HighlightedScriptTextProps) {
  const [elements, setElements] = React.useState<RecognizedElement[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = React.useState(false);

  const analyzeText = async () => {
    if (!scriptText || hasAnalyzed) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/recognize-elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          projectId,
          scriptText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze text");
      }

      const { data } = await response.json();
      setElements(data.elements || []);
      setHasAnalyzed(true);
    } catch (err) {
      console.error("Text analysis error:", err);
      setError("Failed to analyze text");
    } finally {
      setIsLoading(false);
    }
  };

  // Build segments with highlights
  const segments = React.useMemo(() => {
    if (elements.length === 0) {
      return [{ type: "text" as const, content: scriptText }];
    }

    const result: { type: "text" | "highlight"; content: string; element?: RecognizedElement }[] = [];
    let lastEnd = 0;

    for (const element of elements) {
      // Add text before this element
      if (element.startIndex > lastEnd) {
        result.push({
          type: "text",
          content: scriptText.slice(lastEnd, element.startIndex),
        });
      }

      // Add the highlighted element
      result.push({
        type: "highlight",
        content: scriptText.slice(element.startIndex, element.endIndex),
        element,
      });

      lastEnd = element.endIndex;
    }

    // Add remaining text
    if (lastEnd < scriptText.length) {
      result.push({
        type: "text",
        content: scriptText.slice(lastEnd),
      });
    }

    return result;
  }, [scriptText, elements]);

  // Category colors
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      PROP: "bg-blue-100 border-blue-300 text-blue-800",
      WARDROBE: "bg-pink-100 border-pink-300 text-pink-800",
      VEHICLE: "bg-slate-100 border-slate-300 text-slate-800",
      VFX: "bg-purple-100 border-purple-300 text-purple-800",
      SFX: "bg-orange-100 border-orange-300 text-orange-800",
      ANIMAL: "bg-lime-100 border-lime-300 text-lime-800",
      MAKEUP: "bg-rose-100 border-rose-300 text-rose-800",
      CAST: "bg-red-100 border-red-300 text-red-800",
      LOCATION: "bg-emerald-100 border-emerald-300 text-emerald-800",
      SOUND: "bg-cyan-100 border-cyan-300 text-cyan-800",
    };
    return colors[category] || "bg-gray-100 border-gray-300 text-gray-800";
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Analysis button */}
      {!hasAnalyzed && !isLoading && (
        <button
          type="button"
          onClick={analyzeText}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Analyze script for elements
        </button>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing script text...
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Script text with highlights */}
      <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
        {segments.map((segment, index) => {
          if (segment.type === "text") {
            return <span key={index}>{segment.content}</span>;
          }

          const element = segment.element!;
          return (
            <ElementHoverCard
              key={element.id}
              element={element}
              onAdd={
                onAddElement
                  ? () => onAddElement(element.category, element.suggestion)
                  : undefined
              }
            >
              <span
                className={cn(
                  "relative cursor-pointer px-0.5 rounded",
                  "border-b-2 border-dotted",
                  getCategoryColor(element.category)
                )}
              >
                {segment.content}
              </span>
            </ElementHoverCard>
          );
        })}
      </div>

      {/* Legend */}
      {hasAnalyzed && elements.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Elements found:</span>
          {Array.from(new Set(elements.map((e) => e.category))).map((category) => (
            <span
              key={category}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                getCategoryColor(category)
              )}
            >
              {category}
              <span className="opacity-60">
                ({elements.filter((e) => e.category === category).length})
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
