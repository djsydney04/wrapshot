"use client";

import * as React from "react";
import { Camera, Download, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Scene as DBScene } from "@/lib/actions/scenes";
import type { ShootingDay } from "@/lib/types";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";
import {
  createCameraAsset,
  createCameraBooking,
  createCameraPackageNeed,
  createCameraShot,
  getCameraAssets,
  getCameraReports,
  getCameraShots,
  updateCameraShot,
  upsertCameraReport,
  type CameraAssetWithBookings,
  type CameraReport,
  type CameraShot,
} from "@/lib/actions/camera";
import { DayAlertsPanel } from "@/components/departments/day-alerts-panel";
import { AttachmentPanel } from "@/components/departments/attachment-panel";
import { CommentThreadPanel } from "@/components/departments/comment-thread-panel";

interface CameraSectionProps {
  projectId: string;
  scenes: DBScene[];
  shootingDays: ShootingDay[];
  crew: CrewMemberWithInviteStatus[];
}

interface ReportCardLogDraft {
  roll: string;
  cardLabel: string;
  codec: string;
  resolution: string;
  tcStart: string;
  tcEnd: string;
  offloadedAt: string;
  checksum: string;
  notes: string;
}

type ShotColumnKey =
  | "setup"
  | "description"
  | "shotSize"
  | "cameraAngle"
  | "movement"
  | "lens"
  | "cameraBody"
  | "fps"
  | "estimatedMinutes"
  | "syncSound"
  | "vfxRequired"
  | "priority"
  | "notes"
  | "reference"
  | "packages";

const SHOT_COLUMNS: { key: ShotColumnKey; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "description", label: "Description" },
  { key: "shotSize", label: "Size" },
  { key: "cameraAngle", label: "Angle" },
  { key: "movement", label: "Movement" },
  { key: "lens", label: "Lens" },
  { key: "cameraBody", label: "Camera" },
  { key: "fps", label: "FPS" },
  { key: "estimatedMinutes", label: "Est Min" },
  { key: "syncSound", label: "Sync Sound" },
  { key: "vfxRequired", label: "VFX" },
  { key: "priority", label: "Priority" },
  { key: "packages", label: "Package" },
  { key: "notes", label: "Notes" },
  { key: "reference", label: "Ref" },
];

const DEFAULT_VISIBLE_COLUMNS: Record<ShotColumnKey, boolean> = {
  setup: true,
  description: true,
  shotSize: true,
  cameraAngle: true,
  movement: true,
  lens: true,
  cameraBody: false,
  fps: true,
  estimatedMinutes: true,
  syncSound: false,
  vfxRequired: true,
  priority: true,
  notes: false,
  reference: false,
  packages: true,
};

const SHOT_SIZE_OPTIONS = [
  { value: "", label: "Shot size" },
  { value: "WS", label: "WS (Wide)" },
  { value: "MS", label: "MS (Medium)" },
  { value: "CU", label: "CU (Close-Up)" },
  { value: "ECU", label: "ECU (Extreme CU)" },
  { value: "OTS", label: "OTS" },
  { value: "POV", label: "POV" },
  { value: "INSERT", label: "Insert" },
];

const CAMERA_ANGLE_OPTIONS = [
  { value: "", label: "Camera angle" },
  { value: "EYE_LEVEL", label: "Eye Level" },
  { value: "LOW", label: "Low" },
  { value: "HIGH", label: "High" },
  { value: "DUTCH", label: "Dutch" },
  { value: "BIRD_EYE", label: "Bird's Eye" },
  { value: "WORM_EYE", label: "Worm's Eye" },
];

const MOVEMENT_OPTIONS = [
  { value: "", label: "Movement" },
  { value: "STATIC", label: "Static" },
  { value: "PAN", label: "Pan" },
  { value: "TILT", label: "Tilt" },
  { value: "DOLLY", label: "Dolly" },
  { value: "TRUCK", label: "Truck" },
  { value: "CRANE", label: "Crane" },
  { value: "HANDHELD", label: "Handheld" },
  { value: "STEADICAM", label: "Steadicam" },
  { value: "GIMBAL", label: "Gimbal" },
  { value: "ZOOM", label: "Zoom" },
];

const DEFAULT_CARD_LOG: ReportCardLogDraft = {
  roll: "",
  cardLabel: "",
  codec: "",
  resolution: "",
  tcStart: "",
  tcEnd: "",
  offloadedAt: "",
  checksum: "",
  notes: "",
};

function sortBySceneNumber(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function formatAngleLabel(raw: string | null): string {
  if (!raw) return "-";
  return raw
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatMovementLabel(raw: string | null): string {
  if (!raw) return "-";
  return raw
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function toCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const serialized = String(value).replace(/"/g, '""');
  return `"${serialized}"`;
}

export function CameraSection({
  projectId,
  scenes,
  shootingDays,
  crew,
}: CameraSectionProps) {
  const [tab, setTab] = React.useState("shots");
  const [loading, setLoading] = React.useState(true);
  const [shots, setShots] = React.useState<CameraShot[]>([]);
  const [assets, setAssets] = React.useState<CameraAssetWithBookings[]>([]);
  const [reports, setReports] = React.useState<CameraReport[]>([]);
  const [updatingShotId, setUpdatingShotId] = React.useState<string | null>(null);

  const [shotForm, setShotForm] = React.useState({
    sceneId: scenes[0]?.id || "",
    shootingDayId: shootingDays[0]?.id || "",
    shotCode: "",
    setup: "",
    description: "",
    shotSize: "",
    cameraAngle: "",
    movement: "",
    lens: "",
    cameraBody: "",
    fps: "24",
    estimatedMinutes: "15",
    syncSound: true,
    vfxRequired: false,
    notes: "",
    referenceImageUrl: "",
    priority: "MEDIUM",
    status: "PLANNED",
  });

  const [shotFilters, setShotFilters] = React.useState({
    shootingDayId: "ALL",
    sceneId: "ALL",
    status: "ALL",
    search: "",
  });

  const [visibleColumns, setVisibleColumns] = React.useState(DEFAULT_VISIBLE_COLUMNS);

  const [needForm, setNeedForm] = React.useState({
    shotId: "",
    itemType: "",
    spec: "",
    qty: "1",
    source: "OWNED",
    estimatedRate: "0",
    status: "PENDING",
    notes: "",
  });

  const [assetForm, setAssetForm] = React.useState({
    category: "CAMERA",
    name: "",
    serial: "",
    ownerType: "OWNED",
    notes: "",
  });

  const [bookingForm, setBookingForm] = React.useState({
    assetId: "",
    startDayId: shootingDays[0]?.id || "",
    endDayId: shootingDays[0]?.id || "",
    rate: "0",
    poNumber: "",
  });

  const [reportForm, setReportForm] = React.useState({
    shootingDayId: shootingDays[0]?.id || "",
    cameraUnit: "MAIN",
    operatorId: "",
    summary: "",
    issues: "",
  });

  const [cardLogs, setCardLogs] = React.useState<ReportCardLogDraft[]>([
    { ...DEFAULT_CARD_LOG },
  ]);

  const sceneMap = React.useMemo(() => {
    return new Map(scenes.map((scene) => [scene.id, scene]));
  }, [scenes]);

  const dayMap = React.useMemo(() => {
    return new Map(shootingDays.map((day) => [day.id, day]));
  }, [shootingDays]);

  const statusCounts = React.useMemo(() => {
    return shots.reduce(
      (acc, shot) => {
        acc.total += 1;
        if (shot.status === "READY") acc.ready += 1;
        if (shot.status === "SHOT") acc.shot += 1;
        return acc;
      },
      { total: 0, ready: 0, shot: 0 },
    );
  }, [shots]);

  const loadCameraData = React.useCallback(async () => {
    setLoading(true);
    const [shotsResult, assetsResult, reportsResult] = await Promise.all([
      getCameraShots(projectId),
      getCameraAssets(projectId),
      getCameraReports(projectId),
    ]);

    setShots(shotsResult.data || []);
    setAssets(assetsResult.data || []);
    setReports(reportsResult.data || []);
    setLoading(false);
  }, [projectId]);

  React.useEffect(() => {
    void loadCameraData();
  }, [loadCameraData]);

  React.useEffect(() => {
    if (!needForm.shotId && shots.length > 0) {
      setNeedForm((prev) => ({ ...prev, shotId: shots[0].id }));
    }
    if (!bookingForm.assetId && assets.length > 0) {
      setBookingForm((prev) => ({ ...prev, assetId: assets[0].id }));
    }
  }, [assets, bookingForm.assetId, needForm.shotId, shots]);

  const filteredShots = React.useMemo(() => {
    const query = shotFilters.search.trim().toLowerCase();

    return shots.filter((shot) => {
      if (
        shotFilters.shootingDayId !== "ALL" &&
        (shot.shootingDayId || "UNSCHEDULED") !== shotFilters.shootingDayId
      ) {
        return false;
      }

      if (shotFilters.sceneId !== "ALL" && shot.sceneId !== shotFilters.sceneId) {
        return false;
      }

      if (shotFilters.status !== "ALL" && shot.status !== shotFilters.status) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        shot.shotCode,
        shot.setup,
        shot.description,
        shot.shotSize,
        shot.cameraAngle,
        shot.movement,
        shot.lens,
        shot.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [shots, shotFilters]);

  const groupedShots = React.useMemo(() => {
    const sorted = [...filteredShots].sort((a, b) => {
      const aDay = a.shootingDayId ? dayMap.get(a.shootingDayId) : null;
      const bDay = b.shootingDayId ? dayMap.get(b.shootingDayId) : null;
      const dayDiff = (aDay?.dayNumber ?? Number.MAX_SAFE_INTEGER) -
        (bDay?.dayNumber ?? Number.MAX_SAFE_INTEGER);
      if (dayDiff !== 0) return dayDiff;

      const aSceneNumber = a.scene?.sceneNumber || sceneMap.get(a.sceneId)?.sceneNumber || "";
      const bSceneNumber = b.scene?.sceneNumber || sceneMap.get(b.sceneId)?.sceneNumber || "";
      const sceneDiff = sortBySceneNumber(aSceneNumber, bSceneNumber);
      if (sceneDiff !== 0) return sceneDiff;

      const sortOrderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (sortOrderDiff !== 0) return sortOrderDiff;

      return sortBySceneNumber(a.shotCode, b.shotCode);
    });

    const groups: {
      dayKey: string;
      dayLabel: string;
      scenes: {
        sceneId: string;
        sceneLabel: string;
        shots: CameraShot[];
      }[];
    }[] = [];

    for (const shot of sorted) {
      const day = shot.shootingDayId ? dayMap.get(shot.shootingDayId) : null;
      const dayKey = shot.shootingDayId || "UNSCHEDULED";
      const dayLabel = day
        ? `Day ${day.dayNumber} (${day.date})`
        : "Unscheduled Shots";

      const sceneNumber = shot.scene?.sceneNumber || sceneMap.get(shot.sceneId)?.sceneNumber;
      const sceneLabel = sceneNumber ? `Scene ${sceneNumber}` : "Scene";

      let dayGroup = groups.find((group) => group.dayKey === dayKey);
      if (!dayGroup) {
        dayGroup = { dayKey, dayLabel, scenes: [] };
        groups.push(dayGroup);
      }

      let sceneGroup = dayGroup.scenes.find((group) => group.sceneId === shot.sceneId);
      if (!sceneGroup) {
        sceneGroup = {
          sceneId: shot.sceneId,
          sceneLabel,
          shots: [],
        };
        dayGroup.scenes.push(sceneGroup);
      }

      sceneGroup.shots.push(shot);
    }

    return groups;
  }, [dayMap, filteredShots, sceneMap]);

  const handleCreateShot = async () => {
    const result = await createCameraShot({
      projectId,
      sceneId: shotForm.sceneId,
      shootingDayId: shotForm.shootingDayId || undefined,
      shotCode: shotForm.shotCode,
      setup: shotForm.setup || undefined,
      description: shotForm.description || undefined,
      shotSize: shotForm.shotSize || undefined,
      cameraAngle: shotForm.cameraAngle || undefined,
      movement: shotForm.movement || undefined,
      lens: shotForm.lens || undefined,
      cameraBody: shotForm.cameraBody || undefined,
      fps: Number(shotForm.fps || 24),
      estimatedMinutes: Number(shotForm.estimatedMinutes || 0) || undefined,
      syncSound: shotForm.syncSound,
      vfxRequired: shotForm.vfxRequired,
      referenceImageUrl: shotForm.referenceImageUrl || undefined,
      notes: shotForm.notes || undefined,
      priority: shotForm.priority as "LOW" | "MEDIUM" | "HIGH",
      status: shotForm.status as "PLANNED" | "READY" | "SHOT",
    });

    if (result.data) {
      setNeedForm((prev) => ({ ...prev, shotId: result.data!.id }));
      setShotForm((prev) => ({
        ...prev,
        shotCode: "",
        setup: "",
        description: "",
        notes: "",
        referenceImageUrl: "",
      }));
      await loadCameraData();
    }
  };

  const handleShotStatusChange = async (
    shotId: string,
    status: "PLANNED" | "READY" | "SHOT",
  ) => {
    setUpdatingShotId(shotId);
    try {
      await updateCameraShot(shotId, { status });
      await loadCameraData();
    } finally {
      setUpdatingShotId(null);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredShots.map((shot) => {
      const sceneNumber = shot.scene?.sceneNumber || sceneMap.get(shot.sceneId)?.sceneNumber || "";
      const day = shot.shootingDayId ? dayMap.get(shot.shootingDayId) : null;
      const packageNeeds = shot.packageNeeds || [];
      const blockedNeeds = packageNeeds.filter(
        (need) => need.status === "PENDING" || need.status === "UNAVAILABLE",
      ).length;

      return [
        shot.shotCode,
        sceneNumber,
        day?.dayNumber ?? "",
        shot.setup,
        shot.description,
        shot.shotSize,
        formatAngleLabel(shot.cameraAngle),
        formatMovementLabel(shot.movement),
        shot.lens,
        shot.cameraBody,
        shot.fps,
        shot.estimatedMinutes,
        shot.syncSound,
        shot.vfxRequired,
        shot.priority,
        shot.status,
        packageNeeds.length,
        blockedNeeds,
        shot.notes,
      ];
    });

    const headers = [
      "Shot",
      "Scene",
      "Shoot Day",
      "Setup",
      "Description",
      "Size",
      "Angle",
      "Movement",
      "Lens",
      "Camera",
      "FPS",
      "Est Minutes",
      "Sync Sound",
      "VFX",
      "Priority",
      "Status",
      "Package Needs",
      "Blocked Needs",
      "Notes",
    ];

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => toCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `shot-list-${projectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateNeed = async () => {
    const result = await createCameraPackageNeed({
      projectId,
      shotId: needForm.shotId,
      itemType: needForm.itemType,
      spec: needForm.spec || undefined,
      qty: Number(needForm.qty || 1),
      source: needForm.source as "OWNED" | "RENTAL" | "PURCHASE" | "BORROW",
      estimatedRate: Number(needForm.estimatedRate || 0),
      status: needForm.status as "PENDING" | "SOURCED" | "UNAVAILABLE" | "READY",
      notes: needForm.notes || undefined,
    });

    if (result.data) {
      setNeedForm((prev) => ({ ...prev, itemType: "", spec: "", notes: "" }));
      await loadCameraData();
    }
  };

  const handleCreateAsset = async () => {
    const result = await createCameraAsset({
      projectId,
      category: assetForm.category,
      name: assetForm.name,
      serial: assetForm.serial || undefined,
      ownerType: assetForm.ownerType as "OWNED" | "RENTED",
      notes: assetForm.notes || undefined,
    });

    if (result.data) {
      setAssetForm((prev) => ({ ...prev, name: "", serial: "", notes: "" }));
      await loadCameraData();
    }
  };

  const handleCreateBooking = async () => {
    const result = await createCameraBooking({
      projectId,
      assetId: bookingForm.assetId,
      startDayId: bookingForm.startDayId,
      endDayId: bookingForm.endDayId,
      rate: Number(bookingForm.rate || 0),
      poNumber: bookingForm.poNumber || undefined,
    });

    if (result.data) {
      setBookingForm((prev) => ({ ...prev, rate: "0", poNumber: "" }));
      await loadCameraData();
    }
  };

  const updateCardLog = (
    index: number,
    field: keyof ReportCardLogDraft,
    value: string,
  ) => {
    setCardLogs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCardLog = () => {
    setCardLogs((prev) => [...prev, { ...DEFAULT_CARD_LOG }]);
  };

  const handleSaveReport = async () => {
    const result = await upsertCameraReport({
      projectId,
      shootingDayId: reportForm.shootingDayId,
      cameraUnit: reportForm.cameraUnit,
      operatorId: reportForm.operatorId || undefined,
      summary: reportForm.summary || undefined,
      issues: reportForm.issues || undefined,
      cardLogs: cardLogs.map((log) => ({
        ...log,
        offloadedAt: log.offloadedAt || undefined,
      })),
    });

    if (result.data) {
      setReportForm((prev) => ({ ...prev, summary: "", issues: "" }));
      setCardLogs([{ ...DEFAULT_CARD_LOG }]);
      await loadCameraData();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="h-4 w-4" />
              Camera Department Workspace
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{statusCounts.total} shots</Badge>
              <Badge variant="secondary">{statusCounts.ready} ready</Badge>
              <Badge variant="outline">{statusCounts.shot} shot</Badge>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading camera data...</p>
          ) : (
            <Tabs value={tab} onValueChange={setTab} defaultValue="shots">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="shots">Shot List + Package</TabsTrigger>
                <TabsTrigger value="assets">Assets + Rentals</TabsTrigger>
                <TabsTrigger value="reports">Daily Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="shots" className="space-y-4 pt-4">
                <div className="rounded-md border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Market-style Shot List Builder
                    </p>
                    <Button size="sm" variant="outline" onClick={handleExportCsv}>
                      <Download className="mr-1 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    <Select
                      value={shotForm.sceneId}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, sceneId: event.target.value }))
                      }
                      options={scenes.map((scene) => ({
                        value: scene.id,
                        label: `Scene ${scene.sceneNumber}`,
                      }))}
                    />
                    <Select
                      value={shotForm.shootingDayId}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, shootingDayId: event.target.value }))
                      }
                      options={shootingDays.map((day) => ({
                        value: day.id,
                        label: `Day ${day.dayNumber} (${day.date})`,
                      }))}
                    />
                    <Input
                      value={shotForm.shotCode}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, shotCode: event.target.value }))
                      }
                      placeholder="Shot code (A001, B013A...)"
                    />
                    <Input
                      value={shotForm.setup}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, setup: event.target.value }))
                      }
                      placeholder="Setup (Master, Coverage...)"
                    />
                    <Input
                      value={shotForm.description}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Shot description"
                    />
                    <Select
                      value={shotForm.shotSize}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, shotSize: event.target.value }))
                      }
                      options={SHOT_SIZE_OPTIONS}
                    />
                    <Select
                      value={shotForm.cameraAngle}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, cameraAngle: event.target.value }))
                      }
                      options={CAMERA_ANGLE_OPTIONS}
                    />
                    <Select
                      value={shotForm.movement}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, movement: event.target.value }))
                      }
                      options={MOVEMENT_OPTIONS}
                    />
                    <Input
                      value={shotForm.lens}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, lens: event.target.value }))
                      }
                      placeholder="Lens (e.g. 35mm)"
                    />
                    <Input
                      value={shotForm.cameraBody}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, cameraBody: event.target.value }))
                      }
                      placeholder="Camera body"
                    />
                    <Input
                      value={shotForm.fps}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, fps: event.target.value }))
                      }
                      placeholder="FPS"
                      type="number"
                      min={1}
                    />
                    <Input
                      value={shotForm.estimatedMinutes}
                      onChange={(event) =>
                        setShotForm((prev) => ({
                          ...prev,
                          estimatedMinutes: event.target.value,
                        }))
                      }
                      placeholder="Est. minutes"
                      type="number"
                      min={1}
                    />
                    <Select
                      value={shotForm.priority}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, priority: event.target.value }))
                      }
                      options={[
                        { value: "LOW", label: "Priority: Low" },
                        { value: "MEDIUM", label: "Priority: Medium" },
                        { value: "HIGH", label: "Priority: High" },
                      ]}
                    />
                    <Select
                      value={shotForm.status}
                      onChange={(event) =>
                        setShotForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                      options={[
                        { value: "PLANNED", label: "Status: Planned" },
                        { value: "READY", label: "Status: Ready" },
                        { value: "SHOT", label: "Status: Shot" },
                      ]}
                    />
                    <div className="md:col-span-2">
                      <Input
                        value={shotForm.referenceImageUrl}
                        onChange={(event) =>
                          setShotForm((prev) => ({
                            ...prev,
                            referenceImageUrl: event.target.value,
                          }))
                        }
                        placeholder="Reference image URL (optional)"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Textarea
                        value={shotForm.notes}
                        onChange={(event) =>
                          setShotForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                        placeholder="Camera notes"
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-4 flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={shotForm.syncSound}
                          onCheckedChange={(checked) =>
                            setShotForm((prev) => ({ ...prev, syncSound: checked }))
                          }
                        />
                        Sync sound
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={shotForm.vfxRequired}
                          onCheckedChange={(checked) =>
                            setShotForm((prev) => ({ ...prev, vfxRequired: checked }))
                          }
                        />
                        VFX required
                      </label>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleCreateShot}
                    disabled={!shotForm.shotCode.trim() || !shotForm.sceneId}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Shot
                  </Button>
                </div>

                <div className="rounded-md border border-border p-3 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Shot List Filters + Columns
                  </p>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Input
                      value={shotFilters.search}
                      onChange={(event) =>
                        setShotFilters((prev) => ({ ...prev, search: event.target.value }))
                      }
                      placeholder="Search shots"
                    />
                    <Select
                      value={shotFilters.shootingDayId}
                      onChange={(event) =>
                        setShotFilters((prev) => ({
                          ...prev,
                          shootingDayId: event.target.value,
                        }))
                      }
                      options={[
                        { value: "ALL", label: "All shoot days" },
                        { value: "UNSCHEDULED", label: "Unscheduled" },
                        ...shootingDays.map((day) => ({
                          value: day.id,
                          label: `Day ${day.dayNumber} (${day.date})`,
                        })),
                      ]}
                    />
                    <Select
                      value={shotFilters.sceneId}
                      onChange={(event) =>
                        setShotFilters((prev) => ({ ...prev, sceneId: event.target.value }))
                      }
                      options={[
                        { value: "ALL", label: "All scenes" },
                        ...scenes
                          .slice()
                          .sort((a, b) => sortBySceneNumber(a.sceneNumber, b.sceneNumber))
                          .map((scene) => ({
                            value: scene.id,
                            label: `Scene ${scene.sceneNumber}`,
                          })),
                      ]}
                    />
                    <Select
                      value={shotFilters.status}
                      onChange={(event) =>
                        setShotFilters((prev) => ({ ...prev, status: event.target.value }))
                      }
                      options={[
                        { value: "ALL", label: "All statuses" },
                        { value: "PLANNED", label: "Planned" },
                        { value: "READY", label: "Ready" },
                        { value: "SHOT", label: "Shot" },
                      ]}
                    />
                  </div>

                  <div className="grid gap-2 md:grid-cols-5">
                    {SHOT_COLUMNS.map((column) => (
                      <label
                        key={column.key}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Checkbox
                          checked={visibleColumns[column.key]}
                          onCheckedChange={(checked) =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [column.key]: checked,
                            }))
                          }
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {groupedShots.length === 0 ? (
                    <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                      No shots match the active filters.
                    </div>
                  ) : (
                    groupedShots.map((dayGroup) => (
                      <div key={dayGroup.dayKey} className="rounded-md border border-border">
                        <div className="border-b border-border px-3 py-2">
                          <p className="text-sm font-semibold">{dayGroup.dayLabel}</p>
                        </div>
                        <div className="space-y-3 p-3">
                          {dayGroup.scenes.map((sceneGroup) => (
                            <div key={sceneGroup.sceneId} className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {sceneGroup.sceneLabel}
                              </p>

                              <div className="overflow-x-auto rounded-md border border-border">
                                <table className="w-full min-w-[1100px] text-xs">
                                  <thead className="bg-muted/40">
                                    <tr>
                                      <th className="px-2 py-2 text-left font-medium">Shot</th>
                                      {visibleColumns.setup && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Setup
                                        </th>
                                      )}
                                      {visibleColumns.description && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Description
                                        </th>
                                      )}
                                      {visibleColumns.shotSize && (
                                        <th className="px-2 py-2 text-left font-medium">Size</th>
                                      )}
                                      {visibleColumns.cameraAngle && (
                                        <th className="px-2 py-2 text-left font-medium">Angle</th>
                                      )}
                                      {visibleColumns.movement && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Movement
                                        </th>
                                      )}
                                      {visibleColumns.lens && (
                                        <th className="px-2 py-2 text-left font-medium">Lens</th>
                                      )}
                                      {visibleColumns.cameraBody && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Camera
                                        </th>
                                      )}
                                      {visibleColumns.fps && (
                                        <th className="px-2 py-2 text-left font-medium">FPS</th>
                                      )}
                                      {visibleColumns.estimatedMinutes && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Est Min
                                        </th>
                                      )}
                                      {visibleColumns.syncSound && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Sync Sound
                                        </th>
                                      )}
                                      {visibleColumns.vfxRequired && (
                                        <th className="px-2 py-2 text-left font-medium">VFX</th>
                                      )}
                                      {visibleColumns.priority && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Priority
                                        </th>
                                      )}
                                      <th className="px-2 py-2 text-left font-medium">Status</th>
                                      {visibleColumns.packages && (
                                        <th className="px-2 py-2 text-left font-medium">
                                          Package
                                        </th>
                                      )}
                                      {visibleColumns.notes && (
                                        <th className="px-2 py-2 text-left font-medium">Notes</th>
                                      )}
                                      {visibleColumns.reference && (
                                        <th className="px-2 py-2 text-left font-medium">Ref</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sceneGroup.shots.map((shot) => {
                                      const packageNeeds = shot.packageNeeds || [];
                                      const blockedNeeds = packageNeeds.filter(
                                        (need) =>
                                          need.status === "PENDING" ||
                                          need.status === "UNAVAILABLE",
                                      ).length;

                                      return (
                                        <tr key={shot.id} className="border-t border-border">
                                          <td className="px-2 py-2 font-medium">{shot.shotCode}</td>
                                          {visibleColumns.setup && (
                                            <td className="px-2 py-2">{shot.setup || "-"}</td>
                                          )}
                                          {visibleColumns.description && (
                                            <td className="px-2 py-2">{shot.description || "-"}</td>
                                          )}
                                          {visibleColumns.shotSize && (
                                            <td className="px-2 py-2">{shot.shotSize || "-"}</td>
                                          )}
                                          {visibleColumns.cameraAngle && (
                                            <td className="px-2 py-2">
                                              {formatAngleLabel(shot.cameraAngle)}
                                            </td>
                                          )}
                                          {visibleColumns.movement && (
                                            <td className="px-2 py-2">
                                              {formatMovementLabel(shot.movement)}
                                            </td>
                                          )}
                                          {visibleColumns.lens && (
                                            <td className="px-2 py-2">{shot.lens || "-"}</td>
                                          )}
                                          {visibleColumns.cameraBody && (
                                            <td className="px-2 py-2">
                                              {shot.cameraBody || "-"}
                                            </td>
                                          )}
                                          {visibleColumns.fps && (
                                            <td className="px-2 py-2">{shot.fps || "-"}</td>
                                          )}
                                          {visibleColumns.estimatedMinutes && (
                                            <td className="px-2 py-2">
                                              {shot.estimatedMinutes || "-"}
                                            </td>
                                          )}
                                          {visibleColumns.syncSound && (
                                            <td className="px-2 py-2">
                                              {shot.syncSound ? "Yes" : "No"}
                                            </td>
                                          )}
                                          {visibleColumns.vfxRequired && (
                                            <td className="px-2 py-2">
                                              {shot.vfxRequired ? "Yes" : "No"}
                                            </td>
                                          )}
                                          {visibleColumns.priority && (
                                            <td className="px-2 py-2">
                                              <Badge variant="outline">{shot.priority}</Badge>
                                            </td>
                                          )}
                                          <td className="px-2 py-2">
                                            <Select
                                              value={shot.status}
                                              onChange={(event) => {
                                                void handleShotStatusChange(
                                                  shot.id,
                                                  event.target.value as "PLANNED" | "READY" | "SHOT",
                                                );
                                              }}
                                              options={[
                                                { value: "PLANNED", label: "Planned" },
                                                { value: "READY", label: "Ready" },
                                                { value: "SHOT", label: "Shot" },
                                              ]}
                                              disabled={updatingShotId === shot.id}
                                              className="h-8 min-w-[108px]"
                                            />
                                          </td>
                                          {visibleColumns.packages && (
                                            <td className="px-2 py-2">
                                              {packageNeeds.length === 0 ? (
                                                <span className="text-muted-foreground">-</span>
                                              ) : blockedNeeds > 0 ? (
                                                <Badge variant="outline">
                                                  {blockedNeeds}/{packageNeeds.length} blocked
                                                </Badge>
                                              ) : (
                                                <Badge variant="secondary">
                                                  {packageNeeds.length} ready
                                                </Badge>
                                              )}
                                            </td>
                                          )}
                                          {visibleColumns.notes && (
                                            <td className="px-2 py-2 max-w-[220px]">
                                              <span className="line-clamp-2">
                                                {shot.notes || "-"}
                                              </span>
                                            </td>
                                          )}
                                          {visibleColumns.reference && (
                                            <td className="px-2 py-2">
                                              {shot.referenceImageUrl ? (
                                                <a
                                                  href={shot.referenceImageUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="block h-10 w-16 overflow-hidden rounded border border-border"
                                                >
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img
                                                    src={shot.referenceImageUrl}
                                                    alt={`${shot.shotCode} reference`}
                                                    className="h-full w-full object-cover"
                                                  />
                                                </a>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Add Package Need
                  </p>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Select
                      value={needForm.shotId}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, shotId: event.target.value }))
                      }
                      options={shots.map((shot) => ({
                        value: shot.id,
                        label: `${shot.shotCode} · Scene ${shot.scene?.sceneNumber || "-"}`,
                      }))}
                    />
                    <Input
                      value={needForm.itemType}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, itemType: event.target.value }))
                      }
                      placeholder="Item type"
                    />
                    <Input
                      value={needForm.spec}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, spec: event.target.value }))
                      }
                      placeholder="Spec"
                    />
                    <Input
                      value={needForm.qty}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, qty: event.target.value }))
                      }
                      type="number"
                      min={1}
                      placeholder="Qty"
                    />
                    <Select
                      value={needForm.source}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, source: event.target.value }))
                      }
                      options={[
                        { value: "OWNED", label: "Owned" },
                        { value: "RENTAL", label: "Rental" },
                        { value: "PURCHASE", label: "Purchase" },
                        { value: "BORROW", label: "Borrow" },
                      ]}
                    />
                    <Input
                      value={needForm.estimatedRate}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, estimatedRate: event.target.value }))
                      }
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Est. rate"
                    />
                    <Select
                      value={needForm.status}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                      options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "SOURCED", label: "Sourced" },
                        { value: "UNAVAILABLE", label: "Unavailable" },
                        { value: "READY", label: "Ready" },
                      ]}
                    />
                    <Input
                      value={needForm.notes}
                      onChange={(event) =>
                        setNeedForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Notes"
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCreateNeed}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Package Need
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="space-y-4 pt-4">
                <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                  <Input
                    value={assetForm.category}
                    onChange={(event) =>
                      setAssetForm((prev) => ({ ...prev, category: event.target.value }))
                    }
                    placeholder="Category"
                  />
                  <Input
                    value={assetForm.name}
                    onChange={(event) =>
                      setAssetForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Asset name"
                  />
                  <Input
                    value={assetForm.serial}
                    onChange={(event) =>
                      setAssetForm((prev) => ({ ...prev, serial: event.target.value }))
                    }
                    placeholder="Serial"
                  />
                  <Select
                    value={assetForm.ownerType}
                    onChange={(event) =>
                      setAssetForm((prev) => ({ ...prev, ownerType: event.target.value }))
                    }
                    options={[
                      { value: "OWNED", label: "Owned" },
                      { value: "RENTED", label: "Rented" },
                    ]}
                  />
                  <div className="md:col-span-2">
                    <Input
                      value={assetForm.notes}
                      onChange={(event) =>
                        setAssetForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Notes"
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleCreateAsset} disabled={!assetForm.name.trim()}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Asset
                </Button>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Add Booking
                  </p>
                  <div className="grid gap-2 md:grid-cols-5">
                    <Select
                      value={bookingForm.assetId}
                      onChange={(event) =>
                        setBookingForm((prev) => ({ ...prev, assetId: event.target.value }))
                      }
                      options={assets.map((asset) => ({
                        value: asset.id,
                        label: asset.name,
                      }))}
                    />
                    <Select
                      value={bookingForm.startDayId}
                      onChange={(event) =>
                        setBookingForm((prev) => ({ ...prev, startDayId: event.target.value }))
                      }
                      options={shootingDays.map((day) => ({
                        value: day.id,
                        label: `Start Day ${day.dayNumber}`,
                      }))}
                    />
                    <Select
                      value={bookingForm.endDayId}
                      onChange={(event) =>
                        setBookingForm((prev) => ({ ...prev, endDayId: event.target.value }))
                      }
                      options={shootingDays.map((day) => ({
                        value: day.id,
                        label: `End Day ${day.dayNumber}`,
                      }))}
                    />
                    <Input
                      value={bookingForm.rate}
                      onChange={(event) =>
                        setBookingForm((prev) => ({ ...prev, rate: event.target.value }))
                      }
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Rate"
                    />
                    <Input
                      value={bookingForm.poNumber}
                      onChange={(event) =>
                        setBookingForm((prev) => ({ ...prev, poNumber: event.target.value }))
                      }
                      placeholder="PO #"
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCreateBooking}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Booking
                  </Button>
                </div>

                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div key={asset.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{asset.name}</p>
                        <Badge variant="outline">{asset.status}</Badge>
                      </div>
                      {asset.bookings.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {asset.bookings.map((booking) => (
                            <p key={booking.id} className="text-xs text-muted-foreground">
                              Day range: {booking.startDayId.slice(0, 6)} →
                              {" "}
                              {booking.endDayId.slice(0, 6)} ·
                              {" "}
                              ${Number(booking.rate || 0).toFixed(2)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No bookings yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reports" className="space-y-4 pt-4">
                <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3">
                  <Select
                    value={reportForm.shootingDayId}
                    onChange={(event) =>
                      setReportForm((prev) => ({ ...prev, shootingDayId: event.target.value }))
                    }
                    options={shootingDays.map((day) => ({
                      value: day.id,
                      label: `Day ${day.dayNumber} (${day.date})`,
                    }))}
                  />
                  <Input
                    value={reportForm.cameraUnit}
                    onChange={(event) =>
                      setReportForm((prev) => ({ ...prev, cameraUnit: event.target.value }))
                    }
                    placeholder="Camera unit"
                  />
                  <Select
                    value={reportForm.operatorId}
                    onChange={(event) =>
                      setReportForm((prev) => ({ ...prev, operatorId: event.target.value }))
                    }
                    options={[
                      { value: "", label: "Operator (optional)" },
                      ...crew.map((member) => ({
                        value: member.id,
                        label: `${member.name}${member.role ? ` (${member.role})` : ""}`,
                      })),
                    ]}
                  />
                  <div className="md:col-span-3">
                    <Textarea
                      value={reportForm.summary}
                      onChange={(event) =>
                        setReportForm((prev) => ({ ...prev, summary: event.target.value }))
                      }
                      placeholder="Daily camera summary"
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Textarea
                      value={reportForm.issues}
                      onChange={(event) =>
                        setReportForm((prev) => ({ ...prev, issues: event.target.value }))
                      }
                      placeholder="Issues"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Card Logs
                  </p>
                  {cardLogs.map((log, index) => (
                    <div key={`${index}-${log.roll}`} className="grid gap-2 md:grid-cols-4">
                      <Input
                        value={log.roll}
                        onChange={(event) => updateCardLog(index, "roll", event.target.value)}
                        placeholder="Roll"
                      />
                      <Input
                        value={log.cardLabel}
                        onChange={(event) =>
                          updateCardLog(index, "cardLabel", event.target.value)
                        }
                        placeholder="Card"
                      />
                      <Input
                        value={log.codec}
                        onChange={(event) => updateCardLog(index, "codec", event.target.value)}
                        placeholder="Codec"
                      />
                      <Input
                        value={log.checksum}
                        onChange={(event) =>
                          updateCardLog(index, "checksum", event.target.value)
                        }
                        placeholder="Checksum"
                      />
                      <Input
                        value={log.tcStart}
                        onChange={(event) => updateCardLog(index, "tcStart", event.target.value)}
                        placeholder="TC start"
                      />
                      <Input
                        value={log.tcEnd}
                        onChange={(event) => updateCardLog(index, "tcEnd", event.target.value)}
                        placeholder="TC end"
                      />
                      <Input
                        value={log.resolution}
                        onChange={(event) =>
                          updateCardLog(index, "resolution", event.target.value)
                        }
                        placeholder="Resolution"
                      />
                      <Input
                        value={log.offloadedAt}
                        onChange={(event) =>
                          updateCardLog(index, "offloadedAt", event.target.value)
                        }
                        type="datetime-local"
                        placeholder="Offloaded at"
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addCardLog}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Card Log Row
                  </Button>
                </div>

                <Button size="sm" onClick={handleSaveReport}>
                  <Save className="mr-1 h-4 w-4" />
                  Save Camera Report
                </Button>

                <div className="space-y-2">
                  {reports.map((report) => (
                    <div key={report.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Day
                          {" "}
                          {shootingDays.find((day) => day.id === report.shootingDayId)
                            ?.dayNumber || "-"}
                          {" "}
                          ·
                          {" "}
                          {report.cameraUnit}
                        </p>
                        <Badge variant="outline">{report.cardLogs?.length || 0} cards</Badge>
                      </div>
                      {report.summary && (
                        <p className="mt-1 text-xs text-muted-foreground">{report.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="space-y-4">
          <DayAlertsPanel projectId={projectId} department="CAMERA" title="Camera Alerts" />
          <AttachmentPanel
            projectId={projectId}
            entityType="CAMERA_WORKSPACE"
            entityId={projectId}
            title="Camera Attachments"
          />
          <CommentThreadPanel
            projectId={projectId}
            entityType="CAMERA_WORKSPACE"
            entityId={projectId}
            title="Camera Notes"
          />
        </div>
      </div>
    </div>
  );
}
