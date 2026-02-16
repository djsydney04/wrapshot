"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAIStore, type ElementSuggestion } from "@/lib/stores/ai-store";
import type { Element } from "@/lib/actions/elements";
import type { ElementCategory } from "@/lib/constants/elements";

interface UseElementSuggestionsOptions {
  sceneId: string;
  projectId: string;
  scriptText?: string;
  existingElements: { category: ElementCategory; name: string }[];
  autoFetch?: boolean;
  enabled?: boolean;
}

interface UseElementSuggestionsReturn {
  suggestions: ElementSuggestion[];
  pendingSuggestions: ElementSuggestion[];
  isLoading: boolean;
  fetchSuggestions: () => Promise<void>;
  acceptSuggestion: (suggestionId: string) => void;
  dismissSuggestion: (suggestionId: string) => void;
  getSuggestionsForCategory: (category: ElementCategory) => ElementSuggestion[];
}

// Cache to prevent duplicate fetches
const fetchCache = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useElementSuggestions({
  sceneId,
  projectId,
  scriptText,
  existingElements,
  autoFetch = true,
  enabled = true,
}: UseElementSuggestionsOptions): UseElementSuggestionsReturn {
  const {
    getSuggestionsForScene,
    getPendingSuggestionsForScene,
    loadingSuggestions,
    setSuggestions,
    setLoadingSuggestions,
    acceptSuggestion: storeAcceptSuggestion,
    dismissSuggestion: storeDismissSuggestion,
    autoSuggestEnabled,
  } = useAIStore();

  const isLoading = loadingSuggestions.has(sceneId);
  const suggestions = getSuggestionsForScene(sceneId);
  const pendingSuggestions = getPendingSuggestionsForScene(sceneId);
  const hasFetchedRef = useRef(false);

  const fetchSuggestions = useCallback(async () => {
    if (!scriptText || !enabled || !autoSuggestEnabled) return;

    // Check cache
    const cacheKey = `${sceneId}:${scriptText.slice(0, 100)}`;
    const cachedTime = fetchCache.get(cacheKey);
    if (cachedTime && Date.now() - cachedTime < CACHE_DURATION) {
      return;
    }

    setLoadingSuggestions(sceneId, true);

    try {
      const response = await fetch("/api/ai/suggestions/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          projectId,
          scriptText,
          existingElements: existingElements.map((e) => ({
            category: e.category,
            name: e.name,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const { data } = await response.json();
      setSuggestions(sceneId, data || []);
      fetchCache.set(cacheKey, Date.now());
    } catch (error) {
      console.error("Error fetching element suggestions:", error);
      setSuggestions(sceneId, []);
    } finally {
      setLoadingSuggestions(sceneId, false);
    }
  }, [
    sceneId,
    projectId,
    scriptText,
    existingElements,
    enabled,
    autoSuggestEnabled,
    setSuggestions,
    setLoadingSuggestions,
  ]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (
      autoFetch &&
      enabled &&
      autoSuggestEnabled &&
      scriptText &&
      !hasFetchedRef.current &&
      suggestions.length === 0 &&
      !isLoading
    ) {
      hasFetchedRef.current = true;
      fetchSuggestions();
    }
  }, [autoFetch, enabled, autoSuggestEnabled, scriptText, suggestions.length, isLoading, fetchSuggestions]);

  const acceptSuggestion = useCallback(
    (suggestionId: string) => {
      storeAcceptSuggestion(sceneId, suggestionId);
    },
    [sceneId, storeAcceptSuggestion]
  );

  const dismissSuggestion = useCallback(
    (suggestionId: string) => {
      storeDismissSuggestion(sceneId, suggestionId);
    },
    [sceneId, storeDismissSuggestion]
  );

  const getSuggestionsForCategory = useCallback(
    (category: ElementCategory) => {
      return pendingSuggestions.filter((s) => s.category === category);
    },
    [pendingSuggestions]
  );

  return {
    suggestions,
    pendingSuggestions,
    isLoading,
    fetchSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    getSuggestionsForCategory,
  };
}
