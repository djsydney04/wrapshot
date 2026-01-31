"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Search,
  Loader2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ElementCategory, Element } from "@/lib/actions/elements";

export interface SceneElementItem {
  id: string;
  elementId: string;
  quantity: number;
  notes: string | null;
  element: Element;
}

interface BreakdownCategoryProps {
  category: ElementCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  items: SceneElementItem[];
  availableElements: Element[];
  onAdd: (elementId: string, quantity: number, notes?: string) => void;
  onRemove: (elementId: string) => void;
  onCreateNew: (name: string, notes?: string) => Promise<Element | null>;
  onUpdateQuantity?: (elementId: string, quantity: number) => void;
  defaultExpanded?: boolean;
}

export function BreakdownCategory({
  category,
  label,
  icon,
  color,
  items,
  availableElements,
  onAdd,
  onRemove,
  onCreateNew,
  onUpdateQuantity,
  defaultExpanded = false,
}: BreakdownCategoryProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded || items.length > 0);
  const [isAdding, setIsAdding] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Filter available elements (not already in scene and matching search)
  const filteredElements = React.useMemo(() => {
    const inSceneIds = new Set(items.map((item) => item.elementId));
    return availableElements
      .filter((el) => el.category === category && !inSceneIds.has(el.id))
      .filter((el) =>
        el.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 10);
  }, [availableElements, items, category, searchQuery]);

  // Check if we should show "Create new" option
  const showCreateOption =
    searchQuery.trim().length > 0 &&
    !filteredElements.some(
      (el) => el.name.toLowerCase() === searchQuery.toLowerCase()
    );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsAdding(false);
        setSearchQuery("");
      }
    }

    if (isAdding) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isAdding]);

  // Focus input when adding starts
  React.useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSelectElement = (element: Element) => {
    onAdd(element.id, 1);
    setIsAdding(false);
    setSearchQuery("");
  };

  const handleCreateNew = async () => {
    if (!searchQuery.trim()) return;

    setIsCreating(true);
    try {
      const newElement = await onCreateNew(searchQuery.trim());
      if (newElement) {
        onAdd(newElement.id, 1);
      }
    } finally {
      setIsCreating(false);
      setIsAdding(false);
      setSearchQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsAdding(false);
      setSearchQuery("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredElements.length > 0) {
        handleSelectElement(filteredElements[0]);
      } else if (showCreateOption) {
        handleCreateNew();
      }
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium",
          "hover:bg-muted/50 transition-colors",
          color
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2 bg-background">
          {/* Existing items */}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 text-sm group"
            >
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{item.element.name}</span>
              {onUpdateQuantity && item.quantity > 1 && (
                <span className="text-xs text-muted-foreground">
                  x{item.quantity}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.elementId)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded transition-opacity"
              >
                <X className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          ))}

          {/* Add new item */}
          <div className="relative">
            {isAdding ? (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or create..."
                  className="h-8 pl-7 pr-2 text-sm"
                />

                {/* Dropdown */}
                {(filteredElements.length > 0 || showCreateOption) && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-lg"
                  >
                    <ul className="py-1">
                      {filteredElements.map((element) => (
                        <li key={element.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectElement(element)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50"
                          >
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{element.name}</span>
                          </button>
                        </li>
                      ))}

                      {showCreateOption && (
                        <>
                          {filteredElements.length > 0 && (
                            <li className="border-t border-border my-1" />
                          )}
                          <li>
                            <button
                              type="button"
                              onClick={handleCreateNew}
                              disabled={isCreating}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50 text-primary"
                            >
                              {isCreating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              <span>Create &quot;{searchQuery}&quot;</span>
                            </button>
                          </li>
                        </>
                      )}
                    </ul>
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
                Add item...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
