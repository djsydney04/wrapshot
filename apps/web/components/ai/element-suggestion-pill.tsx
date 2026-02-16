"use client";

import * as React from "react";
import { Sparkles, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementSuggestion } from "@/lib/stores/ai-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ElementSuggestionPillProps {
  suggestion: ElementSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  isAccepting?: boolean;
}

export function ElementSuggestionPill({
  suggestion,
  onAccept,
  onDismiss,
  isAccepting = false,
}: ElementSuggestionPillProps) {
  const [isDismissing, setIsDismissing] = React.useState(false);

  const handleDismiss = () => {
    setIsDismissing(true);
    // Small delay for fade animation
    setTimeout(() => {
      onDismiss();
    }, 150);
  };

  // Confidence color
  const confidenceColor =
    suggestion.confidence >= 0.9
      ? "text-green-600"
      : suggestion.confidence >= 0.7
        ? "text-yellow-600"
        : "text-orange-600";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm",
          "bg-primary/5 border border-dashed border-primary/30",
          "transition-all duration-150",
          isDismissing && "opacity-0 scale-95",
          isAccepting && "bg-primary/10 border-primary/50"
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1 truncate text-muted-foreground">
              {suggestion.name}
              <span className="ml-1.5 text-xs opacity-60">(Wrapshot Intelligence)</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium mb-1">{suggestion.name}</p>
            <p className="text-xs text-muted-foreground mb-1">
              {suggestion.reason}
            </p>
            {suggestion.sourceText && (
              <p className="text-xs italic border-l-2 border-primary/30 pl-2 mt-2">
                &ldquo;{suggestion.sourceText}&rdquo;
              </p>
            )}
            <p className={cn("text-xs mt-2", confidenceColor)}>
              Confidence: {Math.round(suggestion.confidence * 100)}%
            </p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting}
            className={cn(
              "p-1 rounded hover:bg-primary/20 transition-colors",
              "text-primary hover:text-primary",
              isAccepting && "cursor-wait"
            )}
            aria-label="Accept suggestion"
          >
            {isAccepting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isAccepting}
            className={cn(
              "p-1 rounded hover:bg-destructive/20 transition-colors",
              "text-muted-foreground hover:text-destructive",
              isAccepting && "opacity-50 cursor-not-allowed"
            )}
            aria-label="Dismiss suggestion"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Ghost item for inline display within category list
interface GhostElementItemProps {
  suggestion: ElementSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  isAccepting?: boolean;
}

export function GhostElementItem({
  suggestion,
  onAccept,
  onDismiss,
  isAccepting = false,
}: GhostElementItemProps) {
  const [isDismissing, setIsDismissing] = React.useState(false);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss();
    }, 150);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-center gap-2 text-sm group",
          "opacity-70 hover:opacity-100",
          "border-b border-dashed border-primary/20 pb-2 mb-2",
          "transition-all duration-150",
          isDismissing && "opacity-0 scale-95 h-0 pb-0 mb-0 overflow-hidden"
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1 truncate text-muted-foreground">
              {suggestion.name}
              <span className="ml-1 text-xs text-primary/60">(Wrapshot Intelligence suggested)</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium mb-1">{suggestion.name}</p>
            <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
            {suggestion.sourceText && (
              <p className="text-xs italic border-l-2 border-primary/30 pl-2 mt-2">
                &ldquo;{suggestion.sourceText}&rdquo;
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting}
            className="p-0.5 hover:bg-primary/10 rounded text-primary"
            aria-label="Accept"
          >
            {isAccepting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isAccepting}
            className="p-0.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
