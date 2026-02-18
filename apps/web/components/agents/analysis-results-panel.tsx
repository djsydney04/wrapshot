"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Film,
  Box,
  Users,
  UserPlus,
  AlertTriangle,
  ArrowRight,
  X,
  Pencil,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getScenes, deleteScene, type Scene } from "@/lib/actions/scenes";
import {
  getElementsWithSceneCounts,
  deleteElement,
  type Element,
} from "@/lib/actions/elements";
import {
  getCastMembersWithInviteStatus,
  updateCastMember,
  type CastMemberWithInviteStatus,
} from "@/lib/actions/cast";
import {
  getCrewSuggestions,
  acceptCrewSuggestion,
  dismissCrewSuggestion,
  type CrewSuggestion,
} from "@/lib/actions/crew-suggestions";
import {
  ELEMENT_CATEGORY_LABELS,
  type ElementCategory,
} from "@/lib/constants/elements";
import type { AgentJobResult } from "@/lib/agents/types";
import type { ProjectSection } from "@/components/projects/project-sidebar";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalysisResultsPanelProps {
  projectId: string;
  jobResult: AgentJobResult;
  onNavigate: (section: ProjectSection) => void;
  onDataRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Shared collapsible section wrapper
// ---------------------------------------------------------------------------

function AnalysisSection({
  icon,
  title,
  count,
  navigateLabel,
  onNavigate,
  defaultExpanded = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  navigateLabel: string;
  onNavigate: () => void;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  if (count === 0) return null;

  return (
    <div className="border-t border-border first:border-t-0">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 py-3 text-left hover:bg-muted/30 transition-colors rounded-md px-2 -mx-2"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs ml-1">
          {count}
        </Badge>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
        >
          {navigateLabel}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </button>

      {/* Body */}
      {expanded && <div className="pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Priority styles (reused from crew-suggestion-panel)
// ---------------------------------------------------------------------------

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  PRODUCTION: "Production",
  DIRECTION: "Direction",
  CAMERA: "Camera",
  SOUND: "Sound",
  LIGHTING: "Lighting",
  ART: "Art",
  COSTUME: "Costume",
  HAIR_MAKEUP: "Hair & Makeup",
  LOCATIONS: "Locations",
  STUNTS: "Stunts",
  VFX: "VFX",
  TRANSPORTATION: "Transportation",
  CATERING: "Catering",
  ACCOUNTING: "Accounting",
  POST_PRODUCTION: "Post-Production",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalysisResultsPanel({
  projectId,
  jobResult,
  onNavigate,
  onDataRefresh,
}: AnalysisResultsPanelProps) {
  const [dismissed, setDismissed] = React.useState(false);

  // Data state
  const [scenes, setScenes] = React.useState<Scene[]>([]);
  const [elements, setElements] = React.useState<Element[]>([]);
  const [cast, setCast] = React.useState<CastMemberWithInviteStatus[]>([]);
  const [crewSuggestions, setCrewSuggestions] = React.useState<
    CrewSuggestion[]
  >([]);
  const [loading, setLoading] = React.useState(true);

  // Expand toggles for "show all"
  const [showAllScenes, setShowAllScenes] = React.useState(false);
  const [showAllCast, setShowAllCast] = React.useState(false);

  // Inline edit state
  const [editingSceneId, setEditingSceneId] = React.useState<string | null>(
    null,
  );
  const [editingSynopsis, setEditingSynopsis] = React.useState("");
  const [editingCastId, setEditingCastId] = React.useState<string | null>(null);
  const [editingActorName, setEditingActorName] = React.useState("");

  // Action in progress
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(
    null,
  );

  // Fetch all data on mount
  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [scenesRes, elementsRes, castRes, crewRes] = await Promise.all([
        getScenes(projectId),
        getElementsWithSceneCounts(projectId),
        getCastMembersWithInviteStatus(projectId),
        getCrewSuggestions(projectId),
      ]);
      if (scenesRes.data) setScenes(scenesRes.data);
      if (elementsRes.data) setElements(elementsRes.data);
      if (castRes.data) setCast(castRes.data);
      if (crewRes.data) setCrewSuggestions(crewRes.data);
      setLoading(false);
    }
    loadData();
  }, [projectId]);

  // ---- Handlers ----

  const handleDeleteScene = async (sceneId: string) => {
    setActionInProgress(sceneId);
    const result = await deleteScene(sceneId, projectId);
    if (result.error) {
      toast.error("Failed to delete scene");
    } else {
      setScenes((prev) => prev.filter((s) => s.id !== sceneId));
      onDataRefresh();
    }
    setActionInProgress(null);
  };

  const handleDeleteElement = async (elementId: string) => {
    setActionInProgress(elementId);
    const result = await deleteElement(elementId, projectId);
    if (result.error) {
      toast.error("Failed to delete element");
    } else {
      setElements((prev) => prev.filter((e) => e.id !== elementId));
      onDataRefresh();
    }
    setActionInProgress(null);
  };

  const handleSaveSceneSynopsis = async (sceneId: string) => {
    setActionInProgress(sceneId);
    // We import updateScene dynamically to avoid bloating imports
    const { updateScene } = await import("@/lib/actions/scenes");
    const result = await updateScene(sceneId, { synopsis: editingSynopsis });
    if (result.error) {
      toast.error("Failed to update scene");
    } else {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId ? { ...s, synopsis: editingSynopsis } : s,
        ),
      );
    }
    setEditingSceneId(null);
    setActionInProgress(null);
  };

  const handleSaveActorName = async (castId: string) => {
    setActionInProgress(castId);
    const result = await updateCastMember(castId, {
      actorName: editingActorName,
    });
    if (result.error) {
      toast.error("Failed to update cast member");
    } else {
      setCast((prev) =>
        prev.map((c) =>
          c.id === castId ? { ...c, actorName: editingActorName } : c,
        ),
      );
    }
    setEditingCastId(null);
    setActionInProgress(null);
  };

  const handleAcceptCrewSuggestion = async (suggestion: CrewSuggestion) => {
    setActionInProgress(suggestion.id);
    const result = await acceptCrewSuggestion(suggestion.id, projectId);
    if (result.error) {
      toast.error("Failed to accept suggestion", {
        description: result.error,
      });
    } else {
      toast.success(`Added ${suggestion.role} to crew`);
      setCrewSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      onDataRefresh();
    }
    setActionInProgress(null);
  };

  const handleDismissCrewSuggestion = async (suggestion: CrewSuggestion) => {
    setActionInProgress(suggestion.id);
    const result = await dismissCrewSuggestion(suggestion.id);
    if (result.error) {
      toast.error("Failed to dismiss suggestion");
    } else {
      setCrewSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    }
    setActionInProgress(null);
  };

  // ---- Derived ----

  const elementsByCategory = React.useMemo(() => {
    const grouped = new Map<ElementCategory, Element[]>();
    for (const el of elements) {
      const list = grouped.get(el.category) || [];
      list.push(el);
      grouped.set(el.category, list);
    }
    return grouped;
  }, [elements]);

  const visibleScenes = showAllScenes ? scenes : scenes.slice(0, 5);
  const visibleCast = showAllCast ? cast : cast.slice(0, 5);

  // ---- Collapsed one-liner ----

  if (dismissed) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 flex items-center gap-3">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
        <span className="text-sm text-green-800 dark:text-green-200 flex-1">
          Analysis complete: {jobResult.scenesCreated} scenes,{" "}
          {jobResult.elementsCreated} elements, {jobResult.castCreated} cast.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-green-700 dark:text-green-300"
          onClick={() => setDismissed(false)}
        >
          Review
        </Button>
      </div>
    );
  }

  // ---- Loading ----

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading analysis results...</span>
        </div>
      </div>
    );
  }

  // ---- Full panel ----

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <div>
          <h3 className="font-semibold text-base">Script Analysis Results</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&apos;s what the AI found. Review below, then edit in each
            section.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Sections */}
      <div className="px-4 pb-4 mt-2">
        {/* Scenes */}
        <AnalysisSection
          icon={<Film className="h-4 w-4" />}
          title="Scenes"
          count={scenes.length}
          navigateLabel="Open in Scenes"
          onNavigate={() => onNavigate("scenes")}
          defaultExpanded
        >
          <div className="space-y-1">
            {visibleScenes.map((scene) => (
              <div
                key={scene.id}
                className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted/50 group"
              >
                <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">
                  {scene.sceneNumber}
                </span>
                <Badge
                  variant={scene.intExt === "INT" ? "int" : "ext"}
                  className="text-[10px] shrink-0"
                >
                  {scene.intExt}
                </Badge>
                <span className="truncate flex-1 text-muted-foreground">
                  {scene.setName || scene.location?.name || "—"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {scene.dayNight}
                </span>
                {scene.pageCount > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {scene.pageCount}pg
                  </span>
                )}
                {editingSceneId === scene.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      value={editingSynopsis}
                      onChange={(e) => setEditingSynopsis(e.target.value)}
                      className="h-7 text-xs w-48"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveSceneSynopsis(scene.id);
                        if (e.key === "Escape") setEditingSceneId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleSaveSceneSynopsis(scene.id)}
                      disabled={actionInProgress === scene.id}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingSceneId(scene.id);
                        setEditingSynopsis(scene.synopsis || "");
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteScene(scene.id)}
                      disabled={actionInProgress === scene.id}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {scenes.length > 5 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                onClick={() => setShowAllScenes(!showAllScenes)}
              >
                {showAllScenes
                  ? "Show less"
                  : `Show all ${scenes.length} scenes`}
              </button>
            )}
          </div>
        </AnalysisSection>

        {/* Elements */}
        <AnalysisSection
          icon={<Box className="h-4 w-4" />}
          title="Elements"
          count={elements.length}
          navigateLabel="Open in Elements"
          onNavigate={() => onNavigate("gear")}
        >
          <div className="space-y-2">
            {Array.from(elementsByCategory.entries()).map(
              ([category, items]) => (
                <div key={category}>
                  <span className="text-xs font-medium text-muted-foreground">
                    {ELEMENT_CATEGORY_LABELS[category] || category} ({items.length})
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {items.map((el) => (
                      <Badge
                        key={el.id}
                        variant="secondary"
                        className="text-xs gap-1 group/chip"
                      >
                        {el.name}
                        <button
                          type="button"
                          className="opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5"
                          onClick={() => handleDeleteElement(el.id)}
                          disabled={actionInProgress === el.id}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </AnalysisSection>

        {/* Cast */}
        <AnalysisSection
          icon={<Users className="h-4 w-4" />}
          title="Cast"
          count={cast.length}
          navigateLabel="Open in Cast"
          onNavigate={() => onNavigate("cast")}
        >
          <div className="space-y-1">
            {visibleCast.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted/50 group"
              >
                <span className="font-mono text-xs text-muted-foreground w-6 shrink-0">
                  {member.castNumber || "—"}
                </span>
                <span className="font-medium truncate flex-1">
                  {member.characterName}
                </span>
                {editingCastId === member.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      value={editingActorName}
                      onChange={(e) => setEditingActorName(e.target.value)}
                      className="h-7 text-xs w-40"
                      placeholder="Actor name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveActorName(member.id);
                        if (e.key === "Escape") setEditingCastId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleSaveActorName(member.id)}
                      disabled={actionInProgress === member.id}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground truncate">
                      {member.actorName || "—"}
                    </span>
                    {member.sceneCount != null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {member.sceneCount} scene
                        {member.sceneCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingCastId(member.id);
                          setEditingActorName(member.actorName || "");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {cast.length > 5 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                onClick={() => setShowAllCast(!showAllCast)}
              >
                {showAllCast
                  ? "Show less"
                  : `Show all ${cast.length} cast members`}
              </button>
            )}
          </div>
        </AnalysisSection>

        {/* Crew Suggestions */}
        {crewSuggestions.length > 0 && (
          <AnalysisSection
            icon={<UserPlus className="h-4 w-4" />}
            title="Crew Suggestions"
            count={crewSuggestions.length}
            navigateLabel="Open in Crew"
            onNavigate={() => onNavigate("crew")}
          >
            <div className="space-y-2">
              {crewSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center gap-3 rounded-md bg-muted/30 p-3 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {suggestion.role}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${PRIORITY_STYLES[suggestion.priority as keyof typeof PRIORITY_STYLES] || PRIORITY_STYLES.medium}`}
                      >
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {DEPARTMENT_LABELS[suggestion.department] ||
                        suggestion.department}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {suggestion.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {actionInProgress === suggestion.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                          onClick={() =>
                            handleAcceptCrewSuggestion(suggestion)
                          }
                          title="Accept — add to crew"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() =>
                            handleDismissCrewSuggestion(suggestion)
                          }
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AnalysisSection>
        )}

        {/* Warnings */}
        {jobResult.warnings?.length > 0 && (
          <AnalysisSection
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Warnings"
            count={jobResult.warnings.length}
            navigateLabel="Open in Scenes"
            onNavigate={() => onNavigate("scenes")}
          >
            <div className="space-y-1">
              {jobResult.warnings.map((warning, i) => (
                <p
                  key={i}
                  className="text-xs text-yellow-700 dark:text-yellow-300 px-2 py-1"
                >
                  {warning}
                </p>
              ))}
            </div>
          </AnalysisSection>
        )}
      </div>
    </div>
  );
}
