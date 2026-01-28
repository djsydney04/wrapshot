"use client";

import * as React from "react";
import { Plus, Package, ChevronDown, ChevronRight, Search, Camera, Lightbulb, Volume2, Palette, Shirt, Box, Car, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { AddGearForm } from "@/components/forms/add-gear-form";
import { DEPARTMENT_LABELS, GEAR_CATEGORIES, type GearItem, type DepartmentType, type Scene } from "@/lib/mock-data";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<GearItem["category"], React.ElementType> = {
  CAMERA: Camera,
  LIGHTING: Lightbulb,
  SOUND: Volume2,
  ART: Palette,
  COSTUME: Shirt,
  PROPS: Box,
  VEHICLES: Car,
  SPECIAL_EQUIPMENT: Wrench,
  OTHER: Package,
};

interface GearSectionProps {
  projectId: string;
  gear: GearItem[];
  scenes: Scene[];
  userDepartment?: DepartmentType; // The logged-in user's department for edit permissions
}

export function GearSection({
  projectId,
  gear,
  scenes,
  userDepartment,
}: GearSectionProps) {
  const [showAddGear, setShowAddGear] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<GearItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterDepartment, setFilterDepartment] = React.useState<string>("all");
  const [collapsedDepts, setCollapsedDepts] = React.useState<Set<DepartmentType>>(new Set());
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { deleteGearItem } = useProjectStore();

  // Filter gear
  const filteredGear = React.useMemo(() => {
    let result = gear;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.notes?.toLowerCase().includes(query)
      );
    }

    if (filterDepartment !== "all") {
      result = result.filter((g) => g.department === filterDepartment);
    }

    return result;
  }, [gear, searchQuery, filterDepartment]);

  // Group by department
  const gearByDepartment = React.useMemo(() => {
    const grouped: Partial<Record<DepartmentType, GearItem[]>> = {};
    filteredGear.forEach((item) => {
      if (!grouped[item.department]) {
        grouped[item.department] = [];
      }
      grouped[item.department]!.push(item);
    });
    return grouped;
  }, [filteredGear]);

  const toggleDeptCollapse = (dept: DepartmentType) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };

  const canEdit = (item: GearItem) => {
    // For now, allow all edits. In a real app, check if userDepartment matches
    return !userDepartment || userDepartment === item.department;
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteGearItem(id);
      forceUpdate();
    }
  };

  const getSceneNames = (sceneIds: string[] | undefined) => {
    if (!sceneIds || sceneIds.length === 0) return null;
    const sceneNumbers = sceneIds
      .map((id) => scenes.find((s) => s.id === id)?.sceneNumber)
      .filter(Boolean);
    return sceneNumbers.join(", ");
  };

  const departmentOptions = [
    { value: "all", label: "All Departments" },
    ...(Object.keys(DEPARTMENT_LABELS) as DepartmentType[]).map((dept) => ({
      value: dept,
      label: DEPARTMENT_LABELS[dept],
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search gear..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-48">
            <Select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              options={departmentOptions}
            />
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddGear(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </div>

      {/* Gear List by Department */}
      <div className="space-y-3">
        {(Object.keys(DEPARTMENT_LABELS) as DepartmentType[]).map((dept) => {
          const deptGear = gearByDepartment[dept];
          if (!deptGear || deptGear.length === 0) return null;

          const isCollapsed = collapsedDepts.has(dept);
          const totalItems = deptGear.reduce((sum, g) => sum + g.quantity, 0);

          return (
            <div key={dept} className="rounded-lg border border-border overflow-hidden">
              {/* Department Header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                onClick={() => toggleDeptCollapse(dept)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-medium">{DEPARTMENT_LABELS[dept]}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {deptGear.length} items ({totalItems} total)
                  </Badge>
                </div>
                {userDepartment && userDepartment !== dept && (
                  <span className="text-xs text-muted-foreground">View only</span>
                )}
              </button>

              {/* Gear Items */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {deptGear.map((item) => {
                    const Icon = CATEGORY_ICONS[item.category];
                    const sceneNames = getSceneNames(item.assignedScenes);
                    const editable = canEdit(item);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3 group",
                          editable && "hover:bg-muted/30"
                        )}
                      >
                        {/* Icon */}
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="h-full w-full object-cover rounded-lg"
                            />
                          ) : (
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {GEAR_CATEGORIES[item.category]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>Qty: {item.quantity}</span>
                            {sceneNames && (
                              <span>Scenes: {sceneNames}</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        {editable && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingItem(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredGear.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">
              {searchQuery || filterDepartment !== "all" ? "No items found" : "No gear tracked yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || filterDepartment !== "all"
                ? "Try adjusting your filters"
                : "Add equipment, props, and other items needed for your production"}
            </p>
            {!searchQuery && filterDepartment === "all" && (
              <Button onClick={() => setShowAddGear(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Item
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      <AddGearForm
        projectId={projectId}
        scenes={scenes}
        open={showAddGear || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddGear(false);
            setEditingItem(null);
          }
        }}
        onSuccess={() => {
          setShowAddGear(false);
          setEditingItem(null);
          forceUpdate();
        }}
        editItem={editingItem}
        defaultDepartment={userDepartment}
      />
    </div>
  );
}
