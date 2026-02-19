"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Paintbrush2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ShootingDay } from "@/lib/types";
import type { Scene as DBScene } from "@/lib/actions/scenes";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";
import {
  addArtContinuityPhoto,
  assignArtCrewToWorkOrder,
  createArtContinuityEntry,
  createArtPullItem,
  createArtPullListFromScene,
  createArtWorkOrder,
  deleteArtContinuityPhoto,
  getArtDependenciesForShootingDay,
  getArtWorkspaceData,
  refreshArtDependenciesForShootingDay,
  setArtWorkOrderScenes,
  syncArtBlockersToCallSheet,
  syncArtPullItemToBudget,
  updateArtContinuityEntry,
  updateArtPullItem,
  updateArtPullItemStatus,
  updateArtWorkOrder,
  type ArtContinuityEntry,
  type ArtContinuitySubjectType,
  type ArtDayReadiness,
  type ArtPullItemStatus,
  type ArtWorkOrderStatus,
  type ArtWorkOrderType,
  type ArtWorkspaceData,
} from "@/lib/actions/art-department";
import {
  createDepartmentAttachment,
  getDepartmentAttachments,
  type DepartmentAttachment,
} from "@/lib/actions/departments-attachments";
import {
  createDepartmentComment,
  getDepartmentComments,
  type DepartmentComment,
} from "@/lib/actions/departments-comments";
import {
  resolveDepartmentDependencyBySource,
  type DepartmentDayDependency,
} from "@/lib/actions/departments-readiness";

interface ArtSectionProps {
  projectId: string;
  scenes: DBScene[];
  shootingDays: ShootingDay[];
  crew: CrewMemberWithInviteStatus[];
}

const PULL_ITEM_STATUSES: ArtPullItemStatus[] = [
  "TO_SOURCE",
  "PULLED",
  "ON_TRUCK",
  "ON_SET",
  "WRAPPED",
];

const WORK_ORDER_TYPES: ArtWorkOrderType[] = ["BUILD", "PAINT", "SET_DRESS", "STRIKE"];
const WORK_ORDER_STATUSES: ArtWorkOrderStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
];

const CONTINUITY_SUBJECT_TYPES: ArtContinuitySubjectType[] = [
  "CHARACTER",
  "SET",
  "PROP",
  "WARDROBE",
  "OTHER",
];

function formatStatus(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function ArtSection({ projectId, scenes, shootingDays, crew }: ArtSectionProps) {
  const [workspace, setWorkspace] = React.useState<ArtWorkspaceData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [selectedListId, setSelectedListId] = React.useState<string>("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = React.useState<string>("");
  const [selectedContinuityId, setSelectedContinuityId] = React.useState<string>("");
  const [selectedDependencyDayId, setSelectedDependencyDayId] = React.useState<string>(
    shootingDays[0]?.id || "",
  );

  const [dayReadiness, setDayReadiness] = React.useState<ArtDayReadiness | null>(null);
  const [dayAlerts, setDayAlerts] = React.useState<DepartmentDayDependency[]>([]);
  const [loadingDayReadiness, setLoadingDayReadiness] = React.useState(false);
  const [syncingCallSheet, setSyncingCallSheet] = React.useState(false);

  const [continuityAttachments, setContinuityAttachments] = React.useState<DepartmentAttachment[]>(
    [],
  );
  const [continuityComments, setContinuityComments] = React.useState<DepartmentComment[]>([]);
  const [loadingCollab, setLoadingCollab] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  const [attachmentUrl, setAttachmentUrl] = React.useState("");
  const [attachmentName, setAttachmentName] = React.useState("");
  const [continuityPhotoUrl, setContinuityPhotoUrl] = React.useState("");
  const [continuityPhotoAngle, setContinuityPhotoAngle] = React.useState("");
  const [continuityPhotoLookType, setContinuityPhotoLookType] = React.useState("");
  const [addingContinuityPhoto, setAddingContinuityPhoto] = React.useState(false);

  const [continuityFilterType, setContinuityFilterType] = React.useState<
    ArtContinuitySubjectType | "ALL"
  >("ALL");
  const [continuityFilterScriptDay, setContinuityFilterScriptDay] = React.useState("");
  const [continuityFilterSearch, setContinuityFilterSearch] = React.useState("");
  const [continuityFilterStatus, setContinuityFilterStatus] = React.useState<
    "ALL" | "OPEN" | "RESOLVED"
  >("ALL");

  const [generatorSceneId, setGeneratorSceneId] = React.useState(scenes[0]?.id || "");
  const [generatorDayId, setGeneratorDayId] = React.useState<string>("");
  const [generatorOwnerCrewId, setGeneratorOwnerCrewId] = React.useState<string>("");
  const [generating, setGenerating] = React.useState(false);

  const [newPullItemName, setNewPullItemName] = React.useState("");
  const [newPullItemQty, setNewPullItemQty] = React.useState("1");
  const [newPullItemDueDayId, setNewPullItemDueDayId] = React.useState<string>("");
  const [creatingPullItem, setCreatingPullItem] = React.useState(false);

  const [continuitySceneId, setContinuitySceneId] = React.useState(scenes[0]?.id || "");
  const [continuitySubjectType, setContinuitySubjectType] =
    React.useState<ArtContinuitySubjectType>("SET");
  const [continuitySubjectName, setContinuitySubjectName] = React.useState("");
  const [continuityScriptDay, setContinuityScriptDay] = React.useState("");
  const [continuityDueDayId, setContinuityDueDayId] = React.useState("");
  const [continuityNotes, setContinuityNotes] = React.useState("");
  const [creatingContinuity, setCreatingContinuity] = React.useState(false);

  const [newWorkOrderType, setNewWorkOrderType] = React.useState<ArtWorkOrderType>("BUILD");
  const [newWorkOrderLocationId, setNewWorkOrderLocationId] = React.useState("");
  const [newWorkOrderSceneIds, setNewWorkOrderSceneIds] = React.useState<string>("");
  const [newWorkOrderStartDayId, setNewWorkOrderStartDayId] = React.useState("");
  const [newWorkOrderEndDayId, setNewWorkOrderEndDayId] = React.useState("");
  const [newWorkOrderSummary, setNewWorkOrderSummary] = React.useState("");
  const [creatingWorkOrder, setCreatingWorkOrder] = React.useState(false);

  const [assignCrewId, setAssignCrewId] = React.useState("");
  const [assignHours, setAssignHours] = React.useState("8");
  const [assigningCrew, setAssigningCrew] = React.useState(false);

  const reloadWorkspace = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArtWorkspaceData(projectId);
      setWorkspace(data);

      if (!selectedListId && data.pullLists.length > 0) {
        setSelectedListId(data.pullLists[0].id);
      }
      if (!selectedWorkOrderId && data.workOrders.length > 0) {
        setSelectedWorkOrderId(data.workOrders[0].id);
      }
      if (!selectedContinuityId && data.continuityEntries.length > 0) {
        setSelectedContinuityId(data.continuityEntries[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Art workspace.");
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedContinuityId, selectedListId, selectedWorkOrderId]);

  React.useEffect(() => {
    void reloadWorkspace();
  }, [reloadWorkspace]);

  const loadDayReadiness = React.useCallback(async () => {
    if (!selectedDependencyDayId) {
      setDayReadiness(null);
      setDayAlerts([]);
      return;
    }

    setLoadingDayReadiness(true);
    try {
      const { readiness, alerts } = await getArtDependenciesForShootingDay(
        projectId,
        selectedDependencyDayId,
      );
      setDayReadiness(readiness);
      setDayAlerts(alerts);
    } catch (error) {
      console.error(error);
      setDayReadiness(null);
      setDayAlerts([]);
      toast.error(
        error instanceof Error ? error.message : "Failed to load Art day readiness.",
      );
    } finally {
      setLoadingDayReadiness(false);
    }
  }, [projectId, selectedDependencyDayId]);

  React.useEffect(() => {
    void loadDayReadiness();
  }, [loadDayReadiness]);

  const selectedList = React.useMemo(
    () => workspace?.pullLists.find((list) => list.id === selectedListId) || null,
    [workspace?.pullLists, selectedListId],
  );
  const selectedWorkOrder = React.useMemo(
    () => workspace?.workOrders.find((order) => order.id === selectedWorkOrderId) || null,
    [workspace?.workOrders, selectedWorkOrderId],
  );
  const selectedContinuity = React.useMemo(
    () =>
      workspace?.continuityEntries.find((entry) => entry.id === selectedContinuityId) || null,
    [workspace?.continuityEntries, selectedContinuityId],
  );

  const pullItems = React.useMemo(
    () =>
      (workspace?.pullItems || []).filter((item) => item.listId === selectedListId),
    [selectedListId, workspace?.pullItems],
  );

  const selectedWorkOrderCrewAssignments = React.useMemo(
    () =>
      (workspace?.crewAssignments || []).filter(
        (assignment) => assignment.workOrderId === selectedWorkOrderId,
      ),
    [selectedWorkOrderId, workspace?.crewAssignments],
  );

  const selectedWorkOrderSceneIds = React.useMemo(
    () =>
      (workspace?.workOrderScenes || [])
        .filter((link) => link.workOrderId === selectedWorkOrderId)
        .map((link) => link.sceneId),
    [selectedWorkOrderId, workspace?.workOrderScenes],
  );

  const sceneLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    scenes.forEach((scene) => {
      map.set(scene.id, `Scene ${scene.sceneNumber}`);
    });
    return map;
  }, [scenes]);

  const crewNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    crew.forEach((member) => map.set(member.id, member.name));
    return map;
  }, [crew]);

  const continuityPhotos = React.useMemo(
    () =>
      (workspace?.continuityPhotos || []).filter((photo) => photo.entryId === selectedContinuityId),
    [selectedContinuityId, workspace?.continuityPhotos],
  );

  const continuityScriptDayOptions = React.useMemo(() => {
    const values = new Set<string>();
    (workspace?.continuityEntries || []).forEach((entry) => {
      if (entry.scriptDay?.trim()) values.add(entry.scriptDay.trim());
    });
    return Array.from(values).sort();
  }, [workspace?.continuityEntries]);

  const filteredContinuityEntries = React.useMemo(() => {
    return (workspace?.continuityEntries || []).filter((entry) => {
      if (continuityFilterType !== "ALL" && entry.subjectType !== continuityFilterType) {
        return false;
      }

      if (continuityFilterStatus === "OPEN" && entry.isResolved) {
        return false;
      }
      if (continuityFilterStatus === "RESOLVED" && !entry.isResolved) {
        return false;
      }

      if (
        continuityFilterScriptDay.trim().length > 0 &&
        (entry.scriptDay || "").trim() !== continuityFilterScriptDay.trim()
      ) {
        return false;
      }

      const search = continuityFilterSearch.trim().toLowerCase();
      if (!search) return true;

      return (
        entry.subjectName.toLowerCase().includes(search) ||
        (entry.notes || "").toLowerCase().includes(search)
      );
    });
  }, [
    continuityFilterScriptDay,
    continuityFilterSearch,
    continuityFilterStatus,
    continuityFilterType,
    workspace?.continuityEntries,
  ]);

  const workOrderConflicts = React.useMemo(() => {
    const dayNumberById = new Map<string, number>();
    shootingDays.forEach((day) => dayNumberById.set(day.id, day.dayNumber));

    const activeOrders = (workspace?.workOrders || []).filter(
      (order) => order.status !== "DONE" && Boolean(order.locationId),
    );
    const conflicts: Array<{
      key: string;
      locationId: string;
      aLabel: string;
      bLabel: string;
      window: string;
    }> = [];

    for (let i = 0; i < activeOrders.length; i += 1) {
      const first = activeOrders[i];
      const firstStart = first.startDayId
        ? dayNumberById.get(first.startDayId) || null
        : null;
      const firstEnd = first.endDayId ? dayNumberById.get(first.endDayId) || firstStart : firstStart;
      if (!firstStart || !firstEnd) continue;
      const firstMin = Math.min(firstStart, firstEnd);
      const firstMax = Math.max(firstStart, firstEnd);

      for (let j = i + 1; j < activeOrders.length; j += 1) {
        const second = activeOrders[j];
        if (!second.locationId || second.locationId !== first.locationId) continue;

        const secondStart = second.startDayId
          ? dayNumberById.get(second.startDayId) || null
          : null;
        const secondEnd = second.endDayId
          ? dayNumberById.get(second.endDayId) || secondStart
          : secondStart;
        if (!secondStart || !secondEnd) continue;
        const secondMin = Math.min(secondStart, secondEnd);
        const secondMax = Math.max(secondStart, secondEnd);

        const overlapStart = Math.max(firstMin, secondMin);
        const overlapEnd = Math.min(firstMax, secondMax);
        if (overlapStart > overlapEnd) continue;

        conflicts.push({
          key: `${first.id}:${second.id}`,
          locationId: first.locationId,
          aLabel: first.summary || formatStatus(first.type),
          bLabel: second.summary || formatStatus(second.type),
          window:
            overlapStart === overlapEnd
              ? `Day ${overlapStart}`
              : `Day ${overlapStart}-${overlapEnd}`,
        });
      }
    }

    return conflicts;
  }, [shootingDays, workspace?.workOrders]);

  const loadContinuityCollaboration = React.useCallback(async () => {
    if (!selectedContinuityId) {
      setContinuityAttachments([]);
      setContinuityComments([]);
      return;
    }

    setLoadingCollab(true);
    try {
      const [attachmentsResult, commentsResult] = await Promise.all([
        getDepartmentAttachments(projectId, "ART_CONTINUITY_ENTRY", selectedContinuityId),
        getDepartmentComments(projectId, "ART_CONTINUITY_ENTRY", selectedContinuityId),
      ]);

      setContinuityAttachments(attachmentsResult.data || []);
      setContinuityComments(commentsResult.data?.comments || []);
    } catch (error) {
      console.error(error);
      setContinuityAttachments([]);
      setContinuityComments([]);
    } finally {
      setLoadingCollab(false);
    }
  }, [projectId, selectedContinuityId]);

  React.useEffect(() => {
    void loadContinuityCollaboration();
  }, [loadContinuityCollaboration]);

  const handleGeneratePullList = async () => {
    if (!generatorSceneId) {
      toast.error("Select a scene first.");
      return;
    }

    setGenerating(true);
    try {
      const result = await createArtPullListFromScene({
        projectId,
        sceneId: generatorSceneId,
        shootingDayId: generatorDayId || null,
        ownerCrewId: generatorOwnerCrewId || null,
        overwriteExisting: true,
      });
      setSelectedListId(result.pullList.id);
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success(
        result.createdItemCount > 0
          ? `Generated pull list with ${result.createdItemCount} item${
              result.createdItemCount === 1 ? "" : "s"
            }.`
          : "Pull list created. No Art-tagged scene elements were found to auto-populate.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate Art pull list.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreatePullItem = async () => {
    if (!selectedListId) {
      toast.error("Select a pull list first.");
      return;
    }
    if (!newPullItemName.trim()) {
      toast.error("Item name is required.");
      return;
    }

    setCreatingPullItem(true);
    try {
      await createArtPullItem({
        listId: selectedListId,
        name: newPullItemName,
        qty: Number(newPullItemQty || 1),
        dueDayId: newPullItemDueDayId || null,
      });
      setNewPullItemName("");
      setNewPullItemQty("1");
      setNewPullItemDueDayId("");
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success("Art pull item added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add pull item.");
    } finally {
      setCreatingPullItem(false);
    }
  };

  const handleUpdatePullItemStatus = async (itemId: string, status: ArtPullItemStatus) => {
    try {
      await updateArtPullItemStatus(itemId, status);
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update item status.");
    }
  };

  const handleUpdatePullItemDueDay = async (itemId: string, dueDayId: string) => {
    try {
      await updateArtPullItem(itemId, { dueDayId: dueDayId || null });
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update due day.");
    }
  };

  const handleSyncPullItemToBudget = async (itemId: string) => {
    try {
      const result = await syncArtPullItemToBudget({ pullItemId: itemId });
      toast.success(`Synced to budget line item ${result.lineItemId}.`);
      await reloadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync item to budget.");
    }
  };

  const handleCreateContinuity = async () => {
    if (!continuitySceneId) {
      toast.error("Select a scene first.");
      return;
    }
    if (!continuitySubjectName.trim()) {
      toast.error("Continuity subject is required.");
      return;
    }

    setCreatingContinuity(true);
    try {
      const entry = await createArtContinuityEntry({
        projectId,
        sceneId: continuitySceneId,
        subjectType: continuitySubjectType,
        subjectName: continuitySubjectName,
        scriptDay: continuityScriptDay,
        dueDayId: continuityDueDayId || null,
        notes: continuityNotes,
      });
      setSelectedContinuityId(entry.id);
      setContinuitySubjectName("");
      setContinuityScriptDay("");
      setContinuityDueDayId("");
      setContinuityNotes("");
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success("Continuity entry created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create continuity entry.");
    } finally {
      setCreatingContinuity(false);
    }
  };

  const handleResolveContinuity = async (entry: ArtContinuityEntry, isResolved: boolean) => {
    try {
      await updateArtContinuityEntry(entry.id, { isResolved });
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success(isResolved ? "Continuity risk resolved." : "Continuity risk reopened.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update continuity status.");
    }
  };

  const handleAddContinuityPhoto = async () => {
    if (!selectedContinuityId) {
      toast.error("Select a continuity entry first.");
      return;
    }
    if (!continuityPhotoUrl.trim()) {
      toast.error("Photo URL is required.");
      return;
    }

    setAddingContinuityPhoto(true);
    try {
      await addArtContinuityPhoto({
        entryId: selectedContinuityId,
        fileUrl: continuityPhotoUrl.trim(),
        angle: continuityPhotoAngle || null,
        lookType: continuityPhotoLookType || null,
      });
      setContinuityPhotoUrl("");
      setContinuityPhotoAngle("");
      setContinuityPhotoLookType("");
      await reloadWorkspace();
      toast.success("Continuity photo added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add continuity photo.");
    } finally {
      setAddingContinuityPhoto(false);
    }
  };

  const handleDeleteContinuityPhoto = async (photoId: string) => {
    try {
      await deleteArtContinuityPhoto(photoId);
      await reloadWorkspace();
      toast.success("Continuity photo removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove continuity photo.");
    }
  };

  const handleCreateContinuityComment = async () => {
    if (!selectedContinuityId || !newComment.trim()) return;
    try {
      const result = await createDepartmentComment({
        projectId,
        entityType: "ART_CONTINUITY_ENTRY",
        entityId: selectedContinuityId,
        body: newComment,
      });
      if (result.error) {
        throw new Error(result.error);
      }
      setNewComment("");
      await loadContinuityCollaboration();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment.");
    }
  };

  const handleCreateContinuityAttachment = async () => {
    if (!selectedContinuityId || !attachmentUrl.trim()) return;
    try {
      const result = await createDepartmentAttachment({
        projectId,
        entityType: "ART_CONTINUITY_ENTRY",
        entityId: selectedContinuityId,
        fileUrl: attachmentUrl.trim(),
        fileName: attachmentName.trim() || undefined,
      });
      if (result.error) {
        throw new Error(result.error);
      }
      setAttachmentUrl("");
      setAttachmentName("");
      await loadContinuityCollaboration();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add attachment.");
    }
  };

  const handleCreateWorkOrder = async () => {
    setCreatingWorkOrder(true);
    try {
      const sceneIds = newWorkOrderSceneIds
        .split(",")
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((sceneNumber) =>
          scenes.find((scene) => scene.sceneNumber.toLowerCase() === sceneNumber.toLowerCase())?.id,
        )
        .filter((value): value is string => Boolean(value));

      const workOrder = await createArtWorkOrder({
        projectId,
        locationId: newWorkOrderLocationId || null,
        type: newWorkOrderType,
        startDayId: newWorkOrderStartDayId || null,
        endDayId: newWorkOrderEndDayId || null,
        summary: newWorkOrderSummary,
        sceneIds,
      });
      setSelectedWorkOrderId(workOrder.id);
      setNewWorkOrderSceneIds("");
      setNewWorkOrderSummary("");
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success("Work order created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create work order.");
    } finally {
      setCreatingWorkOrder(false);
    }
  };

  const handleUpdateWorkOrderStatus = async (workOrderId: string, status: ArtWorkOrderStatus) => {
    try {
      await updateArtWorkOrder(workOrderId, { status });
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update work order.");
    }
  };

  const handleSaveWorkOrderScenes = async () => {
    if (!selectedWorkOrderId) return;
    const sceneIds = newWorkOrderSceneIds
      .split(",")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((sceneNumber) =>
        scenes.find((scene) => scene.sceneNumber.toLowerCase() === sceneNumber.toLowerCase())?.id,
      )
      .filter((value): value is string => Boolean(value));

    try {
      await setArtWorkOrderScenes(selectedWorkOrderId, sceneIds);
      await reloadWorkspace();
      toast.success("Work order scenes updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update linked scenes.");
    }
  };

  const handleAssignCrew = async () => {
    if (!selectedWorkOrderId || !assignCrewId) {
      toast.error("Choose a work order and crew member.");
      return;
    }

    setAssigningCrew(true);
    try {
      await assignArtCrewToWorkOrder({
        workOrderId: selectedWorkOrderId,
        crewMemberId: assignCrewId,
        hours: Number(assignHours || "0"),
      });
      setAssignCrewId("");
      setAssignHours("8");
      await reloadWorkspace();
      toast.success("Crew assigned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign crew.");
    } finally {
      setAssigningCrew(false);
    }
  };

  const handleRefreshDependencies = async () => {
    if (!selectedDependencyDayId) return;
    try {
      await refreshArtDependenciesForShootingDay(projectId, selectedDependencyDayId);
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success("Art readiness dependencies refreshed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh Art dependencies.",
      );
    }
  };

  const handleResolveDependency = async (alert: DepartmentDayDependency) => {
    try {
      const result = await resolveDepartmentDependencyBySource(
        projectId,
        alert.shootingDayId,
        alert.department,
        alert.sourceType,
        alert.sourceId,
      );
      if (!result.success) {
        throw new Error(result.error || "Failed to resolve dependency");
      }
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      toast.success("Dependency resolved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve dependency.");
    }
  };

  const handleSyncCallSheet = async () => {
    if (!selectedDependencyDayId) return;
    setSyncingCallSheet(true);
    try {
      const result = await syncArtBlockersToCallSheet(selectedDependencyDayId);
      await Promise.all([reloadWorkspace(), loadDayReadiness()]);
      if (result.blockerCount > 0) {
        toast.success(
          `Synced ${result.blockerCount} Art blocker${result.blockerCount === 1 ? "" : "s"} to call sheet.`,
        );
      } else {
        toast.success("No open Art blockers. Auto blocker notes were cleared.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync call sheet blockers.");
    } finally {
      setSyncingCallSheet(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
        <Paintbrush2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
        <h3 className="mb-1 font-medium">Art workspace unavailable</h3>
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load Art workflow data for this project.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Art Department</h3>
          <p className="text-xs text-muted-foreground">
            Continuity, pull lists, build/strike tracking, and day-readiness blockers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reloadWorkspace()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="pull-lists" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pull-lists">Pull Lists</TabsTrigger>
          <TabsTrigger value="continuity">Continuity</TabsTrigger>
          <TabsTrigger value="build-strike">Build/Strike</TabsTrigger>
          <TabsTrigger value="readiness">Readiness</TabsTrigger>
        </TabsList>

        <TabsContent value="pull-lists" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Auto-generate From Scene
            </p>
            <div className="grid gap-2 md:grid-cols-4">
              <Select
                value={generatorSceneId}
                onChange={(event) => setGeneratorSceneId(event.target.value)}
                options={[
                  { value: "", label: "Select scene" },
                  ...scenes.map((scene) => ({
                    value: scene.id,
                    label: `Scene ${scene.sceneNumber}`,
                  })),
                ]}
              />
              <Select
                value={generatorDayId}
                onChange={(event) => setGeneratorDayId(event.target.value)}
                options={[
                  { value: "", label: "No due day" },
                  ...shootingDays.map((day) => ({
                    value: day.id,
                    label: `Day ${day.dayNumber}`,
                  })),
                ]}
              />
              <Select
                value={generatorOwnerCrewId}
                onChange={(event) => setGeneratorOwnerCrewId(event.target.value)}
                options={[
                  { value: "", label: "No owner" },
                  ...crew.map((member) => ({
                    value: member.id,
                    label: member.name,
                  })),
                ]}
              />
              <Button onClick={handleGeneratePullList} disabled={generating}>
                {generating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Generate Pull List
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Pull Lists</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                {(workspace.pullLists || []).length > 0 ? (
                  <ul className="divide-y divide-border">
                    {workspace.pullLists.map((list) => (
                      <li key={list.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedListId(list.id)}
                          className={`w-full px-3 py-2 text-left transition-colors ${
                            selectedListId === list.id
                              ? "bg-muted/60"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <p className="text-sm font-medium">
                            {sceneLabelById.get(list.sceneId) || list.sceneId}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {formatStatus(list.status)}
                            </Badge>
                            {list.shootingDayId ? (
                              <span className="text-[11px] text-muted-foreground">
                                {
                                  shootingDays.find((day) => day.id === list.shootingDayId)
                                    ?.dayNumber
                                }
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No Art pull lists yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Pull Items</p>
              </div>
              {selectedList ? (
                <div className="space-y-3 p-3">
                  {pullItems.length > 0 ? (
                    <div className="space-y-2">
                      {pullItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-border bg-muted/20 p-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {item.name} <span className="text-xs text-muted-foreground">x{item.qty}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.notes || "No notes"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={item.status}
                                onChange={(event) =>
                                  void handleUpdatePullItemStatus(
                                    item.id,
                                    event.target.value as ArtPullItemStatus,
                                  )
                                }
                                options={PULL_ITEM_STATUSES.map((status) => ({
                                  value: status,
                                  label: formatStatus(status),
                                }))}
                              />
                              <Select
                                value={item.dueDayId || ""}
                                onChange={(event) =>
                                  void handleUpdatePullItemDueDay(item.id, event.target.value)
                                }
                                options={[
                                  { value: "", label: "No due day" },
                                  ...shootingDays.map((day) => ({
                                    value: day.id,
                                    label: `Day ${day.dayNumber}`,
                                  })),
                                ]}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleSyncPullItemToBudget(item.id)}
                              >
                                Sync Budget
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No pull items in this list.
                    </p>
                  )}

                  <div className="rounded-md border border-dashed border-border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Add Pull Item
                    </p>
                    <div className="grid gap-2 md:grid-cols-4">
                      <Input
                        value={newPullItemName}
                        onChange={(event) => setNewPullItemName(event.target.value)}
                        placeholder="Item name"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={newPullItemQty}
                        onChange={(event) => setNewPullItemQty(event.target.value)}
                        placeholder="Qty"
                      />
                      <Select
                        value={newPullItemDueDayId}
                        onChange={(event) => setNewPullItemDueDayId(event.target.value)}
                        options={[
                          { value: "", label: "No due day" },
                          ...shootingDays.map((day) => ({
                            value: day.id,
                            label: `Day ${day.dayNumber}`,
                          })),
                        ]}
                      />
                      <Button onClick={handleCreatePullItem} disabled={creatingPullItem}>
                        {creatingPullItem ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-8 text-sm text-muted-foreground">
                  Select a pull list to manage items.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="continuity" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Add Continuity Entry
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <Select
                value={continuitySceneId}
                onChange={(event) => setContinuitySceneId(event.target.value)}
                options={[
                  { value: "", label: "Select scene" },
                  ...scenes.map((scene) => ({
                    value: scene.id,
                    label: `Scene ${scene.sceneNumber}`,
                  })),
                ]}
              />
              <Select
                value={continuitySubjectType}
                onChange={(event) =>
                  setContinuitySubjectType(event.target.value as ArtContinuitySubjectType)
                }
                options={CONTINUITY_SUBJECT_TYPES.map((subjectType) => ({
                  value: subjectType,
                  label: formatStatus(subjectType),
                }))}
              />
              <Input
                value={continuitySubjectName}
                onChange={(event) => setContinuitySubjectName(event.target.value)}
                placeholder="Subject (e.g., Hero lamp shade)"
              />
              <Input
                value={continuityScriptDay}
                onChange={(event) => setContinuityScriptDay(event.target.value)}
                placeholder="Script day (optional)"
              />
              <Select
                value={continuityDueDayId}
                onChange={(event) => setContinuityDueDayId(event.target.value)}
                options={[
                  { value: "", label: "No due day" },
                  ...shootingDays.map((day) => ({
                    value: day.id,
                    label: `Day ${day.dayNumber}`,
                  })),
                ]}
              />
              <Button onClick={handleCreateContinuity} disabled={creatingContinuity}>
                {creatingContinuity ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Add Entry
              </Button>
            </div>
            <div className="mt-2">
              <Textarea
                value={continuityNotes}
                onChange={(event) => setContinuityNotes(event.target.value)}
                placeholder="Continuity notes..."
                rows={2}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Continuity Filters
            </p>
            <div className="grid gap-2 md:grid-cols-4">
              <Select
                value={continuityFilterType}
                onChange={(event) =>
                  setContinuityFilterType(event.target.value as ArtContinuitySubjectType | "ALL")
                }
                options={[
                  { value: "ALL", label: "All subjects" },
                  ...CONTINUITY_SUBJECT_TYPES.map((subjectType) => ({
                    value: subjectType,
                    label: formatStatus(subjectType),
                  })),
                ]}
              />
              <Select
                value={continuityFilterScriptDay}
                onChange={(event) => setContinuityFilterScriptDay(event.target.value)}
                options={[
                  { value: "", label: "All script days" },
                  ...continuityScriptDayOptions.map((value) => ({
                    value,
                    label: value,
                  })),
                ]}
              />
              <Select
                value={continuityFilterStatus}
                onChange={(event) =>
                  setContinuityFilterStatus(event.target.value as "ALL" | "OPEN" | "RESOLVED")
                }
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "OPEN", label: "Open only" },
                  { value: "RESOLVED", label: "Resolved only" },
                ]}
              />
              <Input
                value={continuityFilterSearch}
                onChange={(event) => setContinuityFilterSearch(event.target.value)}
                placeholder="Search subject or notes"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Continuity Risks</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                {filteredContinuityEntries.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {filteredContinuityEntries.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedContinuityId(entry.id)}
                          className={`w-full px-3 py-2 text-left transition-colors ${
                            selectedContinuityId === entry.id
                              ? "bg-muted/60"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <p className="text-sm font-medium">{entry.subjectName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge
                              variant={entry.isResolved ? "completed" : "on-hold"}
                              className="text-[10px]"
                            >
                              {entry.isResolved ? "Resolved" : "Open"}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatStatus(entry.subjectType)}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No continuity entries match these filters.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Entry Detail</p>
              </div>
              {selectedContinuity ? (
                <div className="space-y-4 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{selectedContinuity.subjectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {sceneLabelById.get(selectedContinuity.sceneId) || selectedContinuity.sceneId}
                      </p>
                    </div>
                    <Button
                      variant={selectedContinuity.isResolved ? "outline" : "default"}
                      size="sm"
                      onClick={() =>
                        void handleResolveContinuity(
                          selectedContinuity,
                          !selectedContinuity.isResolved,
                        )
                      }
                    >
                      {selectedContinuity.isResolved ? "Reopen" : "Mark Resolved"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedContinuity.notes || "No continuity notes yet."}
                  </p>

                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Continuity Photos
                    </p>
                    <div className="grid gap-2 md:grid-cols-4">
                      <Input
                        value={continuityPhotoUrl}
                        onChange={(event) => setContinuityPhotoUrl(event.target.value)}
                        placeholder="Photo URL"
                      />
                      <Input
                        value={continuityPhotoAngle}
                        onChange={(event) => setContinuityPhotoAngle(event.target.value)}
                        placeholder="Angle (optional)"
                      />
                      <Input
                        value={continuityPhotoLookType}
                        onChange={(event) => setContinuityPhotoLookType(event.target.value)}
                        placeholder="Look type (optional)"
                      />
                      <Button onClick={handleAddContinuityPhoto} disabled={addingContinuityPhoto}>
                        {addingContinuityPhoto ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Add Photo
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {continuityPhotos.length > 0 ? (
                        continuityPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5"
                          >
                            <a
                              className="truncate text-xs text-primary underline"
                              href={photo.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {photo.fileUrl}
                            </a>
                            <div className="flex items-center gap-1">
                              {photo.angle ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {photo.angle}
                                </span>
                              ) : null}
                              {photo.lookType ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {photo.lookType}
                                </span>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDeleteContinuityPhoto(photo.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No continuity photos attached yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Attachments
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        value={attachmentUrl}
                        onChange={(event) => setAttachmentUrl(event.target.value)}
                        placeholder="File URL"
                      />
                      <Input
                        value={attachmentName}
                        onChange={(event) => setAttachmentName(event.target.value)}
                        placeholder="File name (optional)"
                      />
                      <Button onClick={handleCreateContinuityAttachment}>Attach</Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {loadingCollab ? (
                        <p className="text-xs text-muted-foreground">Loading attachments...</p>
                      ) : continuityAttachments.length > 0 ? (
                        continuityAttachments.map((attachment) => (
                          <p key={attachment.id} className="text-xs">
                            <a
                              className="text-primary underline"
                              href={attachment.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {attachment.fileName || attachment.fileUrl}
                            </a>
                          </p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No attachments yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Comments
                    </p>
                    <div className="space-y-2">
                      {loadingCollab ? (
                        <p className="text-xs text-muted-foreground">Loading comments...</p>
                      ) : continuityComments.length > 0 ? (
                        continuityComments.map((comment) => (
                          <p key={comment.id} className="rounded bg-background px-2 py-1 text-xs">
                            {comment.body}
                          </p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No comments yet.</p>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={newComment}
                        onChange={(event) => setNewComment(event.target.value)}
                        placeholder="Add comment..."
                      />
                      <Button variant="outline" onClick={handleCreateContinuityComment}>
                        Post
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-8 text-sm text-muted-foreground">
                  Select a continuity entry.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="build-strike" className="space-y-4">
          {workOrderConflicts.length > 0 ? (
            <div className="rounded-lg border border-amber-300/70 bg-amber-100/40 p-3 text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em]">
                Location Access Conflicts
              </p>
              <ul className="space-y-1 text-xs">
                {workOrderConflicts.map((conflict) => (
                  <li key={conflict.key}>
                    {conflict.locationId}: {conflict.aLabel} overlaps {conflict.bLabel} ({conflict.window})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Create Work Order
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <Select
                value={newWorkOrderType}
                onChange={(event) => setNewWorkOrderType(event.target.value as ArtWorkOrderType)}
                options={WORK_ORDER_TYPES.map((type) => ({
                  value: type,
                  label: formatStatus(type),
                }))}
              />
              <Select
                value={newWorkOrderStartDayId}
                onChange={(event) => setNewWorkOrderStartDayId(event.target.value)}
                options={[
                  { value: "", label: "Start day" },
                  ...shootingDays.map((day) => ({
                    value: day.id,
                    label: `Day ${day.dayNumber}`,
                  })),
                ]}
              />
              <Select
                value={newWorkOrderEndDayId}
                onChange={(event) => setNewWorkOrderEndDayId(event.target.value)}
                options={[
                  { value: "", label: "End day" },
                  ...shootingDays.map((day) => ({
                    value: day.id,
                    label: `Day ${day.dayNumber}`,
                  })),
                ]}
              />
              <Input
                value={newWorkOrderLocationId}
                onChange={(event) => setNewWorkOrderLocationId(event.target.value)}
                placeholder="Location ID (optional)"
              />
              <Input
                value={newWorkOrderSummary}
                onChange={(event) => setNewWorkOrderSummary(event.target.value)}
                placeholder="Summary"
              />
              <Button onClick={handleCreateWorkOrder} disabled={creatingWorkOrder}>
                {creatingWorkOrder ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Create Work Order
              </Button>
            </div>
            <div className="mt-2">
              <Input
                value={newWorkOrderSceneIds}
                onChange={(event) => setNewWorkOrderSceneIds(event.target.value)}
                placeholder="Scene numbers (comma-separated), e.g. 12, 15B"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Work Orders</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                {(workspace.workOrders || []).length > 0 ? (
                  <ul className="divide-y divide-border">
                    {workspace.workOrders.map((order) => (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedWorkOrderId(order.id)}
                          className={`w-full px-3 py-2 text-left transition-colors ${
                            selectedWorkOrderId === order.id
                              ? "bg-muted/60"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <p className="text-sm font-medium">
                            {order.summary || formatStatus(order.type)}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {formatStatus(order.status)}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatStatus(order.type)}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No work orders yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Order Detail</p>
              </div>
              {selectedWorkOrder ? (
                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {selectedWorkOrder.summary || formatStatus(selectedWorkOrder.type)}
                    </p>
                    <Select
                      value={selectedWorkOrder.status}
                      onChange={(event) =>
                        void handleUpdateWorkOrderStatus(
                          selectedWorkOrder.id,
                          event.target.value as ArtWorkOrderStatus,
                        )
                      }
                      options={WORK_ORDER_STATUSES.map((status) => ({
                        value: status,
                        label: formatStatus(status),
                      }))}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Linked scenes:{" "}
                    {selectedWorkOrderSceneIds.length > 0
                      ? selectedWorkOrderSceneIds
                          .map((sceneId) => sceneLabelById.get(sceneId) || sceneId)
                          .join(", ")
                      : "None"}
                  </p>

                  <div className="rounded-md border border-dashed border-border p-2">
                    <Input
                      value={newWorkOrderSceneIds}
                      onChange={(event) => setNewWorkOrderSceneIds(event.target.value)}
                      placeholder="Update scene numbers (comma-separated)"
                    />
                    <Button
                      className="mt-2"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveWorkOrderScenes}
                    >
                      Save Linked Scenes
                    </Button>
                  </div>

                  <div className="rounded-md border border-dashed border-border p-2">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Crew Assignments
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Select
                        value={assignCrewId}
                        onChange={(event) => setAssignCrewId(event.target.value)}
                        options={[
                          { value: "", label: "Select crew member" },
                          ...crew.map((member) => ({
                            value: member.id,
                            label: member.name,
                          })),
                        ]}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={assignHours}
                        onChange={(event) => setAssignHours(event.target.value)}
                        placeholder="Hours"
                      />
                      <Button onClick={handleAssignCrew} disabled={assigningCrew}>
                        {assigningCrew ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Assign
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedWorkOrderCrewAssignments.length > 0 ? (
                        selectedWorkOrderCrewAssignments.map((assignment) => (
                          <p key={assignment.id} className="text-xs text-muted-foreground">
                            {crewNameById.get(assignment.crewMemberId) || assignment.crewMemberId}{" "}
                            - {assignment.hours}h
                          </p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No crew assigned yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-8 text-sm text-muted-foreground">
                  Select a work order to edit.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="readiness" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Day Readiness & Blockers</p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedDependencyDayId}
                  onChange={(event) => setSelectedDependencyDayId(event.target.value)}
                  options={[
                    { value: "", label: "Select shooting day" },
                    ...shootingDays.map((day) => ({
                      value: day.id,
                      label: `Day ${day.dayNumber}`,
                    })),
                  ]}
                />
                <Button variant="outline" size="sm" onClick={handleRefreshDependencies}>
                  Refresh Blockers
                </Button>
                <Button size="sm" onClick={handleSyncCallSheet} disabled={syncingCallSheet}>
                  {syncingCallSheet ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Sync Call Sheet
                </Button>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
              {loadingDayReadiness ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading Art day readiness...
                </div>
              ) : dayReadiness ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        dayReadiness.status === "READY"
                          ? "completed"
                          : dayReadiness.status === "IN_PROGRESS"
                            ? "pre-production"
                            : "on-hold"
                      }
                    >
                      {formatStatus(dayReadiness.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {dayReadiness.blockerCount} blocker
                      {dayReadiness.blockerCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{dayReadiness.summary}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Choose a shooting day.</p>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {dayAlerts.length > 0 ? (
                dayAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-md border border-border bg-background p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-sm">{alert.message}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatStatus(alert.severity)} - {alert.sourceType}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleResolveDependency(alert)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No open Art blockers for this day.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-sm font-medium">Scene Readiness</p>
            {(workspace.sceneReadiness || []).length > 0 ? (
              <div className="space-y-2">
                {workspace.sceneReadiness.map((readiness) => (
                  <div
                    key={readiness.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 p-2"
                  >
                    <p className="text-sm">
                      {sceneLabelById.get(readiness.sceneId) || readiness.sceneId}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          readiness.status === "READY"
                            ? "completed"
                            : readiness.status === "IN_PROGRESS"
                              ? "pre-production"
                              : "on-hold"
                        }
                      >
                        {formatStatus(readiness.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {readiness.notes || "No summary"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No Art scene readiness records yet. Generate pull lists or continuity entries first.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
