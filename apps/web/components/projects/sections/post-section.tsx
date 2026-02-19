"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Film,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayAlertsPanel } from "@/components/departments/day-alerts-panel";
import { AttachmentPanel } from "@/components/departments/attachment-panel";
import { CommentThreadPanel } from "@/components/departments/comment-thread-panel";
import {
  createDeliveryChecklistItem,
  createEditReviewNote,
  createEditVersion,
  createVfxShot,
  createVfxTurnover,
  ensurePostIngestBatch,
  getPostWorkspaceData,
  reconcilePostIngestBatch,
  syncPostBlockersToCallSheet,
  type DeliveryChecklistItem,
  type DeliveryChecklistStatus,
  type EditReviewNote,
  type EditVersion,
  type EditVersionStatus,
  type PostIngestBatch,
  type PostIngestItem,
  type PostIngestQcStatus,
  type PostIssue,
  type PostWorkspaceData,
  type VfxShot,
  type VfxShotStatus,
  updateDeliveryChecklistItemStatus,
  updateEditReviewNoteStatus,
  updateEditVersionStatus,
  updateVfxShotStatus,
  upsertPostIngestItem,
} from "@/lib/actions/post-production";
import type { ShootingDay } from "@/lib/types";
import type { Scene as DBScene } from "@/lib/actions/scenes";

interface PostSectionProps {
  projectId: string;
  shootingDays: ShootingDay[];
  scenes: DBScene[];
}

interface IngestRowDraft {
  roll: string;
  qcStatus: PostIngestQcStatus;
  issue: string;
}

const VERSION_STATUSES: EditVersionStatus[] = [
  "ASSEMBLY",
  "DIRECTOR_CUT",
  "LOCKED",
];

const VFX_STATUSES: VfxShotStatus[] = [
  "NOT_SENT",
  "IN_VENDOR",
  "CLIENT_REVIEW",
  "FINAL",
];

const DELIVERY_STATUSES: DeliveryChecklistStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETE",
];

const QC_STATUSES: PostIngestQcStatus[] = ["PENDING", "PASSED", "FAILED", "MISSING"];

const STATUS_BADGE_VARIANT: Record<string, "secondary" | "pre-production" | "completed" | "on-hold"> = {
  QUEUED: "secondary",
  IN_PROGRESS: "pre-production",
  COMPLETE: "completed",
  BLOCKED: "on-hold",
  ASSEMBLY: "secondary",
  DIRECTOR_CUT: "pre-production",
  LOCKED: "completed",
  NOT_SENT: "secondary",
  IN_VENDOR: "pre-production",
  CLIENT_REVIEW: "on-hold",
  FINAL: "completed",
  NOT_STARTED: "secondary",
  READY: "completed",
  IN_PROGRESS_READINESS: "pre-production",
  NOT_READY: "on-hold",
};

function formatStatus(value: string): string {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function countNotesForVersion(reviewNotes: EditReviewNote[], versionId: string): number {
  return reviewNotes.filter((note) => note.versionId === versionId).length;
}

function openNotesForVersion(reviewNotes: EditReviewNote[], versionId: string): number {
  return reviewNotes.filter((note) => note.versionId === versionId && note.status === "OPEN").length;
}

function itemsForBatch(items: PostIngestItem[], batchId: string): PostIngestItem[] {
  return items.filter((item) => item.batchId === batchId);
}

function unresolvedIssuesForBatch(issues: PostIssue[], batchId: string): PostIssue[] {
  return issues.filter((issue) => issue.batchId === batchId && issue.status !== "RESOLVED");
}

export function PostSection({ projectId, shootingDays, scenes }: PostSectionProps) {
  const [loading, setLoading] = React.useState(true);
  const [workspace, setWorkspace] = React.useState<PostWorkspaceData | null>(null);
  const [selectedDayId, setSelectedDayId] = React.useState<string>(shootingDays[0]?.id || "");
  const [selectedVersionId, setSelectedVersionId] = React.useState<string>("");
  const [selectedVfxShotId, setSelectedVfxShotId] = React.useState<string>("");
  const [creatingBatch, setCreatingBatch] = React.useState(false);
  const [syncingCallSheet, setSyncingCallSheet] = React.useState(false);
  const [ingestDrafts, setIngestDrafts] = React.useState<Record<string, IngestRowDraft>>({});
  const [reconcileDrafts, setReconcileDrafts] = React.useState<Record<string, string>>({});

  const [newVersionName, setNewVersionName] = React.useState("");
  const [newVersionStatus, setNewVersionStatus] = React.useState<EditVersionStatus>("ASSEMBLY");
  const [newVersionSourceRange, setNewVersionSourceRange] = React.useState("");
  const [creatingVersion, setCreatingVersion] = React.useState(false);

  const [newReviewTimecode, setNewReviewTimecode] = React.useState("");
  const [newReviewNote, setNewReviewNote] = React.useState("");
  const [creatingReviewNote, setCreatingReviewNote] = React.useState(false);

  const [newVfxSceneId, setNewVfxSceneId] = React.useState("");
  const [newVfxShotCode, setNewVfxShotCode] = React.useState("");
  const [newVfxVendor, setNewVfxVendor] = React.useState("");
  const [newVfxDueDate, setNewVfxDueDate] = React.useState("");
  const [creatingVfxShot, setCreatingVfxShot] = React.useState(false);

  const [newTurnoverPlates, setNewTurnoverPlates] = React.useState("");
  const [newTurnoverNotes, setNewTurnoverNotes] = React.useState("");
  const [creatingTurnover, setCreatingTurnover] = React.useState(false);

  const [newDeliveryType, setNewDeliveryType] = React.useState("");
  const [newDeliveryDueDate, setNewDeliveryDueDate] = React.useState("");
  const [creatingDelivery, setCreatingDelivery] = React.useState(false);

  const reloadWorkspace = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPostWorkspaceData(projectId);
      setWorkspace(data);

      if (!selectedVersionId && data.editVersions.length > 0) {
        setSelectedVersionId(data.editVersions[0].id);
      }

      if (!selectedVfxShotId && data.vfxShots.length > 0) {
        setSelectedVfxShotId(data.vfxShots[0].id);
      }
    } catch (error) {
      console.error("Failed to load post workspace", error);
      toast.error(error instanceof Error ? error.message : "Failed to load Post workspace.");
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedVersionId, selectedVfxShotId]);

  React.useEffect(() => {
    void reloadWorkspace();
  }, [reloadWorkspace]);

  const openAlerts = React.useMemo(
    () => (workspace?.dependencyAlerts || []).filter((alert) => alert.status === "OPEN"),
    [workspace]
  );

  const openBlockers = React.useMemo(
    () => openAlerts.filter((alert) => alert.severity === "BLOCKER"),
    [openAlerts]
  );

  const readyDays = React.useMemo(
    () => (workspace?.dayReadiness || []).filter((day) => day.status === "READY").length,
    [workspace]
  );

  const selectedVersion = React.useMemo(
    () => (workspace?.editVersions || []).find((version) => version.id === selectedVersionId) || null,
    [workspace, selectedVersionId]
  );

  const selectedVfxShot = React.useMemo(
    () => (workspace?.vfxShots || []).find((shot) => shot.id === selectedVfxShotId) || null,
    [workspace, selectedVfxShotId]
  );

  const handleCreateBatch = async () => {
    if (!selectedDayId) {
      toast.error("Choose a shooting day first.");
      return;
    }

    setCreatingBatch(true);
    try {
      await ensurePostIngestBatch({
        projectId,
        shootingDayId: selectedDayId,
      });
      toast.success("Post ingest batch is ready for that day.");
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create ingest batch.");
    } finally {
      setCreatingBatch(false);
    }
  };

  const handleSaveIngestItem = async (batchId: string) => {
    const draft = ingestDrafts[batchId];
    if (!draft?.roll?.trim()) {
      toast.error("Roll code is required.");
      return;
    }

    try {
      await upsertPostIngestItem({
        batchId,
        roll: draft.roll,
        qcStatus: draft.qcStatus,
        issue: draft.issue,
      });
      setIngestDrafts((previous) => ({
        ...previous,
        [batchId]: { roll: "", qcStatus: "PENDING", issue: "" },
      }));
      await reloadWorkspace();
      toast.success("Ingest item saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save ingest item.");
    }
  };

  const handleReconcileBatch = async (batchId: string) => {
    try {
      const rolls = (reconcileDrafts[batchId] || "")
        .split(",")
        .map((roll) => roll.trim())
        .filter(Boolean);

      const result = await reconcilePostIngestBatch({
        batchId,
        expectedRolls: rolls,
      });

      await reloadWorkspace();

      if (result.missingRolls.length > 0) {
        toast.warning(`Missing rolls: ${result.missingRolls.join(", ")}`);
      } else {
        toast.success("Ingest reconciliation complete.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reconcile ingest batch.");
    }
  };

  const handleSyncPostBlockers = async () => {
    if (!selectedDayId) {
      toast.error("Choose a shooting day first.");
      return;
    }

    setSyncingCallSheet(true);
    try {
      const result = await syncPostBlockersToCallSheet(selectedDayId);
      toast.success(
        result.blockerCount > 0
          ? `Synced ${result.blockerCount} post blocker${
              result.blockerCount === 1 ? "" : "s"
            } to call sheet notes.`
          : "No open post blockers. Existing auto-synced blocker notes were removed."
      );
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync call sheet blockers.");
    } finally {
      setSyncingCallSheet(false);
    }
  };

  const handleCreateEditVersion = async () => {
    const name = newVersionName.trim();
    if (!name) {
      toast.error("Version name is required.");
      return;
    }

    setCreatingVersion(true);
    try {
      const createdVersion = await createEditVersion({
        projectId,
        name,
        status: newVersionStatus,
        sourceRange: newVersionSourceRange,
      });

      setNewVersionName("");
      setNewVersionSourceRange("");
      setSelectedVersionId(createdVersion.id);
      await reloadWorkspace();
      toast.success("Edit version created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create edit version.");
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleUpdateVersionStatus = async (versionId: string, status: EditVersionStatus) => {
    try {
      await updateEditVersionStatus(versionId, status);
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update version status.");
    }
  };

  const handleCreateReviewNote = async () => {
    if (!selectedVersionId) {
      toast.error("Choose a version first.");
      return;
    }

    if (!newReviewTimecode.trim() || !newReviewNote.trim()) {
      toast.error("Timecode and note are required.");
      return;
    }

    setCreatingReviewNote(true);
    try {
      await createEditReviewNote({
        versionId: selectedVersionId,
        timecode: newReviewTimecode,
        note: newReviewNote,
      });

      setNewReviewTimecode("");
      setNewReviewNote("");
      await reloadWorkspace();
      toast.success("Review note added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create review note.");
    } finally {
      setCreatingReviewNote(false);
    }
  };

  const handleToggleReviewNote = async (note: EditReviewNote) => {
    const nextStatus = note.status === "OPEN" ? "RESOLVED" : "OPEN";

    try {
      await updateEditReviewNoteStatus(note.id, nextStatus);
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update review note.");
    }
  };

  const handleCreateVfxShot = async () => {
    const shotCode = newVfxShotCode.trim();
    if (!shotCode) {
      toast.error("Shot code is required.");
      return;
    }

    setCreatingVfxShot(true);
    try {
      const createdShot = await createVfxShot({
        projectId,
        sceneId: newVfxSceneId || null,
        shotCode,
        vendor: newVfxVendor || null,
        dueDate: newVfxDueDate || null,
      });

      setNewVfxShotCode("");
      setNewVfxVendor("");
      setNewVfxDueDate("");
      setSelectedVfxShotId(createdShot.id);
      await reloadWorkspace();
      toast.success("VFX shot added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create VFX shot.");
    } finally {
      setCreatingVfxShot(false);
    }
  };

  const handleUpdateVfxStatus = async (vfxShotId: string, status: VfxShotStatus) => {
    try {
      await updateVfxShotStatus(vfxShotId, status);
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update VFX shot status.");
    }
  };

  const handleCreateTurnover = async () => {
    if (!selectedVfxShotId) {
      toast.error("Choose a VFX shot first.");
      return;
    }

    setCreatingTurnover(true);
    try {
      await createVfxTurnover({
        vfxShotId: selectedVfxShotId,
        plateRefs: newTurnoverPlates,
        notes: newTurnoverNotes,
        sentAt: new Date().toISOString(),
      });

      setNewTurnoverPlates("");
      setNewTurnoverNotes("");
      await reloadWorkspace();
      toast.success("VFX turnover recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create VFX turnover.");
    } finally {
      setCreatingTurnover(false);
    }
  };

  const handleCreateDeliveryItem = async () => {
    if (!newDeliveryType.trim()) {
      toast.error("Delivery type is required.");
      return;
    }

    setCreatingDelivery(true);
    try {
      await createDeliveryChecklistItem({
        projectId,
        type: newDeliveryType,
        dueDate: newDeliveryDueDate || null,
      });

      setNewDeliveryType("");
      setNewDeliveryDueDate("");
      await reloadWorkspace();
      toast.success("Delivery checklist item created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create delivery item.");
    } finally {
      setCreatingDelivery(false);
    }
  };

  const handleUpdateDeliveryStatus = async (
    item: DeliveryChecklistItem,
    status: DeliveryChecklistStatus
  ) => {
    try {
      await updateDeliveryChecklistItemStatus(item.id, status);
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update delivery status.");
    }
  };

  if (loading || !workspace) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const reviewNotesForSelectedVersion = workspace.reviewNotes.filter(
    (note) => note.versionId === selectedVersionId
  );

  const selectedBatchForDay = workspace.ingestBatches.find(
    (batch) => batch.shootingDayId === selectedDayId
  );

  const referenceEntity = selectedBatchForDay
    ? {
        type: "POST:INGEST_BATCH",
        id: selectedBatchForDay.id,
      }
    : selectedDayId
      ? {
          type: "POST:SHOOTING_DAY",
          id: selectedDayId,
        }
      : {
          type: "POST:PROJECT",
          id: projectId,
        };

  const turnoversForSelectedShot = workspace.vfxTurnovers.filter(
    (turnover) => turnover.vfxShotId === selectedVfxShotId
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          title="Open Post Alerts"
          value={String(openAlerts.length)}
          subtitle={`${openBlockers.length} blockers`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          title="Ingest Batches"
          value={String(workspace.ingestBatches.length)}
          subtitle={`${workspace.issues.filter((issue) => issue.status !== "RESOLVED").length} open issues`}
          icon={<Film className="h-4 w-4" />}
        />
        <StatCard
          title="Edit Versions"
          value={String(workspace.editVersions.length)}
          subtitle={`${workspace.reviewNotes.filter((note) => note.status === "OPEN").length} open notes`}
          icon={<CircleDot className="h-4 w-4" />}
        />
        <StatCard
          title="Shoot Days Ready"
          value={String(readyDays)}
          subtitle={`${workspace.dayReadiness.length} tracked days`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[230px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Shooting day for call sheet sync
            </label>
            <select
              value={selectedDayId}
              onChange={(event) => setSelectedDayId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {shootingDays.map((day) => (
                <option key={day.id} value={day.id}>
                  Day {day.dayNumber} - {format(new Date(day.date), "EEE MMM d")}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={handleSyncPostBlockers}
            disabled={!selectedDayId || syncingCallSheet}
          >
            {syncingCallSheet ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Sync blockers to call sheet
          </Button>
          <Button variant="ghost" onClick={() => void reloadWorkspace()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dailies" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dailies">Dailies + QC</TabsTrigger>
          <TabsTrigger value="cuts">Cuts + Reviews</TabsTrigger>
          <TabsTrigger value="vfx">VFX + Deliverables</TabsTrigger>
        </TabsList>

        <TabsContent value="dailies" className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">Create or open a post ingest batch</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Shooting day
                </label>
                <select
                  value={selectedDayId}
                  onChange={(event) => setSelectedDayId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {shootingDays.map((day) => (
                    <option key={day.id} value={day.id}>
                      Day {day.dayNumber} - {format(new Date(day.date), "EEE MMM d")}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="skeuo" onClick={handleCreateBatch} disabled={!selectedDayId || creatingBatch}>
                {creatingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Prepare ingest batch
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {workspace.ingestBatches.length === 0 ? (
              <EmptyState
                title="No ingest batches yet"
                description="Create a batch for a shooting day to start dailies reconciliation and QC."
              />
            ) : (
              workspace.ingestBatches.map((batch) => {
                const batchItems = itemsForBatch(workspace.ingestItems, batch.id);
                const unresolvedBatchIssues = unresolvedIssuesForBatch(workspace.issues, batch.id);
                const draft = ingestDrafts[batch.id] || {
                  roll: "",
                  qcStatus: "PENDING",
                  issue: "",
                };

                return (
                  <div key={batch.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          Day {shootingDays.find((day) => day.id === batch.shootingDayId)?.dayNumber || "?"} ingest batch
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Received {batch.receivedRollCount} / Expected {batch.expectedRollCount} | Passed {batch.qcPassedCount} | Failed {batch.qcFailedCount} | Missing {batch.missingRollCount}
                        </p>
                      </div>
                      <Badge variant={STATUS_BADGE_VARIANT[batch.status] || "secondary"}>
                        {formatStatus(batch.status)}
                      </Badge>
                    </div>

                    <div className="mb-3 grid gap-2 md:grid-cols-[1fr_130px_1fr_auto]">
                      <Input
                        placeholder="Roll code (e.g. A003C001)"
                        value={draft.roll}
                        onChange={(event) =>
                          setIngestDrafts((previous) => ({
                            ...previous,
                            [batch.id]: { ...draft, roll: event.target.value },
                          }))
                        }
                      />
                      <select
                        value={draft.qcStatus}
                        onChange={(event) =>
                          setIngestDrafts((previous) => ({
                            ...previous,
                            [batch.id]: {
                              ...draft,
                              qcStatus: event.target.value as PostIngestQcStatus,
                            },
                          }))
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {QC_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="QC issue (optional)"
                        value={draft.issue}
                        onChange={(event) =>
                          setIngestDrafts((previous) => ({
                            ...previous,
                            [batch.id]: { ...draft, issue: event.target.value },
                          }))
                        }
                      />
                      <Button variant="outline" onClick={() => void handleSaveIngestItem(batch.id)}>
                        Save item
                      </Button>
                    </div>

                    <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Expected rolls for reconcile (comma separated)"
                        value={reconcileDrafts[batch.id] || ""}
                        onChange={(event) =>
                          setReconcileDrafts((previous) => ({
                            ...previous,
                            [batch.id]: event.target.value,
                          }))
                        }
                      />
                      <Button variant="outline" onClick={() => void handleReconcileBatch(batch.id)}>
                        Reconcile
                      </Button>
                    </div>

                    {batchItems.length > 0 && (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">Roll</th>
                              <th className="px-3 py-2 text-left">QC</th>
                              <th className="px-3 py-2 text-left">Issue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchItems.map((item) => (
                              <tr key={item.id} className="border-t border-border">
                                <td className="px-3 py-2 font-mono text-xs">{item.roll}</td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant={
                                      item.qcStatus === "PASSED"
                                        ? "completed"
                                        : item.qcStatus === "PENDING"
                                          ? "secondary"
                                          : "on-hold"
                                    }
                                  >
                                    {formatStatus(item.qcStatus)}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {item.issue || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {unresolvedBatchIssues.length > 0 && (
                      <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-100/40 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-200">
                        <p className="mb-1 font-semibold">Open camera follow-ups</p>
                        <ul className="space-y-1">
                          {unresolvedBatchIssues.map((issue) => (
                            <li key={issue.id}>• {issue.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="cuts" className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">Create edit version</h3>
            <div className="grid gap-2 md:grid-cols-[1fr_170px_1fr_auto]">
              <Input
                placeholder="Version name (e.g. Ep1 Director Cut v02)"
                value={newVersionName}
                onChange={(event) => setNewVersionName(event.target.value)}
              />
              <select
                value={newVersionStatus}
                onChange={(event) => setNewVersionStatus(event.target.value as EditVersionStatus)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {VERSION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Source range (optional)"
                value={newVersionSourceRange}
                onChange={(event) => setNewVersionSourceRange(event.target.value)}
              />
              <Button variant="skeuo" onClick={handleCreateEditVersion} disabled={creatingVersion}>
                {creatingVersion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Versions</h3>
              {workspace.editVersions.length === 0 ? (
                <EmptyState
                  title="No versions yet"
                  description="Create an edit version to centralize review feedback."
                />
              ) : (
                <div className="space-y-2">
                  {workspace.editVersions.map((version) => {
                    const isSelected = version.id === selectedVersionId;
                    const openNotes = openNotesForVersion(workspace.reviewNotes, version.id);

                    return (
                      <button
                        key={version.id}
                        type="button"
                        onClick={() => setSelectedVersionId(version.id)}
                        className={`w-full rounded-md border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{version.name}</p>
                          <Badge variant={STATUS_BADGE_VARIANT[version.status] || "secondary"}>
                            {formatStatus(version.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {countNotesForVersion(workspace.reviewNotes, version.id)} total note
                          {countNotesForVersion(workspace.reviewNotes, version.id) === 1 ? "" : "s"} | {openNotes} open
                        </p>
                        <div className="mt-2">
                          <select
                            value={version.status}
                            onChange={(event) =>
                              void handleUpdateVersionStatus(
                                version.id,
                                event.target.value as EditVersionStatus
                              )
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {VERSION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {formatStatus(status)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Review notes</h3>
              {selectedVersion ? (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {selectedVersion.name}
                  </p>

                  <div className="mb-3 grid gap-2 md:grid-cols-[140px_1fr_auto]">
                    <Input
                      placeholder="Timecode"
                      value={newReviewTimecode}
                      onChange={(event) => setNewReviewTimecode(event.target.value)}
                    />
                    <Input
                      placeholder="Add note"
                      value={newReviewNote}
                      onChange={(event) => setNewReviewNote(event.target.value)}
                    />
                    <Button variant="skeuo" onClick={handleCreateReviewNote} disabled={creatingReviewNote}>
                      {creatingReviewNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Add
                    </Button>
                  </div>

                  {reviewNotesForSelectedVersion.length > 0 ? (
                    <div className="space-y-2">
                      {reviewNotesForSelectedVersion.map((note) => (
                        <div key={note.id} className="rounded-md border border-border p-2">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{note.timecode}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => void handleToggleReviewNote(note)}
                            >
                              {note.status === "OPEN" ? "Resolve" : "Re-open"}
                            </Button>
                          </div>
                          <p className="text-sm">{note.note}</p>
                          <Badge
                            variant={note.status === "OPEN" ? "on-hold" : "completed"}
                            className="mt-2"
                          >
                            {formatStatus(note.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No notes yet"
                      description="Add timecode notes to track review feedback against this version."
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  title="Select a version"
                  description="Choose an edit version to view and manage review notes."
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vfx" className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">Create VFX shot</h3>
            <div className="grid gap-2 md:grid-cols-[170px_200px_1fr_170px_auto]">
              <select
                value={newVfxSceneId}
                onChange={(event) => setNewVfxSceneId(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No linked scene</option>
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    Scene {scene.sceneNumber}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Shot code"
                value={newVfxShotCode}
                onChange={(event) => setNewVfxShotCode(event.target.value)}
              />
              <Input
                placeholder="Vendor"
                value={newVfxVendor}
                onChange={(event) => setNewVfxVendor(event.target.value)}
              />
              <Input
                type="date"
                value={newVfxDueDate}
                onChange={(event) => setNewVfxDueDate(event.target.value)}
              />
              <Button variant="skeuo" onClick={handleCreateVfxShot} disabled={creatingVfxShot}>
                {creatingVfxShot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">VFX board</h3>
              {workspace.vfxShots.length === 0 ? (
                <EmptyState
                  title="No VFX shots yet"
                  description="Track VFX lifecycle from turnover to final approval."
                />
              ) : (
                <div className="space-y-2">
                  {workspace.vfxShots.map((shot) => (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => setSelectedVfxShotId(shot.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        shot.id === selectedVfxShotId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{shot.shotCode}</p>
                        <Badge variant={STATUS_BADGE_VARIANT[shot.status] || "secondary"}>
                          {formatStatus(shot.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {shot.vendor || "No vendor"}
                        {shot.dueDate ? ` | Due ${format(new Date(shot.dueDate), "MMM d")}` : ""}
                      </p>
                      <div className="mt-2">
                        <select
                          value={shot.status}
                          onChange={(event) =>
                            void handleUpdateVfxStatus(
                              shot.id,
                              event.target.value as VfxShotStatus
                            )
                          }
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {VFX_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {formatStatus(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-2 text-sm font-semibold">Turnover logs</h3>
                {selectedVfxShot ? (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {selectedVfxShot.shotCode}
                    </p>
                    <Input
                      placeholder="Plate refs"
                      value={newTurnoverPlates}
                      onChange={(event) => setNewTurnoverPlates(event.target.value)}
                      className="mb-2"
                    />
                    <Textarea
                      placeholder="Turnover notes"
                      value={newTurnoverNotes}
                      onChange={(event) => setNewTurnoverNotes(event.target.value)}
                      rows={3}
                    />
                    <Button
                      variant="skeuo"
                      className="mt-2"
                      onClick={handleCreateTurnover}
                      disabled={creatingTurnover}
                    >
                      {creatingTurnover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Add turnover
                    </Button>

                    {turnoversForSelectedShot.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {turnoversForSelectedShot.map((turnover) => (
                          <div key={turnover.id} className="rounded-md border border-border p-2 text-xs">
                            <p className="font-medium">{turnover.plateRefs || "No plate refs"}</p>
                            <p className="text-muted-foreground">{turnover.notes || "No notes"}</p>
                            <p className="mt-1 text-muted-foreground">
                              Sent {format(new Date(turnover.sentAt || turnover.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    title="Select a VFX shot"
                    description="Choose a VFX shot to log turnovers and plate references."
                  />
                )}
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-semibold">Delivery checklist</h3>
                <div className="mb-3 grid gap-2 md:grid-cols-[1fr_170px_auto]">
                  <Input
                    placeholder="Item type (e.g. 4K Master, Captions, M&E Stems)"
                    value={newDeliveryType}
                    onChange={(event) => setNewDeliveryType(event.target.value)}
                  />
                  <Input
                    type="date"
                    value={newDeliveryDueDate}
                    onChange={(event) => setNewDeliveryDueDate(event.target.value)}
                  />
                  <Button variant="skeuo" onClick={handleCreateDeliveryItem} disabled={creatingDelivery}>
                    {creatingDelivery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add
                  </Button>
                </div>

                {workspace.deliveryChecklist.length > 0 ? (
                  <div className="space-y-2">
                    {workspace.deliveryChecklist.map((item) => (
                      <div key={item.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.type}</p>
                          <select
                            value={item.status}
                            onChange={(event) =>
                              void handleUpdateDeliveryStatus(
                                item,
                                event.target.value as DeliveryChecklistStatus
                              )
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            {DELIVERY_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {formatStatus(status)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {item.dueDate ? format(new Date(item.dueDate), "MMM d, yyyy") : "Not set"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No delivery items"
                    description="Track final masters, captions, stems, and QC deliverables here."
                  />
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-3">
        <DayAlertsPanel
          projectId={projectId}
          shootingDayId={selectedDayId || undefined}
          department="POST"
          title="Post Day Alerts"
        />
        <AttachmentPanel
          projectId={projectId}
          entityType={referenceEntity.type}
          entityId={referenceEntity.id}
          title="Post Attachments"
        />
        <CommentThreadPanel
          projectId={projectId}
          entityType={referenceEntity.type}
          entityId={referenceEntity.id}
          title="Post Notes"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
        <span>{icon}</span>
      </div>
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
