"use client";

import * as React from "react";
import { Box, Search, Trash2, Pencil, User, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteElement, updateElement, type Element, type ElementTaskType } from "@/lib/actions/elements";
import { getCrewMembers, type CrewMember } from "@/lib/actions/crew";
import { ELEMENT_CATEGORY_LABELS } from "@/lib/constants/elements";

interface ElementsSectionProps {
  projectId: string;
  elements: Element[];
  onRefresh?: () => void;
}

interface EditElementForm {
  name: string;
  description: string;
  comments: string;
  taskType: "" | ElementTaskType;
  assignedToCrewId: string;
}

const TASK_TYPE_LABELS: Record<ElementTaskType, string> = {
  FIND: "Find",
  PICK_UP: "Pick Up",
  SOURCE: "Source",
  PREP: "Prep",
  OTHER: "Other",
};

const TASK_TYPE_OPTIONS = [
  { value: "", label: "No task" },
  { value: "FIND", label: "Find" },
  { value: "PICK_UP", label: "Pick Up" },
  { value: "SOURCE", label: "Source" },
  { value: "PREP", label: "Prep" },
  { value: "OTHER", label: "Other" },
];

const EMPTY_EDIT_FORM: EditElementForm = {
  name: "",
  description: "",
  comments: "",
  taskType: "",
  assignedToCrewId: "",
};

export function ElementsSection({
  projectId,
  elements,
  onRefresh,
}: ElementsSectionProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [localElements, setLocalElements] = React.useState<Element[]>(elements);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [crewMembers, setCrewMembers] = React.useState<CrewMember[]>([]);

  const [editingElement, setEditingElement] = React.useState<Element | null>(null);
  const [editForm, setEditForm] = React.useState<EditElementForm>(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = React.useState(false);

  React.useEffect(() => {
    setLocalElements(elements);
  }, [elements]);

  React.useEffect(() => {
    async function loadCrew() {
      const { data } = await getCrewMembers(projectId);
      setCrewMembers(data || []);
    }

    void loadCrew();
  }, [projectId]);

  const categories = React.useMemo(
    () => Array.from(new Set(localElements.map((e) => e.category))).sort(),
    [localElements]
  );

  const crewNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    crewMembers.forEach((member) => map.set(member.id, member.name));
    return map;
  }, [crewMembers]);

  const filteredElements = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return localElements.filter((element) => {
      if (categoryFilter !== "all" && element.category !== categoryFilter) {
        return false;
      }
      if (!query) return true;
      return (
        element.name.toLowerCase().includes(query) ||
        (element.description || "").toLowerCase().includes(query) ||
        (element.notes || "").toLowerCase().includes(query)
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
      toast.success("Element deleted");
      onRefresh?.();
    } else {
      toast.error(error);
    }
    setDeletingId(null);
  };

  const openEditDialog = (element: Element) => {
    setEditingElement(element);
    setEditForm({
      name: element.name,
      description: element.description || "",
      comments: element.notes || "",
      taskType: element.taskType || "",
      assignedToCrewId: element.assignedToCrewId || "",
    });
  };

  const closeEditDialog = () => {
    setEditingElement(null);
    setEditForm(EMPTY_EDIT_FORM);
    setSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editingElement) return;
    if (!editForm.name.trim()) {
      toast.error("Element name is required");
      return;
    }

    setSavingEdit(true);
    const { data, error } = await updateElement(editingElement.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim() || undefined,
      notes: editForm.comments.trim() || undefined,
      taskType: editForm.taskType || null,
      assignedToCrewId: editForm.assignedToCrewId || null,
    });

    if (error || !data) {
      toast.error(error || "Failed to update element");
      setSavingEdit(false);
      return;
    }

    setLocalElements((prev) =>
      prev.map((element) =>
        element.id === editingElement.id
          ? {
              ...element,
              ...data,
              sceneCount: element.sceneCount,
              scenes: element.scenes,
            }
          : element
      )
    );

    toast.success("Element updated");
    closeEditDialog();
    onRefresh?.();
  };

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories.map((category) => ({
      value: category,
      label: ELEMENT_CATEGORY_LABELS[category as keyof typeof ELEMENT_CATEGORY_LABELS] || category,
    })),
  ];

  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...crewMembers.map((member) => ({
      value: member.id,
      label: `${member.name}${member.role ? ` (${member.role})` : ""}`,
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
                  <div key={element.id} className="flex items-start gap-3 px-4 py-3">
                    <Box className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{element.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {element.scenes && element.scenes.length > 0 ? (
                          element.scenes
                            .sort((a, b) => {
                              const aNum = parseInt(a.sceneNumber);
                              const bNum = parseInt(b.sceneNumber);
                              if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                              return a.sceneNumber.localeCompare(b.sceneNumber, undefined, {
                                numeric: true,
                              });
                            })
                            .map((scene) => (
                              <Badge
                                key={scene.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 font-mono"
                              >
                                Sc {scene.sceneNumber}
                              </Badge>
                            ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No scenes</span>
                        )}

                        {element.taskType && (
                          <Badge variant="outline" className="text-[10px]">
                            <ClipboardList className="mr-1 h-3 w-3" />
                            {TASK_TYPE_LABELS[element.taskType]}
                          </Badge>
                        )}

                        {(element.assignedCrew?.name ||
                          (element.assignedToCrewId
                            ? crewNameById.get(element.assignedToCrewId)
                            : null)) && (
                          <Badge variant="outline" className="text-[10px]">
                            <User className="mr-1 h-3 w-3" />
                            {element.assignedCrew?.name ||
                              crewNameById.get(element.assignedToCrewId || "")}
                          </Badge>
                        )}
                      </div>

                      {(element.description || element.notes) && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {element.description || element.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => openEditDialog(element)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(element.id)}
                        disabled={deletingId === element.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

      <Dialog open={!!editingElement} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent onClose={closeEditDialog} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Element</DialogTitle>
            <DialogDescription>
              Update details, comments, and assign someone to find or pick it up.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Element name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Input
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional details"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Task</label>
                <Select
                  value={editForm.taskType}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      taskType: event.target.value as EditElementForm["taskType"],
                    }))
                  }
                  options={TASK_TYPE_OPTIONS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Assigned To</label>
                <Select
                  value={editForm.assignedToCrewId}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      assignedToCrewId: event.target.value,
                    }))
                  }
                  options={assigneeOptions}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Comments</label>
              <Textarea
                rows={4}
                value={editForm.comments}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, comments: event.target.value }))
                }
                placeholder="Add notes or comments..."
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
