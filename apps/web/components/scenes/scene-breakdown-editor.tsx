"use client";

import * as React from "react";
import {
  User,
  Users,
  Package,
  Car,
  Shirt,
  Palette,
  Camera,
  Lightbulb,
  Volume2,
  Music,
  Zap,
  Paintbrush,
  Sofa,
  TreePine,
  Wrench,
  HardHat,
  Dog,
  Cog,
  Monitor,
  MapPin,
  Shield,
  Lock,
  HelpCircle,
  MessageSquare,
  MoreHorizontal,
  Loader2,
  Save,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BreakdownCategory, type SceneElementItem } from "./breakdown-category";
import { MentionInput, type Mention, type MentionSearchResult } from "@/components/ui/mention-input";
import {
  type Scene,
  type BreakdownStatus,
  updateSceneBreakdown,
} from "@/lib/actions/scenes";
import {
  type Element,
  quickCreateElement,
  assignElementToScene,
  removeElementFromScene,
} from "@/lib/actions/elements";
import type { ElementCategory } from "@/lib/constants/elements";
import { ELEMENT_CATEGORY_LABELS } from "@/lib/constants/elements";
import { addCastToScene, removeCastFromScene } from "@/lib/actions/scenes";
import type { CastMember } from "@/lib/actions/cast";
import type { Location } from "@/lib/actions/locations";
import { useElementSuggestions } from "@/lib/hooks/use-element-suggestions";
import { useAIStore, type ElementSuggestion } from "@/lib/stores/ai-store";

// Category configuration with icons and colors
const BREAKDOWN_CATEGORIES: {
  category: ElementCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  column: "left" | "right";
}[] = [
  // Left column
  { category: "NAME", label: "Names", icon: <Tag className="h-4 w-4" />, color: "bg-fuchsia-500/10 text-fuchsia-700", column: "left" },
  { category: "BACKGROUND", label: "Background", icon: <Users className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-700", column: "left" },
  { category: "PROP", label: "Props", icon: <Package className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-700", column: "left" },
  { category: "VEHICLE", label: "Vehicles", icon: <Car className="h-4 w-4" />, color: "bg-slate-500/10 text-slate-700", column: "left" },
  { category: "WARDROBE", label: "Wardrobe", icon: <Shirt className="h-4 w-4" />, color: "bg-pink-500/10 text-pink-700", column: "left" },
  { category: "MAKEUP", label: "Makeup/Hair", icon: <Palette className="h-4 w-4" />, color: "bg-rose-500/10 text-rose-700", column: "left" },
  { category: "CAMERA", label: "Camera", icon: <Camera className="h-4 w-4" />, color: "bg-indigo-500/10 text-indigo-700", column: "left" },
  { category: "GRIP", label: "Grip", icon: <Wrench className="h-4 w-4" />, color: "bg-gray-500/10 text-gray-700", column: "left" },
  { category: "ELECTRIC", label: "Electric", icon: <Lightbulb className="h-4 w-4" />, color: "bg-yellow-500/10 text-yellow-700", column: "left" },
  { category: "SOUND", label: "Sound", icon: <Volume2 className="h-4 w-4" />, color: "bg-cyan-500/10 text-cyan-700", column: "left" },
  { category: "MUSIC", label: "Music", icon: <Music className="h-4 w-4" />, color: "bg-violet-500/10 text-violet-700", column: "left" },
  { category: "STUNT", label: "Stunts", icon: <Zap className="h-4 w-4" />, color: "bg-red-500/10 text-red-700", column: "left" },
  { category: "SFX", label: "Special Effects", icon: <Lightbulb className="h-4 w-4" />, color: "bg-orange-500/10 text-orange-700", column: "left" },
  { category: "ART_DEPARTMENT", label: "Art Department", icon: <Paintbrush className="h-4 w-4" />, color: "bg-teal-500/10 text-teal-700", column: "left" },
  // Right column
  { category: "SET_DRESSING", label: "Set Dressing", icon: <Sofa className="h-4 w-4" />, color: "bg-emerald-500/10 text-emerald-700", column: "right" },
  { category: "GREENERY", label: "Greenery", icon: <TreePine className="h-4 w-4" />, color: "bg-green-500/10 text-green-700", column: "right" },
  { category: "SPECIAL_EQUIPMENT", label: "Special Equipment", icon: <Wrench className="h-4 w-4" />, color: "bg-zinc-500/10 text-zinc-700", column: "right" },
  { category: "ADDITIONAL_LABOR", label: "Additional Labor", icon: <HardHat className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-700", column: "right" },
  { category: "ANIMAL", label: "Animals", icon: <Dog className="h-4 w-4" />, color: "bg-lime-500/10 text-lime-700", column: "right" },
  { category: "ANIMAL_WRANGLER", label: "Animal Wrangler", icon: <Dog className="h-4 w-4" />, color: "bg-lime-600/10 text-lime-800", column: "right" },
  { category: "VFX", label: "Visual Effects", icon: <Lightbulb className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-700", column: "right" },
  { category: "MECHANICAL_EFFECTS", label: "Mechanical Effects", icon: <Cog className="h-4 w-4" />, color: "bg-stone-500/10 text-stone-700", column: "right" },
  { category: "VIDEO_PLAYBACK", label: "Video Playback", icon: <Monitor className="h-4 w-4" />, color: "bg-sky-500/10 text-sky-700", column: "right" },
  { category: "LOCATION_NOTES", label: "Location Notes", icon: <MapPin className="h-4 w-4" />, color: "bg-emerald-600/10 text-emerald-800", column: "right" },
  { category: "SAFETY_NOTES", label: "Safety Notes", icon: <Shield className="h-4 w-4" />, color: "bg-red-600/10 text-red-800", column: "right" },
  { category: "SECURITY", label: "Security", icon: <Lock className="h-4 w-4" />, color: "bg-slate-600/10 text-slate-800", column: "right" },
  { category: "QUESTIONS", label: "Questions", icon: <HelpCircle className="h-4 w-4" />, color: "bg-blue-600/10 text-blue-800", column: "right" },
  { category: "COMMENTS", label: "Comments", icon: <MessageSquare className="h-4 w-4" />, color: "bg-gray-600/10 text-gray-800", column: "right" },
  { category: "MISCELLANEOUS", label: "Miscellaneous", icon: <MoreHorizontal className="h-4 w-4" />, color: "bg-neutral-500/10 text-neutral-700", column: "right" },
];

interface SceneBreakdownEditorProps {
  scene: Scene;
  projectId: string;
  cast: CastMember[];
  elements: Element[];
  sceneElements: SceneElementItem[];
  locations: Location[];
  onUpdate?: () => void;
}

export function SceneBreakdownEditor({
  scene,
  projectId,
  cast,
  elements,
  sceneElements: initialSceneElements,
  locations,
  onUpdate,
}: SceneBreakdownEditorProps) {
  const [sceneElements, setSceneElements] = React.useState<SceneElementItem[]>(initialSceneElements);
  const [sceneCast, setSceneCast] = React.useState<string[]>(
    scene.cast?.map((c) => c.castMemberId) || []
  );
  const [notes, setNotes] = React.useState(scene.notes || "");
  const [mentions, setMentions] = React.useState<Mention[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Smart element suggestions
  const {
    getSuggestionsForCategory,
    acceptSuggestion,
    dismissSuggestion,
  } = useElementSuggestions({
    sceneId: scene.id,
    projectId,
    scriptText: scene.scriptText || scene.synopsis || "",
    existingElements: sceneElements.map((se) => ({
      category: se.element.category,
      name: se.element.name,
    })),
    autoFetch: true,
  });

  // Handle accepting a Smart suggestion
  const handleAcceptSuggestion = async (suggestion: ElementSuggestion) => {
    // Create the element if it doesn't exist
    const newElement = await handleCreateElement(suggestion.category, suggestion.name);
    if (newElement) {
      await handleAddElement(suggestion.category, newElement.id, 1);
      acceptSuggestion(suggestion.id);
    }
  };

  // Track changes
  React.useEffect(() => {
    const initialCastIds = scene.cast?.map((c) => c.castMemberId) || [];
    const castChanged = JSON.stringify(sceneCast.sort()) !== JSON.stringify(initialCastIds.sort());
    const notesChanged = notes !== (scene.notes || "");
    const elementsChanged = JSON.stringify(sceneElements.map(e => e.elementId).sort()) !==
      JSON.stringify(initialSceneElements.map(e => e.elementId).sort());

    setHasChanges(castChanged || notesChanged || elementsChanged);
  }, [sceneCast, notes, sceneElements, scene, initialSceneElements]);

  // Search function for @-mentions
  const handleMentionSearch = React.useCallback(
    async (query: string): Promise<MentionSearchResult[]> => {
      const results: MentionSearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      // Search cast
      cast
        .filter(
          (c) =>
            c.characterName.toLowerCase().includes(lowerQuery) ||
            (c.actorName && c.actorName.toLowerCase().includes(lowerQuery))
        )
        .slice(0, 3)
        .forEach((c) => {
          results.push({
            type: "cast",
            id: c.id,
            name: c.characterName,
            subtitle: c.actorName || undefined,
          });
        });

      // Search elements
      elements
        .filter((e) => e.name.toLowerCase().includes(lowerQuery))
        .slice(0, 3)
        .forEach((e) => {
          results.push({
            type: "element",
            id: e.id,
            name: e.name,
            subtitle: ELEMENT_CATEGORY_LABELS[e.category],
          });
        });

      // Search locations
      locations
        .filter((l) => l.name.toLowerCase().includes(lowerQuery))
        .slice(0, 2)
        .forEach((l) => {
          results.push({
            type: "location",
            id: l.id,
            name: l.name,
            subtitle: l.address || undefined,
          });
        });

      return results;
    },
    [cast, elements, locations]
  );

  // Handle adding element to scene
  const handleAddElement = async (category: ElementCategory, elementId: string, quantity: number) => {
    const element = elements.find((e) => e.id === elementId);
    if (!element) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    setSceneElements((prev) => [
      ...prev,
      {
        id: tempId,
        elementId,
        quantity,
        notes: null,
        element,
      },
    ]);

    // Persist to server
    const { error } = await assignElementToScene(elementId, scene.id, quantity);
    if (error) {
      // Rollback on error
      setSceneElements((prev) => prev.filter((e) => e.id !== tempId));
      console.error("Failed to add element:", error);
    }
  };

  // Handle removing element from scene
  const handleRemoveElement = async (elementId: string) => {
    const removed = sceneElements.find((e) => e.elementId === elementId);

    // Optimistic update
    setSceneElements((prev) => prev.filter((e) => e.elementId !== elementId));

    // Persist to server
    const { error } = await removeElementFromScene(elementId, scene.id);
    if (error && removed) {
      // Rollback on error
      setSceneElements((prev) => [...prev, removed]);
      console.error("Failed to remove element:", error);
    }
  };

  // Handle creating new element
  const handleCreateElement = async (category: ElementCategory, name: string): Promise<Element | null> => {
    const { data, error } = await quickCreateElement(projectId, category, name);
    if (error || !data) {
      console.error("Failed to create element:", error);
      return null;
    }
    return data;
  };

  // Handle adding cast to scene
  const handleAddCast = async (castMemberId: string) => {
    if (sceneCast.includes(castMemberId)) return;

    // Optimistic update
    setSceneCast((prev) => [...prev, castMemberId]);

    // Persist to server
    const { error } = await addCastToScene(scene.id, castMemberId, projectId);
    if (error) {
      // Rollback on error
      setSceneCast((prev) => prev.filter((id) => id !== castMemberId));
      console.error("Failed to add cast:", error);
    }
  };

  // Handle removing cast from scene
  const handleRemoveCast = async (castMemberId: string) => {
    // Optimistic update
    setSceneCast((prev) => prev.filter((id) => id !== castMemberId));

    // Persist to server
    const { error } = await removeCastFromScene(scene.id, castMemberId, projectId);
    if (error) {
      // Rollback on error
      setSceneCast((prev) => [...prev, castMemberId]);
      console.error("Failed to remove cast:", error);
    }
  };

  // Save breakdown
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateSceneBreakdown(scene.id, projectId, {
        notes,
        breakdownStatus: "IN_PROGRESS" as BreakdownStatus,
      });

      if (error) {
        console.error("Failed to save breakdown:", error);
      } else {
        setHasChanges(false);
        onUpdate?.();
      }
    } finally {
      setSaving(false);
    }
  };

  // Group elements by category
  const elementsByCategory = React.useMemo(() => {
    const grouped = new Map<ElementCategory, SceneElementItem[]>();
    sceneElements.forEach((item) => {
      const category = item.element.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(item);
    });
    return grouped;
  }, [sceneElements]);

  const leftCategories = BREAKDOWN_CATEGORIES.filter((c) => c.column === "left");
  const rightCategories = BREAKDOWN_CATEGORIES.filter((c) => c.column === "right");

  return (
    <div className="space-y-6">
      {/* Cast Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 text-blue-700 font-medium text-sm border-b border-blue-200">
          <User className="h-4 w-4" />
          <span>Cast Members</span>
          {sceneCast.length > 0 && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {sceneCast.length}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3 bg-background">
          {/* Selected cast */}
          {sceneCast.map((castId) => {
            const member = cast.find((c) => c.id === castId);
            if (!member) return null;
            return (
              <div key={castId} className="flex items-center gap-2 text-sm group">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1">
                  {member.characterName}
                  {member.actorName && (
                    <span className="text-muted-foreground"> ({member.actorName})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCast(castId)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded transition-opacity"
                >
                  <span className="sr-only">Remove</span>
                  <svg className="h-3.5 w-3.5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Add cast dropdown */}
          <CastSelector
            cast={cast}
            selectedIds={sceneCast}
            onSelect={handleAddCast}
          />
        </div>
      </div>

      {/* Two-column grid for categories */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-3">
          {leftCategories.map((cat) => (
            <BreakdownCategory
              key={cat.category}
              category={cat.category}
              label={cat.label}
              icon={cat.icon}
              color={cat.color}
              items={elementsByCategory.get(cat.category) || []}
              availableElements={elements}
              onAdd={(elementId, quantity) => handleAddElement(cat.category, elementId, quantity)}
              onRemove={handleRemoveElement}
              onCreateNew={(name) => handleCreateElement(cat.category, name)}
              suggestions={getSuggestionsForCategory(cat.category)}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={dismissSuggestion}
            />
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {rightCategories.map((cat) => (
            <BreakdownCategory
              key={cat.category}
              category={cat.category}
              label={cat.label}
              icon={cat.icon}
              color={cat.color}
              items={elementsByCategory.get(cat.category) || []}
              availableElements={elements}
              onAdd={(elementId, quantity) => handleAddElement(cat.category, elementId, quantity)}
              onRemove={handleRemoveElement}
              onCreateNew={(name) => handleCreateElement(cat.category, name)}
              suggestions={getSuggestionsForCategory(cat.category)}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={dismissSuggestion}
            />
          ))}
        </div>
      </div>

      {/* Notes section with @-mentions */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 font-medium text-sm border-b border-border">
          <MessageSquare className="h-4 w-4" />
          <span>Notes</span>
        </div>
        <div className="p-4 bg-background">
          <MentionInput
            value={notes}
            mentions={mentions}
            onChange={(value, newMentions) => {
              setNotes(value);
              setMentions(newMentions);
            }}
            onSearch={handleMentionSearch}
            placeholder="Add notes... Type @ to mention cast, elements, or locations"
            rows={4}
          />
        </div>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Cast selector sub-component
interface CastSelectorProps {
  cast: CastMember[];
  selectedIds: string[];
  onSelect: (id: string) => void;
}

function CastSelector({ cast, selectedIds, onSelect }: CastSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const availableCast = React.useMemo(() => {
    return cast
      .filter((c) => !selectedIds.includes(c.id))
      .filter(
        (c) =>
          c.characterName.toLowerCase().includes(query.toLowerCase()) ||
          (c.actorName && c.actorName.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 10);
  }, [cast, selectedIds, query]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (castMember: CastMember) => {
    onSelect(castMember.id);
    setIsOpen(false);
    setQuery("");
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add cast...
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              setQuery("");
            } else if (e.key === "Enter" && availableCast.length > 0) {
              e.preventDefault();
              handleSelect(availableCast[0]);
            }
          }}
          placeholder="Search cast..."
          className={cn(
            "w-full h-8 rounded-md border border-input bg-background pl-7 pr-2 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          )}
        />
      </div>

      {availableCast.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          <ul className="py-1">
            {availableCast.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(member)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">
                    {member.characterName}
                    {member.actorName && (
                      <span className="text-muted-foreground"> ({member.actorName})</span>
                    )}
                  </span>
                  {member.castNumber && (
                    <span className="text-xs text-muted-foreground">#{member.castNumber}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {query && availableCast.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg p-3 text-center text-sm text-muted-foreground">
          No cast members found
        </div>
      )}
    </div>
  );
}
