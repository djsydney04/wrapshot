"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Clock,
  MapPin,
  Pencil,
  Trash2,
  ChevronDown,
  Users,
  FileText,
  Calendar,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  SlidePanel,
  SlidePanelHeader,
  SlidePanelTitle,
  SlidePanelDescription,
  SlidePanelBody,
  SlidePanelFooter,
  SlidePanelSection,
} from "@/components/ui/slide-panel";
import { SceneOrderEditor } from "./scene-order-editor";
import { CastCallTimesEditor } from "./cast-call-times-editor";
import { DepartmentCallTimesEditor } from "./department-call-times-editor";
import type { ShootingDay, Scene, CastMember, Location } from "@/lib/types";

interface ShootingDayDetailPanelProps {
  shootingDay: ShootingDay | null;
  scenes: Scene[];
  cast: CastMember[];
  locations: Location[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (shootingDay: ShootingDay) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<ShootingDay>) => Promise<void>;
  onUpdateSceneOrder?: (shootingDayId: string, sceneIds: string[]) => Promise<void>;
  onUpdateCastCallTimes?: (
    shootingDayId: string,
    castTimes: Array<{
      castMemberId: string;
      workStatus: string;
      pickupTime?: string;
      muHairCall?: string;
      onSetCall?: string;
      remarks?: string;
    }>
  ) => Promise<void>;
  onUpdateDepartmentCallTimes?: (
    shootingDayId: string,
    deptTimes: Array<{
      department: string;
      callTime: string;
      notes?: string;
    }>
  ) => Promise<void>;
  useMockData?: boolean;
}

const STATUS_OPTIONS = [
  { value: "TENTATIVE", label: "Tentative" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGES: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  TENTATIVE: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type ActiveSection = "overview" | "scenes" | "cast" | "departments";

export function ShootingDayDetailPanel({
  shootingDay,
  scenes,
  cast,
  locations,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onUpdate,
  onUpdateSceneOrder,
  onUpdateCastCallTimes,
  onUpdateDepartmentCallTimes,
  useMockData = true,
}: ShootingDayDetailPanelProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<ActiveSection>("overview");
  const [editedValues, setEditedValues] = React.useState({
    generalCall: "",
    wrapTime: "",
    crewCall: "",
    talentCall: "",
    status: "",
    notes: "",
    locationId: "",
  });

  // Reset edited values when shooting day changes
  React.useEffect(() => {
    if (shootingDay) {
      setEditedValues({
        generalCall: shootingDay.generalCall || "",
        wrapTime: shootingDay.wrapTime || shootingDay.expectedWrap || "",
        crewCall: shootingDay.crewCall || "",
        talentCall: shootingDay.talentCall || "",
        status: shootingDay.status,
        notes: shootingDay.notes || "",
        locationId: shootingDay.locationId || "",
      });
    }
  }, [shootingDay]);

  if (!shootingDay) {
    return null;
  }

  // Get scenes for this shooting day
  const dayScenes = scenes.filter((s) => shootingDay.scenes.includes(s.id));

  // Get total pages
  const totalPages = dayScenes.reduce((sum, s) => sum + s.pageCount, 0);

  // Get unique cast from scenes
  const castIds = new Set(dayScenes.flatMap((s) => s.castIds || []));
  const dayCast = cast.filter((c) => castIds.has(c.id));

  // Get location
  const location = shootingDay.locationId
    ? locations.find((l) => l.id === shootingDay.locationId)
    : null;

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this shooting day?")) {
      setDeleting(true);
      try {
        await onDelete?.(shootingDay.id);
        onOpenChange(false);
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleSave = async () => {
    if (!isEditing) return;

    await onUpdate?.(shootingDay.id, {
      generalCall: editedValues.generalCall || undefined,
      wrapTime: editedValues.wrapTime || undefined,
      crewCall: editedValues.crewCall || undefined,
      talentCall: editedValues.talentCall || undefined,
      status: editedValues.status as ShootingDay["status"],
      notes: editedValues.notes || undefined,
      locationId: editedValues.locationId || undefined,
    });

    setIsEditing(false);
  };

  const handleSceneOrderChange = async (newSceneIds: string[]) => {
    await onUpdateSceneOrder?.(shootingDay.id, newSceneIds);
  };

  const sectionTabs: { id: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Calendar className="h-4 w-4" /> },
    { id: "scenes", label: "Scenes", icon: <FileText className="h-4 w-4" /> },
    { id: "cast", label: "Cast", icon: <Users className="h-4 w-4" /> },
    { id: "departments", label: "Departments", icon: <Building className="h-4 w-4" /> },
  ];

  return (
    <SlidePanel open={open} onOpenChange={onOpenChange} showOverlay>
      <SlidePanelHeader onClose={() => onOpenChange(false)}>
        <div className="flex items-center gap-2">
          <SlidePanelTitle>Day {shootingDay.dayNumber}</SlidePanelTitle>
          {shootingDay.unit !== "MAIN" && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
              {shootingDay.unit}
            </span>
          )}
        </div>
        <SlidePanelDescription>
          {format(new Date(shootingDay.date), "EEEE, MMMM d, yyyy")}
        </SlidePanelDescription>
      </SlidePanelHeader>

      {/* Section Tabs */}
      <div className="flex border-b border-border bg-muted/20 px-2 flex-shrink-0">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeSection === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <SlidePanelBody>
        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            {/* Status */}
            <SlidePanelSection title="Status">
              {isEditing ? (
                <Select
                  value={editedValues.status}
                  onChange={(e) =>
                    setEditedValues({ ...editedValues, status: e.target.value })
                  }
                  options={STATUS_OPTIONS}
                />
              ) : (
                <span
                  className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                    STATUS_BADGES[shootingDay.status]
                  )}
                >
                  {shootingDay.status}
                </span>
              )}
            </SlidePanelSection>

            {/* Call Times */}
            <SlidePanelSection title="Call Times">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    General Call
                  </label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={editedValues.generalCall}
                      onChange={(e) =>
                        setEditedValues({
                          ...editedValues,
                          generalCall: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {shootingDay.generalCall || "—"}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Expected Wrap
                  </label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={editedValues.wrapTime}
                      onChange={(e) =>
                        setEditedValues({
                          ...editedValues,
                          wrapTime: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {shootingDay.wrapTime || shootingDay.expectedWrap || "—"}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Crew Call
                  </label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={editedValues.crewCall}
                      onChange={(e) =>
                        setEditedValues({
                          ...editedValues,
                          crewCall: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <div className="text-sm font-medium">
                      {shootingDay.crewCall || "—"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Talent Call
                  </label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={editedValues.talentCall}
                      onChange={(e) =>
                        setEditedValues({
                          ...editedValues,
                          talentCall: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <div className="text-sm font-medium">
                      {shootingDay.talentCall || "—"}
                    </div>
                  )}
                </div>
              </div>
            </SlidePanelSection>

            {/* Location */}
            <SlidePanelSection title="Location">
              {isEditing ? (
                <Select
                  value={editedValues.locationId}
                  onChange={(e) =>
                    setEditedValues({
                      ...editedValues,
                      locationId: e.target.value,
                    })
                  }
                  options={[
                    { value: "", label: "No location selected" },
                    ...locations.map((l) => ({
                      value: l.id,
                      label: l.name,
                    })),
                  ]}
                />
              ) : location ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{location.name}</span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No location assigned
                </div>
              )}
            </SlidePanelSection>

            {/* Quick Stats */}
            <SlidePanelSection title="Summary">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-2xl font-semibold">{dayScenes.length}</div>
                  <div className="text-xs text-muted-foreground">Scenes</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-2xl font-semibold">
                    {totalPages.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Pages</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-2xl font-semibold">{dayCast.length}</div>
                  <div className="text-xs text-muted-foreground">Cast</div>
                </div>
              </div>
            </SlidePanelSection>

            {/* Notes */}
            <SlidePanelSection title="Notes">
              {isEditing ? (
                <Textarea
                  value={editedValues.notes}
                  onChange={(e) =>
                    setEditedValues({ ...editedValues, notes: e.target.value })
                  }
                  placeholder="Add notes for this shooting day..."
                  rows={3}
                />
              ) : shootingDay.notes ? (
                <p className="text-sm text-muted-foreground">{shootingDay.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes</p>
              )}
            </SlidePanelSection>
          </div>
        )}

        {/* Scenes Section */}
        {activeSection === "scenes" && (
          <SceneOrderEditor
            shootingDay={shootingDay}
            scenes={scenes}
            allScenes={scenes}
            onReorder={handleSceneOrderChange}
          />
        )}

        {/* Cast Section */}
        {activeSection === "cast" && (
          <CastCallTimesEditor
            shootingDay={shootingDay}
            scenes={dayScenes}
            cast={cast}
            onUpdate={onUpdateCastCallTimes}
          />
        )}

        {/* Departments Section */}
        {activeSection === "departments" && (
          <DepartmentCallTimesEditor
            shootingDay={shootingDay}
            onUpdate={onUpdateDepartmentCallTimes}
          />
        )}
      </SlidePanelBody>

      <SlidePanelFooter>
        {isEditing ? (
          <>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </>
        )}
      </SlidePanelFooter>
    </SlidePanel>
  );
}
