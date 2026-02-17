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
  Sparkles,
  Cog,
  Monitor,
  MapPin,
  Shield,
  Lock,
  HelpCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
  X,
  Search,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Element } from "@/lib/actions/elements";
import type { ElementCategory } from "@/lib/constants/elements";
import type { CastMember } from "@/lib/actions/cast";

// Category configuration with icons and colors
const BREAKDOWN_CATEGORIES: {
  category: ElementCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  column: "left" | "right";
}[] = [
  // Left column - Production departments
  { category: "NAME", label: "Names", icon: <Tag className="h-4 w-4" />, color: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-200", column: "left" },
  { category: "BACKGROUND", label: "Background", icon: <Users className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-700 border-amber-200", column: "left" },
  { category: "PROP", label: "Props", icon: <Package className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-700 border-blue-200", column: "left" },
  { category: "VEHICLE", label: "Vehicles", icon: <Car className="h-4 w-4" />, color: "bg-slate-500/10 text-slate-700 border-slate-200", column: "left" },
  { category: "WARDROBE", label: "Wardrobe", icon: <Shirt className="h-4 w-4" />, color: "bg-pink-500/10 text-pink-700 border-pink-200", column: "left" },
  { category: "MAKEUP", label: "Makeup/Hair", icon: <Palette className="h-4 w-4" />, color: "bg-rose-500/10 text-rose-700 border-rose-200", column: "left" },
  { category: "CAMERA", label: "Camera", icon: <Camera className="h-4 w-4" />, color: "bg-indigo-500/10 text-indigo-700 border-indigo-200", column: "left" },
  { category: "GRIP", label: "Grip", icon: <Wrench className="h-4 w-4" />, color: "bg-gray-500/10 text-gray-700 border-gray-200", column: "left" },
  { category: "ELECTRIC", label: "Electric", icon: <Lightbulb className="h-4 w-4" />, color: "bg-yellow-500/10 text-yellow-700 border-yellow-200", column: "left" },
  { category: "SOUND", label: "Sound", icon: <Volume2 className="h-4 w-4" />, color: "bg-cyan-500/10 text-cyan-700 border-cyan-200", column: "left" },
  { category: "STUNT", label: "Stunts", icon: <Zap className="h-4 w-4" />, color: "bg-red-500/10 text-red-700 border-red-200", column: "left" },
  { category: "SFX", label: "Special Effects", icon: <Sparkles className="h-4 w-4" />, color: "bg-orange-500/10 text-orange-700 border-orange-200", column: "left" },
  // Right column
  { category: "SET_DRESSING", label: "Set Dressing", icon: <Sofa className="h-4 w-4" />, color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", column: "right" },
  { category: "GREENERY", label: "Greenery", icon: <TreePine className="h-4 w-4" />, color: "bg-green-500/10 text-green-700 border-green-200", column: "right" },
  { category: "SPECIAL_EQUIPMENT", label: "Special Equipment", icon: <Wrench className="h-4 w-4" />, color: "bg-zinc-500/10 text-zinc-700 border-zinc-200", column: "right" },
  { category: "ADDITIONAL_LABOR", label: "Additional Labor", icon: <HardHat className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-700 border-amber-200", column: "right" },
  { category: "ANIMAL", label: "Animals", icon: <Dog className="h-4 w-4" />, color: "bg-lime-500/10 text-lime-700 border-lime-200", column: "right" },
  { category: "VFX", label: "Visual Effects", icon: <Sparkles className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-700 border-purple-200", column: "right" },
  { category: "MUSIC", label: "Music", icon: <Music className="h-4 w-4" />, color: "bg-violet-500/10 text-violet-700 border-violet-200", column: "right" },
  { category: "ART_DEPARTMENT", label: "Art Department", icon: <Paintbrush className="h-4 w-4" />, color: "bg-teal-500/10 text-teal-700 border-teal-200", column: "right" },
  { category: "MECHANICAL_EFFECTS", label: "Mechanical FX", icon: <Cog className="h-4 w-4" />, color: "bg-stone-500/10 text-stone-700 border-stone-200", column: "right" },
  { category: "VIDEO_PLAYBACK", label: "Video Playback", icon: <Monitor className="h-4 w-4" />, color: "bg-sky-500/10 text-sky-700 border-sky-200", column: "right" },
  { category: "MISCELLANEOUS", label: "Miscellaneous", icon: <MoreHorizontal className="h-4 w-4" />, color: "bg-neutral-500/10 text-neutral-700 border-neutral-200", column: "right" },
];

interface PendingElement {
  elementId: string;
  quantity: number;
  notes: string | null;
  element: Element;
}

interface CreateSceneBreakdownEditorProps {
  projectId: string;
  cast: CastMember[];
  elements: Element[];
  pendingElements: PendingElement[];
  pendingCastIds: string[];
  onAddElement: (element: Element, quantity?: number) => void;
  onRemoveElement: (elementId: string) => void;
  onAddCast: (castId: string) => void;
  onRemoveCast: (castId: string) => void;
  onCreateElement: (category: string, name: string) => Promise<Element | null>;
}

export function CreateSceneBreakdownEditor({
  projectId,
  cast,
  elements,
  pendingElements,
  pendingCastIds,
  onAddElement,
  onRemoveElement,
  onAddCast,
  onRemoveCast,
  onCreateElement,
}: CreateSceneBreakdownEditorProps) {
  const leftCategories = BREAKDOWN_CATEGORIES.filter((c) => c.column === "left");
  const rightCategories = BREAKDOWN_CATEGORIES.filter((c) => c.column === "right");

  // Group pending elements by category
  const elementsByCategory = React.useMemo(() => {
    const grouped = new Map<ElementCategory, PendingElement[]>();
    pendingElements.forEach((item) => {
      const category = item.element.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(item);
    });
    return grouped;
  }, [pendingElements]);

  return (
    <div className="space-y-6">
      {/* Cast Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 text-blue-700 font-medium text-sm border-b border-blue-200">
          <User className="h-4 w-4" />
          <span>Cast Members</span>
          {pendingCastIds.length > 0 && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {pendingCastIds.length}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3 bg-background">
          {/* Selected cast */}
          {pendingCastIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingCastIds.map((castId) => {
                const member = cast.find((c) => c.id === castId);
                if (!member) return null;
                return (
                  <div
                    key={castId}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>{member.characterName}</span>
                    {member.actorName && (
                      <span className="text-blue-500">({member.actorName})</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveCast(castId)}
                      className="ml-1 p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add cast dropdown */}
          <CastSelector
            cast={cast}
            selectedIds={pendingCastIds}
            onSelect={onAddCast}
          />
        </div>
      </div>

      {/* Elements Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-3">
          {leftCategories.map((cat) => (
            <CategorySection
              key={cat.category}
              category={cat.category}
              label={cat.label}
              icon={cat.icon}
              color={cat.color}
              items={elementsByCategory.get(cat.category) || []}
              availableElements={elements.filter((e) => e.category === cat.category)}
              onAdd={onAddElement}
              onRemove={onRemoveElement}
              onCreate={onCreateElement}
            />
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {rightCategories.map((cat) => (
            <CategorySection
              key={cat.category}
              category={cat.category}
              label={cat.label}
              icon={cat.icon}
              color={cat.color}
              items={elementsByCategory.get(cat.category) || []}
              availableElements={elements.filter((e) => e.category === cat.category)}
              onAdd={onAddElement}
              onRemove={onRemoveElement}
              onCreate={onCreateElement}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Category section component
interface CategorySectionProps {
  category: ElementCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  items: PendingElement[];
  availableElements: Element[];
  onAdd: (element: Element, quantity?: number) => void;
  onRemove: (elementId: string) => void;
  onCreate: (category: string, name: string) => Promise<Element | null>;
}

function CategorySection({
  category,
  label,
  icon,
  color,
  items,
  availableElements,
  onAdd,
  onRemove,
  onCreate,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Filter available elements
  const filteredElements = React.useMemo(() => {
    const selectedIds = new Set(items.map((i) => i.elementId));
    return availableElements
      .filter((e) => !selectedIds.has(e.id))
      .filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 8);
  }, [availableElements, items, searchQuery]);

  // Close on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsAdding(false);
        setSearchQuery("");
      }
    }
    if (isAdding) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isAdding]);

  const handleCreate = async () => {
    if (!searchQuery.trim()) return;
    const newElement = await onCreate(category, searchQuery.trim());
    if (newElement) {
      onAdd(newElement, 1);
      setSearchQuery("");
      setIsAdding(false);
    }
  };

  const handleSelect = (element: Element) => {
    onAdd(element, 1);
    setSearchQuery("");
    setIsAdding(false);
  };

  return (
    <div className={cn("border rounded-lg overflow-hidden", color.includes("border") ? "" : "border-border")}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-sm font-medium transition-colors",
          color
        )}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {items.length > 0 && (
          <span className="text-xs bg-current/20 px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        )}
        <svg
          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-3 bg-background space-y-2" ref={containerRef}>
          {/* Selected items */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <div
                  key={item.elementId}
                  className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-sm group"
                >
                  <span>{item.element.name}</span>
                  {item.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(item.elementId)}
                    className="ml-1 p-0.5 opacity-50 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add element */}
          {isAdding ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsAdding(false);
                      setSearchQuery("");
                    } else if (e.key === "Enter" && filteredElements.length > 0) {
                      e.preventDefault();
                      handleSelect(filteredElements[0]);
                    } else if (e.key === "Enter" && searchQuery.trim() && filteredElements.length === 0) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder={`Search or create ${label.toLowerCase()}...`}
                  className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Dropdown results */}
              {(filteredElements.length > 0 || searchQuery.trim()) && (
                <div className="border border-border rounded-md bg-popover shadow-sm max-h-40 overflow-auto">
                  {filteredElements.map((element) => (
                    <button
                      key={element.id}
                      type="button"
                      onClick={() => handleSelect(element)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-muted/50"
                    >
                      {element.name}
                    </button>
                  ))}
                  {searchQuery.trim() && filteredElements.length === 0 && (
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-muted/50 text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Create &quot;{searchQuery}&quot;
                    </button>
                  )}
                  {searchQuery.trim() && filteredElements.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-muted/50 text-primary border-t border-border"
                    >
                      <Plus className="h-4 w-4" />
                      Create &quot;{searchQuery}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add {label.toLowerCase()}...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Cast selector component
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
        <Plus className="h-3.5 w-3.5" />
        Add cast member...
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
