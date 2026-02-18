"use client";

import * as React from "react";
import { Box, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  deleteElement,
  type Element,
} from "@/lib/actions/elements";
import { ELEMENT_CATEGORY_LABELS } from "@/lib/constants/elements";

interface ElementsSectionProps {
  projectId: string;
  elements: Element[];
  onRefresh?: () => void;
}

export function ElementsSection({
  projectId,
  elements,
  onRefresh,
}: ElementsSectionProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [localElements, setLocalElements] = React.useState<Element[]>(elements);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalElements(elements);
  }, [elements]);

  const categories = React.useMemo(
    () => Array.from(new Set(localElements.map((e) => e.category))).sort(),
    [localElements]
  );

  const filteredElements = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return localElements.filter((element) => {
      if (categoryFilter !== "all" && element.category !== categoryFilter) {
        return false;
      }
      if (!query) return true;
      return (
        element.name.toLowerCase().includes(query) ||
        (element.description || "").toLowerCase().includes(query)
      );
    });
  }, [localElements, searchQuery, categoryFilter]);

  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, Element[]>();
    for (const element of filteredElements) {
      const list = byCategory.get(element.category) || [];
      list.push(element);
      byCategory.set(element.category, list);
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [filteredElements]);

  const handleDelete = async (elementId: string) => {
    if (!confirm("Delete this element?")) return;
    setDeletingId(elementId);
    const { error } = await deleteElement(elementId, projectId);
    if (!error) {
      setLocalElements((prev) => prev.filter((element) => element.id !== elementId));
      onRefresh?.();
    }
    setDeletingId(null);
  };

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories.map((category) => ({
      value: category,
      label: ELEMENT_CATEGORY_LABELS[category as keyof typeof ELEMENT_CATEGORY_LABELS] || category,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {localElements.length} element{localElements.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
            placeholder="Search elements..."
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            options={categoryOptions}
          />
        </div>
      </div>

      {grouped.length > 0 ? (
        <div className="space-y-3">
          {grouped.map(([category, items]) => (
            <div key={category} className="rounded-lg border border-border">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {ELEMENT_CATEGORY_LABELS[category as keyof typeof ELEMENT_CATEGORY_LABELS] || category}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
              </div>
              <div className="divide-y divide-border">
                {items.map((element) => (
                  <div key={element.id} className="flex items-center gap-3 px-4 py-3">
                    <Box className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{element.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {element.scenes && element.scenes.length > 0 ? (
                          element.scenes
                            .sort((a, b) => {
                              const aNum = parseInt(a.sceneNumber);
                              const bNum = parseInt(b.sceneNumber);
                              if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                              return a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
                            })
                            .map((s) => (
                              <Badge
                                key={s.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 font-mono"
                              >
                                Sc {s.sceneNumber}
                              </Badge>
                            ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No scenes</span>
                        )}
                        {element.description && (
                          <span className="text-xs text-muted-foreground">
                            {element.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDelete(element.id)}
                      disabled={deletingId === element.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <Box className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 font-medium">No elements found</h3>
          <p className="text-sm text-muted-foreground">
            Upload and analyze a script to generate props, wardrobe, and other elements.
          </p>
        </div>
      )}
    </div>
  );
}
