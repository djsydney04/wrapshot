"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import {
  resolveDepartmentDependencyBySource,
  upsertDepartmentDayDependency,
  upsertDepartmentSceneReadiness,
} from "@/lib/actions/departments-readiness";
import { autoSyncDepartmentBudgetRequest } from "@/lib/departments/budget-sync";

export type CameraShotPriority = "LOW" | "MEDIUM" | "HIGH";
export type CameraShotStatus = "PLANNED" | "READY" | "SHOT";
export type CameraNeedStatus = "PENDING" | "SOURCED" | "UNAVAILABLE" | "READY";
export type CameraNeedSource = "OWNED" | "RENTAL" | "PURCHASE" | "BORROW";
export type CameraAssetStatus =
  | "AVAILABLE"
  | "BOOKED"
  | "IN_USE"
  | "MAINTENANCE"
  | "WRAPPED";

export interface CameraShot {
  id: string;
  projectId: string;
  sceneId: string;
  shootingDayId: string | null;
  shotCode: string;
  description: string | null;
  setup: string | null;
  shotSize: string | null;
  cameraAngle: string | null;
  framing: string | null;
  movement: string | null;
  lens: string | null;
  cameraBody: string | null;
  fps: number | null;
  estimatedMinutes: number | null;
  syncSound: boolean;
  vfxRequired: boolean;
  referenceImageUrl: string | null;
  notes: string | null;
  priority: CameraShotPriority;
  status: CameraShotStatus;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  scene?: { id: string; sceneNumber: string } | null;
  shootingDay?: { id: string; dayNumber: number; date: string } | null;
  packageNeeds?: CameraPackageNeed[];
}

export interface CameraPackageNeed {
  id: string;
  projectId: string;
  shotId: string;
  itemType: string;
  spec: string | null;
  qty: number;
  source: CameraNeedSource;
  estimatedRate: number;
  status: CameraNeedStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CameraAsset {
  id: string;
  projectId: string;
  category: string;
  name: string;
  serial: string | null;
  ownerType: "OWNED" | "RENTED";
  vendorId: string | null;
  status: CameraAssetStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CameraBooking {
  id: string;
  projectId: string;
  assetId: string;
  startDayId: string;
  endDayId: string;
  rate: number;
  poNumber: string | null;
  status: "RESERVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED";
  returnDueAt: string | null;
  returnedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CameraAssetWithBookings extends CameraAsset {
  bookings: CameraBooking[];
}

export interface CameraCardLogInput {
  roll: string;
  cardLabel?: string;
  codec?: string;
  resolution?: string;
  tcStart?: string;
  tcEnd?: string;
  offloadedAt?: string;
  checksum?: string;
  notes?: string;
}

export interface CameraReport {
  id: string;
  projectId: string;
  shootingDayId: string;
  cameraUnit: string;
  operatorId: string | null;
  summary: string | null;
  issues: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cardLogs?: CameraCardLog[];
}

export interface CameraCardLog {
  id: string;
  reportId: string;
  roll: string;
  cardLabel: string | null;
  codec: string | null;
  resolution: string | null;
  tcStart: string | null;
  tcEnd: string | null;
  offloadedAt: string | null;
  checksum: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

async function resolveProjectIdFromScene(sceneId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("Scene")
    .select("projectId")
    .eq("id", sceneId)
    .maybeSingle();

  return data?.projectId || null;
}

async function getShotIdsForScene(sceneId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("CameraShot")
    .select("id")
    .eq("sceneId", sceneId);

  return (data || []).map((row) => row.id as string);
}

async function recomputeCameraSceneReadiness(projectId: string, sceneId: string) {
  const shotIds = await getShotIdsForScene(sceneId);

  if (shotIds.length === 0) {
    await upsertDepartmentSceneReadiness({
      projectId,
      sceneId,
      department: "CAMERA",
      status: "NOT_READY",
      notes: "No shots planned yet.",
    });
    return;
  }

  const supabase = await createClient();
  const { data: openNeeds } = await supabase
    .from("CameraPackageNeed")
    .select("id")
    .in("shotId", shotIds)
    .in("status", ["PENDING", "UNAVAILABLE"]);

  const hasOpenNeeds = (openNeeds || []).length > 0;

  await upsertDepartmentSceneReadiness({
    projectId,
    sceneId,
    department: "CAMERA",
    status: hasOpenNeeds ? "IN_PROGRESS" : "READY",
    notes: hasOpenNeeds
      ? "Camera package requirements are still unresolved."
      : "Shot and package requirements are ready.",
  });
}

async function syncCameraPackageDependencyForDay(projectId: string, shootingDayId: string) {
  const supabase = await createClient();

  const { data: shots } = await supabase
    .from("CameraShot")
    .select("id")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId);

  const shotIds = (shots || []).map((row) => row.id as string);

  if (shotIds.length === 0) {
    await resolveDepartmentDependencyBySource(
      projectId,
      shootingDayId,
      "CAMERA",
      "CAMERA_PACKAGE",
      shootingDayId,
    );
    return;
  }

  const { data: openNeeds } = await supabase
    .from("CameraPackageNeed")
    .select("id")
    .in("shotId", shotIds)
    .in("status", ["PENDING", "UNAVAILABLE"]);

  const openCount = (openNeeds || []).length;

  if (openCount > 0) {
    await upsertDepartmentDayDependency({
      projectId,
      shootingDayId,
      department: "CAMERA",
      sourceType: "CAMERA_PACKAGE",
      sourceId: shootingDayId,
      severity: "WARNING",
      message: `${openCount} camera package need(s) are unresolved for this day.`,
      metadata: { openCount },
    });
  } else {
    await resolveDepartmentDependencyBySource(
      projectId,
      shootingDayId,
      "CAMERA",
      "CAMERA_PACKAGE",
      shootingDayId,
    );
  }
}

async function getShootingDayDateMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("ShootingDay")
    .select("id, date")
    .in("id", ids);

  const map: Record<string, string> = {};
  (data || []).forEach((row) => {
    map[row.id as string] = row.date as string;
  });

  return map;
}

function daysInclusive(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const millis = end.getTime() - start.getTime();
  if (Number.isNaN(millis)) return 1;
  return Math.max(1, Math.floor(millis / (1000 * 60 * 60 * 24)) + 1);
}

function rangesOverlap(
  aStartDate: string,
  aEndDate: string,
  bStartDate: string,
  bEndDate: string,
): boolean {
  const aStart = new Date(aStartDate).getTime();
  const aEnd = new Date(aEndDate).getTime();
  const bStart = new Date(bStartDate).getTime();
  const bEnd = new Date(bEndDate).getTime();

  if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value))) {
    return false;
  }

  return aStart <= bEnd && bStart <= aEnd;
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function syncReportToPostIngest(
  projectId: string,
  shootingDayId: string,
  reportId: string,
  cardLogs: CameraCardLogInput[],
) {
  const supabase = await createClient();

  const { data: existingBatch, error: batchError } = await supabase
    .from("PostIngestBatch")
    .select("id")
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  if (batchError) {
    console.error("Error loading post ingest batch:", batchError);
    return;
  }

  const expectedRollCount = cardLogs.length;
  const missingRollCount = cardLogs.filter((log) => !log.offloadedAt).length;
  const receivedRollCount = expectedRollCount - missingRollCount;

  const status =
    expectedRollCount === 0 || missingRollCount > 0 ? "BLOCKED" : "QUEUED";

  let batchId = existingBatch?.id as string | undefined;

  if (!batchId) {
    const { data: createdBatch, error: createBatchError } = await supabase
      .from("PostIngestBatch")
      .insert({
        projectId,
        shootingDayId,
        sourceReportId: reportId,
        status,
        expectedRollCount,
        receivedRollCount,
        missingRollCount,
      })
      .select("id")
      .single();

    if (createBatchError || !createdBatch?.id) {
      console.error("Error creating post ingest batch:", createBatchError);
      return;
    }

    batchId = createdBatch.id as string;
  } else {
    const { error: updateBatchError } = await supabase
      .from("PostIngestBatch")
      .update({
        sourceReportId: reportId,
        status,
        expectedRollCount,
        receivedRollCount,
        missingRollCount,
      })
      .eq("id", batchId);

    if (updateBatchError) {
      console.error("Error updating post ingest batch:", updateBatchError);
      return;
    }
  }

  for (const log of cardLogs) {
    const roll = log.roll.trim();
    if (!roll) continue;

    const qcStatus = log.offloadedAt ? "PENDING" : "MISSING";
    const issue = log.offloadedAt ? null : "Card not offloaded";

    const { error: itemUpsertError } = await supabase
      .from("PostIngestItem")
      .upsert(
        {
          batchId,
          roll,
          checksum: log.checksum || null,
          codec: log.codec || null,
          tcStart: log.tcStart || null,
          tcEnd: log.tcEnd || null,
          offloadedAt: log.offloadedAt || null,
          qcStatus,
          issue,
        },
        { onConflict: "batchId,roll" },
      );

    if (itemUpsertError) {
      console.error("Error upserting post ingest item:", itemUpsertError);
    }
  }
}

export async function getCameraShots(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("CameraShot")
    .select(
      `
      *,
      scene:Scene(id, sceneNumber),
      shootingDay:ShootingDay(id, dayNumber, date),
      packageNeeds:CameraPackageNeed(*)
    `,
    )
    .eq("projectId", projectId)
    .order("shootingDayId", { ascending: true })
    .order("sceneId", { ascending: true })
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Error fetching camera shots:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as CameraShot[], error: null };
}

export async function createCameraShot(input: {
  projectId: string;
  sceneId: string;
  shootingDayId?: string;
  shotCode: string;
  description?: string;
  setup?: string;
  shotSize?: string;
  cameraAngle?: string;
  framing?: string;
  movement?: string;
  lens?: string;
  cameraBody?: string;
  fps?: number;
  estimatedMinutes?: number;
  syncSound?: boolean;
  vfxRequired?: boolean;
  referenceImageUrl?: string;
  notes?: string;
  priority?: CameraShotPriority;
  status?: CameraShotStatus;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const shotCode = input.shotCode.trim();
  if (!shotCode) {
    return { data: null, error: "Shot code is required" };
  }

  const fps = input.fps !== undefined ? Math.max(1, Math.floor(input.fps)) : null;
  const estimatedMinutes =
    input.estimatedMinutes !== undefined
      ? Math.max(1, Math.floor(input.estimatedMinutes))
      : null;

  const { data, error } = await supabase
    .from("CameraShot")
    .insert({
      projectId: input.projectId,
      sceneId: input.sceneId,
      shootingDayId: input.shootingDayId || null,
      shotCode,
      description: normalizeOptionalText(input.description),
      setup: normalizeOptionalText(input.setup),
      shotSize: normalizeOptionalText(input.shotSize),
      cameraAngle: normalizeOptionalText(input.cameraAngle),
      framing: normalizeOptionalText(input.framing),
      movement: normalizeOptionalText(input.movement),
      lens: normalizeOptionalText(input.lens),
      cameraBody: normalizeOptionalText(input.cameraBody),
      fps,
      estimatedMinutes,
      syncSound: Boolean(input.syncSound),
      vfxRequired: Boolean(input.vfxRequired),
      referenceImageUrl: normalizeOptionalText(input.referenceImageUrl),
      notes: normalizeOptionalText(input.notes),
      priority: input.priority || "MEDIUM",
      status: input.status || "PLANNED",
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating camera shot:", error);
    return { data: null, error: error.message };
  }

  await recomputeCameraSceneReadiness(input.projectId, input.sceneId);
  if (input.shootingDayId) {
    await syncCameraPackageDependencyForDay(input.projectId, input.shootingDayId);
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as CameraShot, error: null };
}

export async function updateCameraShot(
  id: string,
  updates: Partial<{
    shootingDayId: string | null;
    shotCode: string;
    description: string | null;
    setup: string | null;
    shotSize: string | null;
    cameraAngle: string | null;
    framing: string | null;
    movement: string | null;
    lens: string | null;
    cameraBody: string | null;
    fps: number | null;
    estimatedMinutes: number | null;
    syncSound: boolean;
    vfxRequired: boolean;
    referenceImageUrl: string | null;
    notes: string | null;
    priority: CameraShotPriority;
    status: CameraShotStatus;
    sortOrder: number;
  }>,
) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("CameraShot")
    .select("projectId, sceneId, shootingDayId")
    .eq("id", id)
    .single();

  const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (updates.shootingDayId !== undefined) payload.shootingDayId = updates.shootingDayId;
  if (updates.shotCode !== undefined) {
    const normalizedShotCode = updates.shotCode.trim();
    if (!normalizedShotCode) {
      return { data: null, error: "Shot code is required" };
    }
    payload.shotCode = normalizedShotCode;
  }
  if (updates.description !== undefined) {
    payload.description = normalizeOptionalText(updates.description);
  }
  if (updates.setup !== undefined) payload.setup = normalizeOptionalText(updates.setup);
  if (updates.shotSize !== undefined) payload.shotSize = normalizeOptionalText(updates.shotSize);
  if (updates.cameraAngle !== undefined) {
    payload.cameraAngle = normalizeOptionalText(updates.cameraAngle);
  }
  if (updates.framing !== undefined) payload.framing = normalizeOptionalText(updates.framing);
  if (updates.movement !== undefined) payload.movement = normalizeOptionalText(updates.movement);
  if (updates.lens !== undefined) payload.lens = normalizeOptionalText(updates.lens);
  if (updates.cameraBody !== undefined) {
    payload.cameraBody = normalizeOptionalText(updates.cameraBody);
  }
  if (updates.fps !== undefined) {
    payload.fps = updates.fps === null ? null : Math.max(1, Math.floor(updates.fps));
  }
  if (updates.estimatedMinutes !== undefined) {
    payload.estimatedMinutes =
      updates.estimatedMinutes === null
        ? null
        : Math.max(1, Math.floor(updates.estimatedMinutes));
  }
  if (updates.syncSound !== undefined) payload.syncSound = updates.syncSound;
  if (updates.vfxRequired !== undefined) payload.vfxRequired = updates.vfxRequired;
  if (updates.referenceImageUrl !== undefined) {
    payload.referenceImageUrl = normalizeOptionalText(updates.referenceImageUrl);
  }
  if (updates.notes !== undefined) payload.notes = normalizeOptionalText(updates.notes);
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.sortOrder !== undefined) payload.sortOrder = updates.sortOrder;

  const { data, error } = await supabase
    .from("CameraShot")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating camera shot:", error);
    return { data: null, error: error.message };
  }

  await recomputeCameraSceneReadiness(data.projectId as string, data.sceneId as string);

  const oldDayId = before?.shootingDayId as string | null;
  const newDayId = data.shootingDayId as string | null;

  if (oldDayId) {
    await syncCameraPackageDependencyForDay(data.projectId as string, oldDayId);
  }
  if (newDayId && newDayId !== oldDayId) {
    await syncCameraPackageDependencyForDay(data.projectId as string, newDayId);
  }

  revalidatePath(`/projects/${data.projectId}`);
  return { data: data as CameraShot, error: null };
}

export async function deleteCameraShot(id: string) {
  const supabase = await createClient();

  const { data: shot } = await supabase
    .from("CameraShot")
    .select("projectId, sceneId, shootingDayId")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("CameraShot").delete().eq("id", id);

  if (error) {
    console.error("Error deleting camera shot:", error);
    return { success: false, error: error.message };
  }

  if (shot?.projectId && shot.sceneId) {
    await recomputeCameraSceneReadiness(shot.projectId as string, shot.sceneId as string);
  }
  if (shot?.projectId && shot.shootingDayId) {
    await syncCameraPackageDependencyForDay(
      shot.projectId as string,
      shot.shootingDayId as string,
    );
  }

  revalidatePath(`/projects/${shot?.projectId || ""}`);
  return { success: true, error: null };
}

export async function createCameraPackageNeed(input: {
  projectId: string;
  shotId: string;
  itemType: string;
  spec?: string;
  qty?: number;
  source?: CameraNeedSource;
  estimatedRate?: number;
  status?: CameraNeedStatus;
  notes?: string;
}) {
  const supabase = await createClient();

  const itemType = input.itemType.trim();
  if (!itemType) {
    return { data: null, error: "Item type is required" };
  }

  const qty = Math.max(1, input.qty || 1);

  const { data, error } = await supabase
    .from("CameraPackageNeed")
    .insert({
      projectId: input.projectId,
      shotId: input.shotId,
      itemType,
      spec: input.spec || null,
      qty,
      source: input.source || "OWNED",
      estimatedRate: input.estimatedRate || 0,
      status: input.status || "PENDING",
      notes: input.notes || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating camera package need:", error);
    return { data: null, error: error.message };
  }

  const { data: shot } = await supabase
    .from("CameraShot")
    .select("sceneId, shootingDayId")
    .eq("id", input.shotId)
    .single();

  if (shot?.sceneId) {
    await recomputeCameraSceneReadiness(input.projectId, shot.sceneId as string);
  }
  if (shot?.shootingDayId) {
    await syncCameraPackageDependencyForDay(
      input.projectId,
      shot.shootingDayId as string,
    );
  }

  if (
    ["RENTAL", "PURCHASE", "BORROW"].includes((data.source as string) || "") &&
    Number(data.estimatedRate || 0) > 0
  ) {
    await autoSyncDepartmentBudgetRequest({
      projectId: input.projectId,
      department: "CAMERA",
      sourceType: "CAMERA_PACKAGE_NEED",
      sourceId: data.id as string,
      plannedAmount: Number(data.estimatedRate || 0) * Number(data.qty || 1),
      reason: `Camera package need: ${data.itemType}`,
    });
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as CameraPackageNeed, error: null };
}

export async function updateCameraPackageNeed(
  id: string,
  updates: Partial<{
    itemType: string;
    spec: string;
    qty: number;
    source: CameraNeedSource;
    estimatedRate: number;
    status: CameraNeedStatus;
    notes: string;
  }>,
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("CameraPackageNeed")
    .select("projectId, shotId")
    .eq("id", id)
    .single();

  const payload = {
    ...updates,
    ...(updates.itemType ? { itemType: updates.itemType.trim() } : {}),
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("CameraPackageNeed")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating camera package need:", error);
    return { data: null, error: error.message };
  }

  const projectId = data.projectId as string;

  const { data: shot } = await supabase
    .from("CameraShot")
    .select("sceneId, shootingDayId")
    .eq("id", data.shotId as string)
    .single();

  if (shot?.sceneId) {
    await recomputeCameraSceneReadiness(projectId, shot.sceneId as string);
  }
  if (shot?.shootingDayId) {
    await syncCameraPackageDependencyForDay(projectId, shot.shootingDayId as string);
  }

  if (
    ["RENTAL", "PURCHASE", "BORROW"].includes((data.source as string) || "") &&
    Number(data.estimatedRate || 0) > 0
  ) {
    await autoSyncDepartmentBudgetRequest({
      projectId,
      department: "CAMERA",
      sourceType: "CAMERA_PACKAGE_NEED",
      sourceId: data.id as string,
      plannedAmount: Number(data.estimatedRate || 0) * Number(data.qty || 1),
      reason: `Camera package need: ${data.itemType}`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  if (existing?.projectId && existing.projectId !== projectId) {
    revalidatePath(`/projects/${existing.projectId}`);
  }
  return { data: data as CameraPackageNeed, error: null };
}

export async function deleteCameraPackageNeed(id: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("CameraPackageNeed")
    .select("projectId, shotId")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("CameraPackageNeed").delete().eq("id", id);
  if (error) {
    console.error("Error deleting camera package need:", error);
    return { success: false, error: error.message };
  }

  if (existing?.projectId && existing?.shotId) {
    const { data: shot } = await supabase
      .from("CameraShot")
      .select("sceneId, shootingDayId")
      .eq("id", existing.shotId as string)
      .single();

    if (shot?.sceneId) {
      await recomputeCameraSceneReadiness(existing.projectId as string, shot.sceneId as string);
    }
    if (shot?.shootingDayId) {
      await syncCameraPackageDependencyForDay(
        existing.projectId as string,
        shot.shootingDayId as string,
      );
    }

    revalidatePath(`/projects/${existing.projectId}`);
  }

  return { success: true, error: null };
}

export async function getCameraAssets(projectId: string) {
  const supabase = await createClient();

  const [{ data: assets, error: assetsError }, { data: bookings, error: bookingsError }] =
    await Promise.all([
      supabase
        .from("CameraAsset")
        .select("*")
        .eq("projectId", projectId)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("CameraBooking")
        .select("*")
        .eq("projectId", projectId)
        .order("createdAt", { ascending: false }),
    ]);

  if (assetsError) {
    console.error("Error fetching camera assets:", assetsError);
    return { data: null, error: assetsError.message };
  }

  if (bookingsError) {
    console.error("Error fetching camera bookings:", bookingsError);
    return { data: null, error: bookingsError.message };
  }

  const bookingByAsset = new Map<string, CameraBooking[]>();
  (bookings || []).forEach((booking) => {
    const assetId = booking.assetId as string;
    const current = bookingByAsset.get(assetId) || [];
    current.push(booking as CameraBooking);
    bookingByAsset.set(assetId, current);
  });

  const rows = ((assets || []) as CameraAsset[]).map((asset) => ({
    ...asset,
    bookings: bookingByAsset.get(asset.id) || [],
  }));

  return { data: rows as CameraAssetWithBookings[], error: null };
}

export async function createCameraAsset(input: {
  projectId: string;
  category: string;
  name: string;
  serial?: string;
  ownerType?: "OWNED" | "RENTED";
  vendorId?: string;
  status?: CameraAssetStatus;
  notes?: string;
}) {
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) {
    return { data: null, error: "Asset name is required" };
  }

  const { data, error } = await supabase
    .from("CameraAsset")
    .insert({
      projectId: input.projectId,
      category: input.category,
      name,
      serial: input.serial || null,
      ownerType: input.ownerType || "OWNED",
      vendorId: input.vendorId || null,
      status: input.status || "AVAILABLE",
      notes: input.notes || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating camera asset:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as CameraAsset, error: null };
}

export async function updateCameraAsset(
  id: string,
  updates: Partial<{
    category: string;
    name: string;
    serial: string;
    ownerType: "OWNED" | "RENTED";
    vendorId: string;
    status: CameraAssetStatus;
    notes: string;
  }>,
) {
  const supabase = await createClient();

  const payload = {
    ...updates,
    ...(updates.name ? { name: updates.name.trim() } : {}),
    ...(updates.serial === "" ? { serial: null } : {}),
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("CameraAsset")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating camera asset:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);
  return { data: data as CameraAsset, error: null };
}

export async function deleteCameraAsset(id: string, projectId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("CameraAsset").delete().eq("id", id);

  if (error) {
    console.error("Error deleting camera asset:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, error: null };
}

export async function createCameraBooking(input: {
  projectId: string;
  assetId: string;
  startDayId: string;
  endDayId: string;
  rate?: number;
  poNumber?: string;
  status?: "RESERVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED";
  returnDueAt?: string;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data: existingBookings, error: existingError } = await supabase
    .from("CameraBooking")
    .select("id, startDayId, endDayId, status")
    .eq("assetId", input.assetId)
    .neq("status", "CANCELLED");

  if (existingError) {
    return { data: null, error: existingError.message };
  }

  const dayIds = [input.startDayId, input.endDayId, ...(existingBookings || []).flatMap((b) => [
    b.startDayId as string,
    b.endDayId as string,
  ])];
  const dayMap = await getShootingDayDateMap(Array.from(new Set(dayIds)));

  const startDate = dayMap[input.startDayId];
  const endDate = dayMap[input.endDayId];

  if (!startDate || !endDate) {
    return { data: null, error: "Invalid start/end shooting day" };
  }

  for (const booking of existingBookings || []) {
    const bookingStartDate = dayMap[booking.startDayId as string];
    const bookingEndDate = dayMap[booking.endDayId as string];

    if (!bookingStartDate || !bookingEndDate) continue;

    if (rangesOverlap(startDate, endDate, bookingStartDate, bookingEndDate)) {
      return {
        data: null,
        error: "Asset has an overlapping booking in the selected day range",
      };
    }
  }

  const { data, error } = await supabase
    .from("CameraBooking")
    .insert({
      projectId: input.projectId,
      assetId: input.assetId,
      startDayId: input.startDayId,
      endDayId: input.endDayId,
      rate: input.rate || 0,
      poNumber: input.poNumber || null,
      status: input.status || "RESERVED",
      returnDueAt: input.returnDueAt || null,
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating camera booking:", error);
    return { data: null, error: error.message };
  }

  const days = daysInclusive(startDate, endDate);
  const committedAmount = Number(data.rate || 0) * days;

  if (committedAmount > 0) {
    await autoSyncDepartmentBudgetRequest({
      projectId: input.projectId,
      department: "CAMERA",
      sourceType: "CAMERA_BOOKING",
      sourceId: data.id as string,
      committedAmount,
      reason: "Camera rental booking commitment",
    });
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as CameraBooking, error: null };
}

export async function updateCameraBooking(
  id: string,
  updates: Partial<{
    startDayId: string;
    endDayId: string;
    rate: number;
    poNumber: string;
    status: "RESERVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED";
    returnDueAt: string;
    returnedAt: string;
  }>,
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("CameraBooking")
    .select("projectId, startDayId, endDayId")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("CameraBooking")
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating camera booking:", error);
    return { data: null, error: error.message };
  }

  const startDayId = (data.startDayId as string | null) || (existing?.startDayId as string | null);
  const endDayId = (data.endDayId as string | null) || (existing?.endDayId as string | null);
  const dayIds = [startDayId, endDayId].filter(Boolean) as string[];

  const dayMap = dayIds.length > 0 ? await getShootingDayDateMap(dayIds) : {};

  const startDate = startDayId ? dayMap[startDayId] : undefined;
  const endDate = endDayId ? dayMap[endDayId] : undefined;

  if (startDate && endDate && Number(data.rate || 0) > 0) {
    const committedAmount = Number(data.rate || 0) * daysInclusive(startDate, endDate);

    await autoSyncDepartmentBudgetRequest({
      projectId: data.projectId as string,
      department: "CAMERA",
      sourceType: "CAMERA_BOOKING",
      sourceId: data.id as string,
      committedAmount,
      reason: "Camera rental booking commitment",
    });
  }

  revalidatePath(`/projects/${data.projectId}`);
  return { data: data as CameraBooking, error: null };
}

export async function deleteCameraBooking(id: string, projectId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("CameraBooking").delete().eq("id", id);

  if (error) {
    console.error("Error deleting camera booking:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, error: null };
}

export async function getCameraReports(projectId: string, shootingDayId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("CameraReport")
    .select(`
      *,
      cardLogs:CameraCardLog(*)
    `)
    .eq("projectId", projectId)
    .order("createdAt", { ascending: false });

  if (shootingDayId) {
    query = query.eq("shootingDayId", shootingDayId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching camera reports:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as CameraReport[], error: null };
}

export async function upsertCameraReport(input: {
  projectId: string;
  shootingDayId: string;
  cameraUnit?: string;
  operatorId?: string;
  summary?: string;
  issues?: string;
  cardLogs: CameraCardLogInput[];
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const cameraUnit = (input.cameraUnit || "MAIN").trim() || "MAIN";

  const { data: existing } = await supabase
    .from("CameraReport")
    .select("id")
    .eq("projectId", input.projectId)
    .eq("shootingDayId", input.shootingDayId)
    .eq("cameraUnit", cameraUnit)
    .maybeSingle();

  let reportId = existing?.id as string | undefined;

  if (!reportId) {
    const { data: createdReport, error: createReportError } = await supabase
      .from("CameraReport")
      .insert({
        projectId: input.projectId,
        shootingDayId: input.shootingDayId,
        cameraUnit,
        operatorId: input.operatorId || null,
        summary: input.summary || null,
        issues: input.issues || null,
        submittedBy: userId,
        submittedAt: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (createReportError || !createdReport) {
      console.error("Error creating camera report:", createReportError);
      return { data: null, error: createReportError?.message || "Failed to create report" };
    }

    reportId = createdReport.id as string;
  } else {
    const { error: updateReportError } = await supabase
      .from("CameraReport")
      .update({
        operatorId: input.operatorId || null,
        summary: input.summary || null,
        issues: input.issues || null,
        submittedBy: userId,
        submittedAt: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateReportError) {
      console.error("Error updating camera report:", updateReportError);
      return { data: null, error: updateReportError.message };
    }
  }

  const cleanedLogs = input.cardLogs
    .map((log) => ({
      ...log,
      roll: log.roll.trim(),
    }))
    .filter((log) => log.roll.length > 0);

  await supabase.from("CameraCardLog").delete().eq("reportId", reportId);

  if (cleanedLogs.length > 0) {
    const { error: insertLogsError } = await supabase
      .from("CameraCardLog")
      .insert(
        cleanedLogs.map((log) => ({
          reportId,
          roll: log.roll,
          cardLabel: log.cardLabel || null,
          codec: log.codec || null,
          resolution: log.resolution || null,
          tcStart: log.tcStart || null,
          tcEnd: log.tcEnd || null,
          offloadedAt: log.offloadedAt || null,
          checksum: log.checksum || null,
          notes: log.notes || null,
        })),
      );

    if (insertLogsError) {
      console.error("Error inserting camera card logs:", insertLogsError);
      return { data: null, error: insertLogsError.message };
    }
  }

  await syncReportToPostIngest(
    input.projectId,
    input.shootingDayId,
    reportId,
    cleanedLogs,
  );

  const missingLogs =
    cleanedLogs.length === 0 || cleanedLogs.some((log) => !log.offloadedAt);

  if (missingLogs) {
    await upsertDepartmentDayDependency({
      projectId: input.projectId,
      shootingDayId: input.shootingDayId,
      department: "CAMERA",
      sourceType: "CAMERA_REPORT",
      sourceId: reportId,
      severity: "WARNING",
      message:
        cleanedLogs.length === 0
          ? "Camera report has no card logs yet."
          : "One or more camera cards are not marked offloaded.",
    });
  } else {
    await resolveDepartmentDependencyBySource(
      input.projectId,
      input.shootingDayId,
      "CAMERA",
      "CAMERA_REPORT",
      reportId,
    );
  }

  const { data: reportWithLogs, error: reportError } = await supabase
    .from("CameraReport")
    .select(`
      *,
      cardLogs:CameraCardLog(*)
    `)
    .eq("id", reportId)
    .single();

  if (reportError) {
    return { data: null, error: reportError.message };
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: reportWithLogs as CameraReport, error: null };
}

export async function getCameraAvailabilityAlerts(projectId: string) {
  const supabase = await createClient();

  const { data: shots } = await supabase
    .from("CameraShot")
    .select("id, shootingDayId")
    .eq("projectId", projectId)
    .not("shootingDayId", "is", null);

  const shotDayMap = new Map<string, string>();
  (shots || []).forEach((shot) => {
    if (shot.shootingDayId) {
      shotDayMap.set(shot.id as string, shot.shootingDayId as string);
    }
  });

  if (shotDayMap.size === 0) {
    return { data: [], error: null };
  }

  const { data: openNeeds, error } = await supabase
    .from("CameraPackageNeed")
    .select("id, shotId, itemType, status")
    .in("shotId", Array.from(shotDayMap.keys()))
    .in("status", ["PENDING", "UNAVAILABLE"]);

  if (error) {
    return { data: null, error: error.message };
  }

  const alerts = (openNeeds || []).map((need) => ({
    needId: need.id as string,
    shootingDayId: shotDayMap.get(need.shotId as string) || "",
    message: `Need ${need.itemType} is ${need.status}`,
  }));

  return { data: alerts, error: null };
}

export async function refreshCameraReadinessForScene(sceneId: string) {
  const projectId = await resolveProjectIdFromScene(sceneId);
  if (!projectId) {
    return { success: false, error: "Scene not found" };
  }

  await recomputeCameraSceneReadiness(projectId, sceneId);
  return { success: true, error: null };
}
