"use client";

import * as React from "react";
import { Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useElementSuggestions } from "@/lib/hooks/use-element-suggestions";
import { ElementSuggestionPill } from "./element-suggestion-pill";
import type { Element } from "@/lib/actions/elements";
import type { ElementCategory } from "@/lib/constants/elements";

interface SuggestionContainerProps {
  sceneId: string;
  projectId: string;
  scriptText?: string;
  existingElements: { category: ElementCategory; name: string }[];
  onAcceptSuggestion: (category: ElementCategory, name: string) => Promise<void>;
}

export function SuggestionContainer({
  sceneId,
  projectId,
  scriptText,
  existingElements,
  onAcceptSuggestion,
}: SuggestionContainerProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [acceptingIds, setAcceptingIds] = React.useState<Set<string>>(new Set());

  const {
    pendingSuggestions,
    isLoading,
    fetchSuggestions,
    acceptSuggestion,
    dismissSuggestion,
  } = useElementSuggestions({
    sceneId,
    projectId,
    scriptText,
    existingElements,
    autoFetch: true,
  });

  const handleAccept = async (suggestionId: string, category: ElementCategory, name: string) => {
    setAcceptingIds((prev) => new Set(prev).add(suggestionId));

    try {
      await onAcceptSuggestion(category, name);
      acceptSuggestion(suggestionId);
    } catch (error) {
      console.error("Failed to accept suggestion:", error);
    } finally {
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  // Don't render if no suggestions and not loading
  if (!isLoading && pendingSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="border border-primary/20 rounded-lg bg-primary/5 overflow-hidden mb-4">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-primary/10 transition-colors"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-primary">
          Wrapshot Intelligence Suggestions
          {pendingSuggestions.length > 0 && (
            <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
              {pendingSuggestions.length}
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            fetchSuggestions();
          }}
          disabled={isLoading}
          className="h-6 w-6"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2 border-t border-primary/10">
          {isLoading && pendingSuggestions.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Analyzing scene...
            </div>
          ) : (
            pendingSuggestions.map((suggestion) => (
              <ElementSuggestionPill
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={() =>
                  handleAccept(suggestion.id, suggestion.category, suggestion.name)
                }
                onDismiss={() => dismissSuggestion(suggestion.id)}
                isAccepting={acceptingIds.has(suggestion.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Inline suggestions for a specific category
interface CategorySuggestionsProps {
  sceneId: string;
  category: ElementCategory;
  onAccept: (name: string) => Promise<void>;
}

export function CategorySuggestions({
  sceneId,
  category,
  onAccept,
}: CategorySuggestionsProps) {
  const [acceptingIds, setAcceptingIds] = React.useState<Set<string>>(new Set());

  const { getSuggestionsForCategory, acceptSuggestion, dismissSuggestion } =
    useElementSuggestions({
      sceneId,
      projectId: "",
      scriptText: "",
      existingElements: [],
      autoFetch: false,
      enabled: false,
    });

  const suggestions = getSuggestionsForCategory(category);

  const handleAccept = async (suggestionId: string, name: string) => {
    setAcceptingIds((prev) => new Set(prev).add(suggestionId));

    try {
      await onAccept(name);
      acceptSuggestion(suggestionId);
    } finally {
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-dashed border-primary/20 pt-2 mt-2">
      {suggestions.map((suggestion) => (
        <ElementSuggestionPill
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={() => handleAccept(suggestion.id, suggestion.name)}
          onDismiss={() => dismissSuggestion(suggestion.id)}
          isAccepting={acceptingIds.has(suggestion.id)}
        />
      ))}
    </div>
  );
}
