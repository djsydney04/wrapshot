import { create } from "zustand";
import type { ElementCategory } from "@/lib/constants/elements";

// Types for AI suggestions
export interface ElementSuggestion {
  id: string;
  category: ElementCategory;
  name: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
  sourceText?: string;
  status: "pending" | "accepted" | "dismissed";
}

export interface TimeEstimate {
  hours: number;
  confidence: number; // 0.0 - 1.0
  factors: TimeEstimateFactor[];
  updatedAt: string;
}

export interface TimeEstimateFactor {
  factor: string;
  impact: "increases" | "decreases" | "neutral";
  description: string;
}

export interface SynopsisState {
  text: string;
  isAiGenerated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ScriptChange {
  sceneId: string;
  sceneNumber: string;
  changeType: "added" | "modified" | "deleted";
  oldText?: string;
  newText?: string;
  suggestedUpdates: string[];
}

interface AIStore {
  // Element suggestions by scene ID
  suggestionsByScene: Map<string, ElementSuggestion[]>;
  loadingSuggestions: Set<string>;

  // Time estimates by scene ID
  timeEstimates: Map<string, TimeEstimate>;
  loadingTimeEstimates: Set<string>;

  // Synopsis states by scene ID
  synopsisStates: Map<string, SynopsisState>;

  // Script change detection
  scriptChanges: ScriptChange[];
  hasScriptChanges: boolean;

  // Settings
  autoSuggestEnabled: boolean;

  // Element suggestion actions
  setSuggestions: (sceneId: string, suggestions: ElementSuggestion[]) => void;
  addSuggestion: (sceneId: string, suggestion: ElementSuggestion) => void;
  updateSuggestionStatus: (sceneId: string, suggestionId: string, status: "accepted" | "dismissed") => void;
  dismissSuggestion: (sceneId: string, suggestionId: string) => void;
  acceptSuggestion: (sceneId: string, suggestionId: string) => void;
  setLoadingSuggestions: (sceneId: string, loading: boolean) => void;
  clearSuggestions: (sceneId: string) => void;

  // Time estimate actions
  setTimeEstimate: (sceneId: string, estimate: TimeEstimate) => void;
  setLoadingTimeEstimate: (sceneId: string, loading: boolean) => void;
  clearTimeEstimate: (sceneId: string) => void;

  // Synopsis actions
  setSynopsisState: (sceneId: string, state: Partial<SynopsisState>) => void;
  setSynopsisLoading: (sceneId: string, loading: boolean) => void;
  setSynopsisText: (sceneId: string, text: string, isAiGenerated: boolean) => void;

  // Script change actions
  setScriptChanges: (changes: ScriptChange[]) => void;
  clearScriptChanges: () => void;

  // Settings actions
  setAutoSuggestEnabled: (enabled: boolean) => void;

  // Helpers
  getSuggestionsForScene: (sceneId: string) => ElementSuggestion[];
  getPendingSuggestionsForScene: (sceneId: string) => ElementSuggestion[];
  getTimeEstimateForScene: (sceneId: string) => TimeEstimate | undefined;
  getSynopsisState: (sceneId: string) => SynopsisState | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useAIStore = create<AIStore>((set, get) => ({
  // Initial state
  suggestionsByScene: new Map(),
  loadingSuggestions: new Set(),
  timeEstimates: new Map(),
  loadingTimeEstimates: new Set(),
  synopsisStates: new Map(),
  scriptChanges: [],
  hasScriptChanges: false,
  autoSuggestEnabled: true,

  // Element suggestion actions
  setSuggestions: (sceneId, suggestions) =>
    set((state) => {
      const newMap = new Map(state.suggestionsByScene);
      newMap.set(sceneId, suggestions.map(s => ({ ...s, id: s.id || generateId() })));
      return { suggestionsByScene: newMap };
    }),

  addSuggestion: (sceneId, suggestion) =>
    set((state) => {
      const newMap = new Map(state.suggestionsByScene);
      const existing = newMap.get(sceneId) || [];
      newMap.set(sceneId, [...existing, { ...suggestion, id: suggestion.id || generateId() }]);
      return { suggestionsByScene: newMap };
    }),

  updateSuggestionStatus: (sceneId, suggestionId, status) =>
    set((state) => {
      const newMap = new Map(state.suggestionsByScene);
      const suggestions = newMap.get(sceneId);
      if (suggestions) {
        newMap.set(
          sceneId,
          suggestions.map((s) =>
            s.id === suggestionId ? { ...s, status } : s
          )
        );
      }
      return { suggestionsByScene: newMap };
    }),

  dismissSuggestion: (sceneId, suggestionId) =>
    get().updateSuggestionStatus(sceneId, suggestionId, "dismissed"),

  acceptSuggestion: (sceneId, suggestionId) =>
    get().updateSuggestionStatus(sceneId, suggestionId, "accepted"),

  setLoadingSuggestions: (sceneId, loading) =>
    set((state) => {
      const newSet = new Set(state.loadingSuggestions);
      if (loading) {
        newSet.add(sceneId);
      } else {
        newSet.delete(sceneId);
      }
      return { loadingSuggestions: newSet };
    }),

  clearSuggestions: (sceneId) =>
    set((state) => {
      const newMap = new Map(state.suggestionsByScene);
      newMap.delete(sceneId);
      return { suggestionsByScene: newMap };
    }),

  // Time estimate actions
  setTimeEstimate: (sceneId, estimate) =>
    set((state) => {
      const newMap = new Map(state.timeEstimates);
      newMap.set(sceneId, estimate);
      return { timeEstimates: newMap };
    }),

  setLoadingTimeEstimate: (sceneId, loading) =>
    set((state) => {
      const newSet = new Set(state.loadingTimeEstimates);
      if (loading) {
        newSet.add(sceneId);
      } else {
        newSet.delete(sceneId);
      }
      return { loadingTimeEstimates: newSet };
    }),

  clearTimeEstimate: (sceneId) =>
    set((state) => {
      const newMap = new Map(state.timeEstimates);
      newMap.delete(sceneId);
      return { timeEstimates: newMap };
    }),

  // Synopsis actions
  setSynopsisState: (sceneId, partialState) =>
    set((state) => {
      const newMap = new Map(state.synopsisStates);
      const existing = newMap.get(sceneId) || {
        text: "",
        isAiGenerated: false,
        isLoading: false,
        error: null,
      };
      newMap.set(sceneId, { ...existing, ...partialState });
      return { synopsisStates: newMap };
    }),

  setSynopsisLoading: (sceneId, loading) =>
    get().setSynopsisState(sceneId, { isLoading: loading, error: null }),

  setSynopsisText: (sceneId, text, isAiGenerated) =>
    get().setSynopsisState(sceneId, { text, isAiGenerated, isLoading: false }),

  // Script change actions
  setScriptChanges: (changes) =>
    set({ scriptChanges: changes, hasScriptChanges: changes.length > 0 }),

  clearScriptChanges: () =>
    set({ scriptChanges: [], hasScriptChanges: false }),

  // Settings actions
  setAutoSuggestEnabled: (enabled) =>
    set({ autoSuggestEnabled: enabled }),

  // Helpers
  getSuggestionsForScene: (sceneId) =>
    get().suggestionsByScene.get(sceneId) || [],

  getPendingSuggestionsForScene: (sceneId) =>
    (get().suggestionsByScene.get(sceneId) || []).filter(
      (s) => s.status === "pending"
    ),

  getTimeEstimateForScene: (sceneId) =>
    get().timeEstimates.get(sceneId),

  getSynopsisState: (sceneId) =>
    get().synopsisStates.get(sceneId),
}));
