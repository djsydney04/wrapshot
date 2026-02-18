"use client";

import * as React from "react";
import { MapPin, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddLocationForm } from "@/components/forms/add-location-form";
import {
  deleteLocation,
  updateLocation,
  type Location,
  type LocationType,
  type IntExt,
  type PermitStatus,
} from "@/lib/actions/locations";

interface LocationsSectionProps {
  projectId: string;
  locations: Location[];
  onRefresh?: () => void;
}

interface LocationEditState {
  id: string;
  name: string;
  address: string;
  locationType: LocationType;
  interiorExterior: IntExt;
  permitStatus: PermitStatus;
  permitStartDate: string;
  permitEndDate: string;
  contactName: string;
  contactPhone: string;
  parkingNotes: string;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function LocationsSection({
  projectId,
  locations,
  onRefresh,
}: LocationsSectionProps) {
  const [showAddLocation, setShowAddLocation] = React.useState(false);
  const [editing, setEditing] = React.useState<LocationEditState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [localLocations, setLocalLocations] = React.useState<Location[]>(locations);

  React.useEffect(() => {
    setLocalLocations(locations);
  }, [locations]);

  const handleDelete = async (locationId: string) => {
    if (!confirm("Delete this location?")) return;
    setDeletingId(locationId);
    const { error } = await deleteLocation(locationId, projectId);
    if (!error) {
      setLocalLocations((prev) => prev.filter((location) => location.id !== locationId));
      onRefresh?.();
    }
    setDeletingId(null);
  };

  const openEditor = (location: Location) => {
    setEditing({
      id: location.id,
      name: location.name,
      address: location.address || "",
      locationType: location.locationType,
      interiorExterior: location.interiorExterior,
      permitStatus: location.permitStatus,
      permitStartDate: toDateInput(location.permitStartDate),
      permitEndDate: toDateInput(location.permitEndDate),
      contactName: location.contactName || "",
      contactPhone: location.contactPhone || "",
      parkingNotes: location.parkingNotes || "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { data, error } = await updateLocation(editing.id, {
      name: editing.name,
      address: editing.address || undefined,
      locationType: editing.locationType,
      interiorExterior: editing.interiorExterior,
      permitStatus: editing.permitStatus,
      permitStartDate: editing.permitStartDate || undefined,
      permitEndDate: editing.permitEndDate || undefined,
      contactName: editing.contactName || undefined,
      contactPhone: editing.contactPhone || undefined,
      parkingNotes: editing.parkingNotes || undefined,
    });
    if (!error && data) {
      setLocalLocations((prev) =>
        prev.map((location) => (location.id === editing.id ? { ...location, ...data } : location))
      );
      setEditing(null);
      onRefresh?.();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {localLocations.length} location{localLocations.length === 1 ? "" : "s"}
        </div>
        <Button size="sm" onClick={() => setShowAddLocation(true)}>
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      {localLocations.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">INT/EXT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Permit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scenes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {localLocations.map((location) => (
                <tr key={location.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">{location.address || "No address"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{location.interiorExterior}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{location.permitStatus.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {location.sceneCount || 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditor(location)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(location.id)}
                        disabled={deletingId === location.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 font-medium">No locations yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Locations are auto-created from analyzed scenes or you can add them manually.
          </p>
          <Button onClick={() => setShowAddLocation(true)}>
            <Plus className="h-4 w-4" />
            Add First Location
          </Button>
        </div>
      )}

      <AddLocationForm
        projectId={projectId}
        open={showAddLocation}
        onOpenChange={setShowAddLocation}
        onSuccess={onRefresh}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent onClose={() => setEditing(null)}>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <DialogBody className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name</label>
                  <Input
                    value={editing.name}
                    onChange={(event) =>
                      setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Address</label>
                  <Input
                    value={editing.address}
                    onChange={(event) =>
                      setEditing((prev) => (prev ? { ...prev, address: event.target.value } : prev))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Type</label>
                    <Select
                      value={editing.locationType}
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev ? { ...prev, locationType: event.target.value as LocationType } : prev
                        )
                      }
                      options={[
                        { value: "PRACTICAL", label: "Practical" },
                        { value: "STUDIO", label: "Studio" },
                        { value: "BACKLOT", label: "Backlot" },
                        { value: "VIRTUAL", label: "Virtual" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">INT/EXT</label>
                    <Select
                      value={editing.interiorExterior}
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev ? { ...prev, interiorExterior: event.target.value as IntExt } : prev
                        )
                      }
                      options={[
                        { value: "INT", label: "INT" },
                        { value: "EXT", label: "EXT" },
                        { value: "BOTH", label: "BOTH" },
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Permit Status</label>
                  <Select
                    value={editing.permitStatus}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev ? { ...prev, permitStatus: event.target.value as PermitStatus } : prev
                      )
                    }
                    options={[
                      { value: "NOT_STARTED", label: "Not Started" },
                      { value: "APPLIED", label: "Applied" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "DENIED", label: "Denied" },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Permit Start</label>
                    <Input
                      type="date"
                      value={editing.permitStartDate}
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev ? { ...prev, permitStartDate: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Permit End</label>
                    <Input
                      type="date"
                      value={editing.permitEndDate}
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev ? { ...prev, permitEndDate: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Contact Name</label>
                    <Input
                      value={editing.contactName}
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev ? { ...prev, contactName: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Contact Phone</label>
                    <Input
                      value={editing.contactPhone}
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev ? { ...prev, contactPhone: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Parking Notes</label>
                  <Textarea
                    value={editing.parkingNotes}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev ? { ...prev, parkingNotes: event.target.value } : prev
                      )
                    }
                    rows={3}
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
