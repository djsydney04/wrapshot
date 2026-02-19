"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import { createBudgetLineItem } from "@/lib/actions/budget-line-items";
import { syncDayDependenciesToCallSheet } from "@/lib/actions/departments-readiness";
import type { DepartmentDayDependency } from "@/lib/actions/departments-readiness";
import {
  computeArtReadiness,
  formatUpperSnake,
  isArtPullItemResolved,
  mergeArtDepartmentNotes,
  type ArtPullItemStatus,
  type ArtReadinessStatus,
} from "@/lib/art/workflow";
export type { ArtPullItemStatus } from "@/lib/art/workflow";

type ProjectRole =
  | "ADMIN"
  | "COORDINATOR"
  | "DEPARTMENT_HEAD"
  | "CREW"
  | "CAST"
  | "VIEWER";

type DepartmentAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
type DepartmentDependencyStatus = "OPEN" | "RESOLVED";

type ArtManagerRole = "ADMIN" | "COORDINATOR" | "DEPARTMENT_HEAD";

const ART_MANAGER_ROLES: ArtManagerRole[] = [
  "ADMIN",
  "COORDINATOR",
  "DEPARTMENT_HEAD",
];

const ART_DEPARTMENT_KEY = "ART";
const ART_DEPARTMENT_CALL_LABEL = "Art Department";

const ART_SCENE_ELEMENT_CATEGORIES = new Set([
  "PROP",
  "ART_DEPARTMENT",
  "SET_DRESSING",
  "WARDROBE",
  "GREENERY",
]);

export type ArtPullListStatus = "DRAFT" | "ACTIVE" | "WRAPPED";
export type ArtPullSource = "STOCK" | "RENTAL" | "PURCHASE" | "BORROW" | "BUILD";
export type ArtWorkOrderType = "BUILD" | "PAINT" | "SET_DRESS" | "STRIKE";
export type ArtWorkOrderStatus = "PLANNED" | "IN_PROGRESS" | "DONE" | "BLOCKED";
export type ArtContinuitySubjectType =
  | "CHARACTER"
  | "SET"
  | "PROP"
  | "WARDROBE"
  | "OTHER";
export type ArtRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ArtContinuityBook {
  id: string;
  projectId: string;
  title: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtContinuityEntry {
  id: string;
  projectId: string;
  continuityBookId: string;
  sceneId: string;
  dueDayId: string | null;
  scriptDay: string | null;
  subjectType: ArtContinuitySubjectType;
  subjectName: string;
  notes: string | null;
  tags: string[];
  riskLevel: ArtRiskLevel;
  isResolved: boolean;
  createdBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtContinuityPhoto {
  id: string;
  entryId: string;
  fileUrl: string;
  angle: string | null;
  lookType: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtPullList {
  id: string;
  projectId: string;
  sceneId: string;
  shootingDayId: string | null;
  status: ArtPullListStatus;
  ownerCrewId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtPullItem {
  id: string;
  listId: string;
  sourceElementId: string | null;
  name: string;
  qty: number;
  source: ArtPullSource;
  dueDayId: string | null;
  status: ArtPullItemStatus;
  vendor: string | null;
  plannedUnitCost: number;
  plannedAmount: number;
  actualAmount: number;
  isBlocking: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtWorkOrder {
  id: string;
  projectId: string;
  locationId: string | null;
  type: ArtWorkOrderType;
  startDayId: string | null;
  endDayId: string | null;
  status: ArtWorkOrderStatus;
  summary: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtWorkOrderScene {
  id: string;
  workOrderId: string;
  sceneId: string;
}

export interface ArtCrewAssignment {
  id: string;
  workOrderId: string;
  crewMemberId: string;
  hours: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentSceneReadiness {
  id: string;
  projectId: string;
  sceneId: string;
  department: string;
  status: ArtReadinessStatus;
  notes: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentBudgetLink {
  id: string;
  projectId: string;
  department: string;
  sourceType: string;
  sourceId: string;
  budgetId: string | null;
  categoryId: string | null;
  lineItemId: string | null;
  requestId: string | null;
  plannedAmount: number;
  committedAmount: number;
  actualAmount: number;
  lastSyncedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtDayReadiness {
  status: ArtReadinessStatus;
  blockerCount: number;
  summary: string;
}

export interface ArtWorkspaceData {
  continuityBook: ArtContinuityBook | null;
  continuityEntries: ArtContinuityEntry[];
  continuityPhotos: ArtContinuityPhoto[];
  pullLists: ArtPullList[];
  pullItems: ArtPullItem[];
  workOrders: ArtWorkOrder[];
  workOrderScenes: ArtWorkOrderScene[];
  crewAssignments: ArtCrewAssignment[];
  sceneReadiness: DepartmentSceneReadiness[];
  dayDependencies: DepartmentDayDependency[];
  budgetLinks: DepartmentBudgetLink[];
}

interface PermissionContext {
  userId: string;
  role: ProjectRole;
  canManage: boolean;
}

interface SyncArtCallSheetOptions {
  syncAdvanceNotes: boolean;
}

function parseNumber(input: number | string | null | undefined): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : 0;
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function rankSeverity(severity: DepartmentAlertSeverity): number {
  if (severity === "CRITICAL") return 3;
  if (severity === "WARNING") return 2;
  return 1;
}

function formatCurrencyLike(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function dependencyKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function deriveArtDayReadiness(alerts: DepartmentDayDependency[]): ArtDayReadiness {
  if (alerts.length === 0) {
    return {
      status: "READY",
      blockerCount: 0,
      summary: "No open Art blockers.",
    };
  }

  const criticalCount = alerts.filter((alert) => alert.severity === "CRITICAL").length;

  if (criticalCount > 0) {
    return {
      status: "NOT_READY",
      blockerCount: alerts.length,
      summary: `${criticalCount} critical Art blocker${criticalCount === 1 ? "" : "s"} open.`,
    };
  }

  return {
    status: "IN_PROGRESS",
    blockerCount: alerts.length,
    summary: `${alerts.length} Art blocker${alerts.length === 1 ? "" : "s"} pending.`,
  };
}

async function getPermissionContext(projectId: string): Promise<PermissionContext> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: membership, error } = await supabase
    .from("ProjectMember")
    .select("role")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (error || !membership) {
    throw new Error("Unauthorized: Not a member of this project");
  }

  const role = membership.role as ProjectRole;

  return {
    userId,
    role,
    canManage: ART_MANAGER_ROLES.includes(role as ArtManagerRole),
  };
}

async function requireArtManager(projectId: string): Promise<PermissionContext> {
  const context = await getPermissionContext(projectId);
  if (!context.canManage) {
    throw new Error("Unauthorized: Art workflow editing requires manager access");
  }
  return context;
}

async function revalidateProject(projectId: string): Promise<void> {
  revalidatePath(`/projects/${projectId}`);
}

async function ensureArtContinuityBook(
  projectId: string,
  userId: string,
): Promise<ArtContinuityBook> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("ArtContinuityBook")
    .select("*")
    .eq("projectId", projectId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as ArtContinuityBook;
  }

  const { data, error } = await supabase
    .from("ArtContinuityBook")
    .insert({
      projectId,
      title: "Continuity Bible",
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create continuity book");
  }

  return data as ArtContinuityBook;
}

async function resolveProjectIdForPullList(pullListId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ArtPullList")
    .select("projectId")
    .eq("id", pullListId)
    .single();

  if (error || !data) {
    throw new Error("Art pull list not found");
  }

  return data.projectId as string;
}

async function resolveProjectIdForPullItem(itemId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ArtPullItem")
    .select("list:ArtPullList(projectId)")
    .eq("id", itemId)
    .single();

  if (error || !data) {
    throw new Error("Art pull item not found");
  }

  const list = data.list as { projectId: string } | { projectId: string }[] | null;
  const projectId = Array.isArray(list) ? list[0]?.projectId : list?.projectId;

  if (!projectId) {
    throw new Error("Art pull list not found for item");
  }

  return projectId;
}

async function resolveProjectIdForContinuityEntry(entryId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ArtContinuityEntry")
    .select("projectId")
    .eq("id", entryId)
    .single();

  if (error || !data) {
    throw new Error("Art continuity entry not found");
  }

  return data.projectId as string;
}

async function resolveProjectIdForWorkOrder(workOrderId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ArtWorkOrder")
    .select("projectId")
    .eq("id", workOrderId)
    .single();

  if (error || !data) {
    throw new Error("Art work order not found");
  }

  return data.projectId as string;
}

async function getArtOpenDependenciesForDay(
  projectId: string,
  shootingDayId: string,
): Promise<DepartmentDayDependency[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("DepartmentDayDependency")
    .select("*")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .eq("department", ART_DEPARTMENT_KEY)
    .eq("status", "OPEN")
    .order("updatedAt", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as DepartmentDayDependency[]).sort(
    (a, b) =>
      rankSeverity(b.severity as DepartmentAlertSeverity) -
      rankSeverity(a.severity as DepartmentAlertSeverity),
  );
}

async function getOrCreateCallSheetForShootingDay(
  shootingDayId: string,
): Promise<{ id: string; advanceNotes: string | null }> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("CallSheet")
    .select("id, advanceNotes")
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as { id: string; advanceNotes: string | null };
  }

  const { data: created, error: createError } = await supabase
    .from("CallSheet")
    .insert({ shootingDayId })
    .select("id, advanceNotes")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || "Failed to create call sheet");
  }

  return created as { id: string; advanceNotes: string | null };
}

async function refreshPullListStatus(listId: string): Promise<void> {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("ArtPullItem")
    .select("status")
    .eq("listId", listId);

  if (error) {
    throw new Error(error.message);
  }

  const statuses = (items || []).map((item) => item.status as ArtPullItemStatus);
  let status: ArtPullListStatus = "DRAFT";

  if (statuses.length === 0) {
    status = "DRAFT";
  } else if (statuses.every((itemStatus) => itemStatus === "WRAPPED")) {
    status = "WRAPPED";
  } else {
    status = "ACTIVE";
  }

  const { error: updateError } = await supabase
    .from("ArtPullList")
    .update({
      status,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", listId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function syncArtBlockersToCallSheetInternal(
  projectId: string,
  shootingDayId: string,
  userId: string,
  options: SyncArtCallSheetOptions,
): Promise<{ callSheetId: string; blockerCount: number; departmentNote: string | null }> {
  const supabase = await createClient();

  if (options.syncAdvanceNotes) {
    await syncDayDependenciesToCallSheet(shootingDayId);
  }

  const alerts = await getArtOpenDependenciesForDay(projectId, shootingDayId);
  const callSheet = await getOrCreateCallSheetForShootingDay(shootingDayId);

  const { data: shootingDay } = await supabase
    .from("ShootingDay")
    .select("generalCall")
    .eq("id", shootingDayId)
    .single();

  const defaultCallTime = (shootingDay?.generalCall as string | null) || "07:00";

  const { data: existingDepartmentRow, error: rowError } = await supabase
    .from("CallSheetDepartment")
    .select("id, notes, callTime")
    .eq("callSheetId", callSheet.id)
    .eq("department", ART_DEPARTMENT_CALL_LABEL)
    .maybeSingle();

  if (rowError) {
    throw new Error(rowError.message);
  }

  const mergedNotes = mergeArtDepartmentNotes(existingDepartmentRow?.notes || null, alerts);

  if (existingDepartmentRow) {
    const { error: updateError } = await supabase
      .from("CallSheetDepartment")
      .update({
        notes: mergedNotes,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", existingDepartmentRow.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase
      .from("CallSheetDepartment")
      .insert({
        callSheetId: callSheet.id,
        department: ART_DEPARTMENT_CALL_LABEL,
        callTime: defaultCallTime,
        notes: mergedNotes,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  await revalidateProject(projectId);

  return {
    callSheetId: callSheet.id,
    blockerCount: alerts.length,
    departmentNote: mergedNotes,
  };
}

async function refreshArtDependenciesForShootingDayInternal(
  projectId: string,
  shootingDayId: string,
  userId: string,
): Promise<{ readiness: ArtDayReadiness; alerts: DepartmentDayDependency[] }> {
  const supabase = await createClient();

  const { data: shootingDay, error: dayError } = await supabase
    .from("ShootingDay")
    .select("id, dayNumber")
    .eq("id", shootingDayId)
    .eq("projectId", projectId)
    .single();

  if (dayError || !shootingDay) {
    throw new Error("Shooting day not found");
  }

  const desiredAlerts: Array<{
    sourceType: string;
    sourceId: string;
    severity: DepartmentAlertSeverity;
    message: string;
    metadata: Record<string, unknown>;
  }> = [];

  const { data: duePullItems, error: pullItemsError } = await supabase
    .from("ArtPullItem")
    .select("id, listId, name, qty, status, isBlocking")
    .eq("dueDayId", shootingDayId);

  if (pullItemsError) {
    throw new Error(pullItemsError.message);
  }

  const pullItems = (duePullItems || []) as Array<{
    id: string;
    listId: string;
    name: string;
    qty: number;
    status: ArtPullItemStatus;
    isBlocking: boolean;
  }>;

  const listIds = Array.from(new Set(pullItems.map((item) => item.listId)));
  const listMap = new Map<string, { id: string; projectId: string; sceneId: string }>();

  if (listIds.length > 0) {
    const { data: lists, error: listError } = await supabase
      .from("ArtPullList")
      .select("id, projectId, sceneId")
      .in("id", listIds)
      .eq("projectId", projectId);

    if (listError) {
      throw new Error(listError.message);
    }

    for (const list of lists || []) {
      listMap.set(list.id, list as { id: string; projectId: string; sceneId: string });
    }
  }

  const sceneIdsForPullItems = Array.from(
    new Set(
      pullItems
        .map((item) => listMap.get(item.listId)?.sceneId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const sceneNumberMap = new Map<string, string>();
  if (sceneIdsForPullItems.length > 0) {
    const { data: scenes, error: sceneError } = await supabase
      .from("Scene")
      .select("id, sceneNumber")
      .in("id", sceneIdsForPullItems);

    if (sceneError) {
      throw new Error(sceneError.message);
    }

    for (const scene of scenes || []) {
      sceneNumberMap.set(scene.id, scene.sceneNumber as string);
    }
  }

  for (const item of pullItems) {
    const list = listMap.get(item.listId);
    if (!list || !item.isBlocking || isArtPullItemResolved(item.status)) continue;

    const sceneNumber = list.sceneId
      ? sceneNumberMap.get(list.sceneId) || list.sceneId
      : "Unknown";
    const severity: DepartmentAlertSeverity =
      item.status === "TO_SOURCE" ? "CRITICAL" : "WARNING";
    const statusLabel = formatUpperSnake(item.status);

    desiredAlerts.push({
      sourceType: "ART_PULL_ITEM",
      sourceId: item.id,
      severity,
      message: `Scene ${sceneNumber}: ${item.name} x${item.qty} is ${statusLabel}.`,
      metadata: {
        listId: item.listId,
        sceneId: list.sceneId,
        status: item.status,
      },
    });
  }

  const { data: continuityRows, error: continuityError } = await supabase
    .from("ArtContinuityEntry")
    .select("id, sceneId, subjectName, riskLevel")
    .eq("projectId", projectId)
    .eq("dueDayId", shootingDayId)
    .eq("isResolved", false);

  if (continuityError) {
    throw new Error(continuityError.message);
  }

  for (const entry of continuityRows || []) {
    const severity: DepartmentAlertSeverity =
      entry.riskLevel === "HIGH" ? "CRITICAL" : "WARNING";
    const sceneNumber = sceneNumberMap.get(entry.sceneId) || entry.sceneId;

    desiredAlerts.push({
      sourceType: "ART_CONTINUITY_ENTRY",
      sourceId: entry.id,
      severity,
      message: `Scene ${sceneNumber}: continuity risk unresolved for "${entry.subjectName}".`,
      metadata: {
        sceneId: entry.sceneId,
        riskLevel: entry.riskLevel,
      },
    });
  }

  const { data: activeWorkOrders, error: workOrderError } = await supabase
    .from("ArtWorkOrder")
    .select("id, locationId, status, type, startDayId, endDayId, summary")
    .eq("projectId", projectId)
    .neq("status", "DONE");

  if (workOrderError) {
    throw new Error(workOrderError.message);
  }

  const dayIdsFromOrders = Array.from(
    new Set(
      (activeWorkOrders || [])
        .flatMap((order) => [order.startDayId, order.endDayId])
        .filter(Boolean),
    ),
  );

  const orderDayNumberMap = new Map<string, number>();
  if (dayIdsFromOrders.length > 0) {
    const { data: orderDays, error: orderDaysError } = await supabase
      .from("ShootingDay")
      .select("id, dayNumber")
      .in("id", dayIdsFromOrders as string[]);

    if (orderDaysError) {
      throw new Error(orderDaysError.message);
    }

    for (const row of orderDays || []) {
      orderDayNumberMap.set(row.id as string, Number(row.dayNumber));
    }
  }

  const currentDayNumber = Number(shootingDay.dayNumber);
  const activeOrdersOnCurrentDay: Array<{
    id: string;
    locationId: string | null;
    type: string;
    status: string;
    summary: string | null;
  }> = [];

  for (const workOrder of activeWorkOrders || []) {
    const startDayNumber = workOrder.startDayId
      ? orderDayNumberMap.get(workOrder.startDayId) ?? currentDayNumber
      : currentDayNumber;
    const endDayNumber = workOrder.endDayId
      ? orderDayNumberMap.get(workOrder.endDayId) ?? startDayNumber
      : startDayNumber;

    const normalizedStart = Math.min(startDayNumber, endDayNumber);
    const normalizedEnd = Math.max(startDayNumber, endDayNumber);
    const overlapsCurrentDay =
      currentDayNumber >= normalizedStart && currentDayNumber <= normalizedEnd;

    if (!overlapsCurrentDay) continue;

    activeOrdersOnCurrentDay.push({
      id: workOrder.id as string,
      locationId: (workOrder.locationId as string | null) || null,
      type: workOrder.type as string,
      status: workOrder.status as string,
      summary: (workOrder.summary as string | null) || null,
    });

    const severity: DepartmentAlertSeverity =
      workOrder.status === "BLOCKED" ? "CRITICAL" : "WARNING";

    desiredAlerts.push({
      sourceType: "ART_WORK_ORDER",
      sourceId: workOrder.id as string,
      severity,
      message: `${formatUpperSnake(workOrder.type as string)} work order is ${formatUpperSnake(
        workOrder.status as string,
      )} for this shooting window.`,
      metadata: {
        workOrderType: workOrder.type,
        workOrderStatus: workOrder.status,
      },
    });
  }

  const locationIds = Array.from(
    new Set(
      activeOrdersOnCurrentDay
        .map((workOrder) => workOrder.locationId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const locationNameMap = new Map<string, string>();
  if (locationIds.length > 0) {
    const { data: locations, error: locationError } = await supabase
      .from("Location")
      .select("id, name")
      .in("id", locationIds);

    if (locationError) {
      throw new Error(locationError.message);
    }

    for (const location of locations || []) {
      locationNameMap.set(location.id as string, (location.name as string) || location.id);
    }
  }

  const locationConflicts = new Map<string, typeof activeOrdersOnCurrentDay>();
  for (const workOrder of activeOrdersOnCurrentDay) {
    if (!workOrder.locationId) continue;
    const current = locationConflicts.get(workOrder.locationId) || [];
    current.push(workOrder);
    locationConflicts.set(workOrder.locationId, current);
  }

  for (const [locationId, orders] of locationConflicts.entries()) {
    if (orders.length <= 1) continue;

    const locationLabel = locationNameMap.get(locationId) || locationId;
    const orderLabels = orders
      .map((order) => order.summary?.trim() || formatUpperSnake(order.type))
      .slice(0, 3);
    const extraCount = orders.length - orderLabels.length;
    const orderSummary =
      extraCount > 0
        ? `${orderLabels.join(", ")}, +${extraCount} more`
        : orderLabels.join(", ");

    desiredAlerts.push({
      sourceType: "ART_LOCATION_CONFLICT",
      sourceId: locationId,
      severity: "CRITICAL",
      message: `Location conflict: ${locationLabel} has ${orders.length} overlapping Art work orders (${orderSummary}).`,
      metadata: {
        locationId,
        workOrderIds: orders.map((order) => order.id),
      },
    });
  }

  for (const alert of desiredAlerts) {
    const { error } = await supabase
      .from("DepartmentDayDependency")
      .upsert(
        {
          projectId,
          shootingDayId,
          department: ART_DEPARTMENT_KEY,
          sourceType: alert.sourceType,
          sourceId: alert.sourceId,
          status: "OPEN",
          severity: alert.severity,
          message: alert.message,
          metadata: alert.metadata,
          createdBy: userId,
          resolvedBy: null,
          resolvedAt: null,
        },
        { onConflict: "projectId,shootingDayId,department,sourceType,sourceId" },
      );

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: existingOpenDependencies, error: dependenciesError } = await supabase
    .from("DepartmentDayDependency")
    .select("id, sourceType, sourceId")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .eq("department", ART_DEPARTMENT_KEY)
    .eq("status", "OPEN");

  if (dependenciesError) {
    throw new Error(dependenciesError.message);
  }

  const desiredKeys = new Set(
    desiredAlerts.map((alert) => dependencyKey(alert.sourceType, alert.sourceId)),
  );

  for (const existingDependency of existingOpenDependencies || []) {
    const key = dependencyKey(
      existingDependency.sourceType as string,
      existingDependency.sourceId as string,
    );
    if (desiredKeys.has(key)) continue;

    const { error } = await supabase
      .from("DepartmentDayDependency")
      .update({
        status: "RESOLVED" as DepartmentDependencyStatus,
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", existingDependency.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  await syncArtBlockersToCallSheetInternal(projectId, shootingDayId, userId, {
    syncAdvanceNotes: true,
  });

  return getArtDependenciesForShootingDay(projectId, shootingDayId);
}

export async function getArtWorkspaceData(projectId: string): Promise<ArtWorkspaceData> {
  await getPermissionContext(projectId);
  const supabase = await createClient();

  const [
    continuityBookResult,
    continuityEntriesResult,
    pullListsResult,
    workOrdersResult,
    sceneReadinessResult,
    dayDependenciesResult,
    budgetLinksResult,
  ] = await Promise.all([
    supabase.from("ArtContinuityBook").select("*").eq("projectId", projectId).maybeSingle(),
    supabase
      .from("ArtContinuityEntry")
      .select("*")
      .eq("projectId", projectId)
      .order("updatedAt", { ascending: false }),
    supabase
      .from("ArtPullList")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("ArtWorkOrder")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("DepartmentSceneReadiness")
      .select("*")
      .eq("projectId", projectId)
      .eq("department", ART_DEPARTMENT_KEY)
      .order("updatedAt", { ascending: false }),
    supabase
      .from("DepartmentDayDependency")
      .select("*")
      .eq("projectId", projectId)
      .eq("department", ART_DEPARTMENT_KEY)
      .eq("status", "OPEN")
      .order("updatedAt", { ascending: false }),
    supabase
      .from("DepartmentBudgetLink")
      .select("*")
      .eq("projectId", projectId)
      .eq("department", ART_DEPARTMENT_KEY)
      .order("updatedAt", { ascending: false }),
  ]);

  const continuityEntries = (continuityEntriesResult.data || []) as ArtContinuityEntry[];
  const continuityEntryIds = continuityEntries.map((entry) => entry.id);

  let continuityPhotos: ArtContinuityPhoto[] = [];
  if (continuityEntryIds.length > 0) {
    const continuityPhotosResult = await supabase
      .from("ArtContinuityPhoto")
      .select("*")
      .in("entryId", continuityEntryIds)
      .order("sortOrder", { ascending: true });

    continuityPhotos = (continuityPhotosResult.data || []) as ArtContinuityPhoto[];
  }

  const pullLists = (pullListsResult.data || []) as ArtPullList[];
  const pullListIds = pullLists.map((list) => list.id);

  let pullItems: ArtPullItem[] = [];
  if (pullListIds.length > 0) {
    const pullItemsResult = await supabase
      .from("ArtPullItem")
      .select("*")
      .in("listId", pullListIds)
      .order("createdAt", { ascending: true });
    pullItems = (pullItemsResult.data || []) as ArtPullItem[];
  }

  const workOrders = (workOrdersResult.data || []) as ArtWorkOrder[];
  const workOrderIds = workOrders.map((order) => order.id);

  let workOrderScenes: ArtWorkOrderScene[] = [];
  let crewAssignments: ArtCrewAssignment[] = [];
  if (workOrderIds.length > 0) {
    const [workOrderScenesResult, crewAssignmentsResult] = await Promise.all([
      supabase
        .from("ArtWorkOrderScene")
        .select("*")
        .in("workOrderId", workOrderIds),
      supabase
        .from("ArtCrewAssignment")
        .select("*")
        .in("workOrderId", workOrderIds),
    ]);

    workOrderScenes = (workOrderScenesResult.data || []) as ArtWorkOrderScene[];
    crewAssignments = (crewAssignmentsResult.data || []) as ArtCrewAssignment[];
  }

  return {
    continuityBook: (continuityBookResult.data || null) as ArtContinuityBook | null,
    continuityEntries,
    continuityPhotos,
    pullLists,
    pullItems,
    workOrders,
    workOrderScenes,
    crewAssignments,
    sceneReadiness: (sceneReadinessResult.data || []) as DepartmentSceneReadiness[],
    dayDependencies: (dayDependenciesResult.data || []) as DepartmentDayDependency[],
    budgetLinks: (budgetLinksResult.data || []) as DepartmentBudgetLink[],
  };
}

export async function getArtDependenciesForShootingDay(
  projectId: string,
  shootingDayId: string,
): Promise<{ readiness: ArtDayReadiness; alerts: DepartmentDayDependency[] }> {
  await getPermissionContext(projectId);
  const alerts = await getArtOpenDependenciesForDay(projectId, shootingDayId);
  return {
    readiness: deriveArtDayReadiness(alerts),
    alerts,
  };
}

export async function refreshArtReadinessForScene(
  projectId: string,
  sceneId: string,
): Promise<DepartmentSceneReadiness | null> {
  const { userId } = await requireArtManager(projectId);
  return refreshArtReadinessForSceneInternal(projectId, sceneId, userId);
}

async function refreshArtReadinessForSceneInternal(
  projectId: string,
  sceneId: string,
  userId: string,
): Promise<DepartmentSceneReadiness | null> {
  const supabase = await createClient();

  const { data: pullLists, error: pullListError } = await supabase
    .from("ArtPullList")
    .select("id")
    .eq("projectId", projectId)
    .eq("sceneId", sceneId);

  if (pullListError) {
    throw new Error(pullListError.message);
  }

  const listIds = (pullLists || []).map((list) => list.id as string);
  let pullItems: ArtPullItem[] = [];
  if (listIds.length > 0) {
    const { data: pullItemsData, error: pullItemsError } = await supabase
      .from("ArtPullItem")
      .select("*")
      .in("listId", listIds);

    if (pullItemsError) {
      throw new Error(pullItemsError.message);
    }

    pullItems = (pullItemsData || []) as ArtPullItem[];
  }

  const { data: continuityEntries, error: continuityError } = await supabase
    .from("ArtContinuityEntry")
    .select("id, isResolved")
    .eq("projectId", projectId)
    .eq("sceneId", sceneId);

  if (continuityError) {
    throw new Error(continuityError.message);
  }

  const unresolvedPullCount = pullItems.filter(
    (item) => item.isBlocking && !isArtPullItemResolved(item.status),
  ).length;
  const unresolvedContinuityCount = (continuityEntries || []).filter(
    (entry) => !entry.isResolved,
  ).length;

  const totalTracked = pullItems.length + (continuityEntries || []).length;
  const blockerCount = unresolvedPullCount + unresolvedContinuityCount;
  const status = computeArtReadiness(totalTracked, blockerCount);

  let summary = "No Art prep records yet.";
  if (totalTracked > 0 && blockerCount === 0) {
    summary = "All Art pull and continuity items are resolved.";
  } else if (totalTracked > 0 && blockerCount > 0) {
    summary = `${blockerCount} unresolved Art item${blockerCount === 1 ? "" : "s"} of ${totalTracked}.`;
  }

  const { data, error } = await supabase
    .from("DepartmentSceneReadiness")
    .upsert(
      {
        projectId,
        sceneId,
        department: ART_DEPARTMENT_KEY,
        status,
        notes: summary,
        updatedBy: userId,
      },
      { onConflict: "sceneId,department" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await revalidateProject(projectId);
  return data as DepartmentSceneReadiness;
}

export async function refreshArtDependenciesForShootingDay(
  projectId: string,
  shootingDayId: string,
): Promise<{ readiness: ArtDayReadiness; alerts: DepartmentDayDependency[] }> {
  const { userId } = await requireArtManager(projectId);
  return refreshArtDependenciesForShootingDayInternal(projectId, shootingDayId, userId);
}

export async function syncArtBlockersToCallSheet(
  shootingDayId: string,
): Promise<{ callSheetId: string; blockerCount: number; departmentNote: string | null }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: day, error: dayError } = await supabase
    .from("ShootingDay")
    .select("id, projectId")
    .eq("id", shootingDayId)
    .single();

  if (dayError || !day) {
    throw new Error("Shooting day not found");
  }

  await requireArtManager(day.projectId as string);

  return syncArtBlockersToCallSheetInternal(
    day.projectId as string,
    shootingDayId,
    userId,
    { syncAdvanceNotes: true },
  );
}

export async function createArtContinuityEntry(input: {
  projectId: string;
  sceneId: string;
  scriptDay?: string | null;
  dueDayId?: string | null;
  subjectType?: ArtContinuitySubjectType;
  subjectName: string;
  notes?: string | null;
  tags?: string[];
  riskLevel?: ArtRiskLevel;
}): Promise<ArtContinuityEntry> {
  const { userId } = await requireArtManager(input.projectId);
  const supabase = await createClient();

  const subjectName = input.subjectName.trim();
  if (!subjectName) {
    throw new Error("Subject is required");
  }

  const continuityBook = await ensureArtContinuityBook(input.projectId, userId);

  const { data, error } = await supabase
    .from("ArtContinuityEntry")
    .insert({
      projectId: input.projectId,
      continuityBookId: continuityBook.id,
      sceneId: input.sceneId,
      dueDayId: input.dueDayId || null,
      scriptDay: trimOrNull(input.scriptDay),
      subjectType: input.subjectType || "SET",
      subjectName,
      notes: trimOrNull(input.notes),
      tags: input.tags || [],
      riskLevel: input.riskLevel || "MEDIUM",
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create continuity entry");
  }

  await refreshArtReadinessForSceneInternal(input.projectId, input.sceneId, userId);
  if (data.dueDayId) {
    await refreshArtDependenciesForShootingDayInternal(
      input.projectId,
      data.dueDayId as string,
      userId,
    );
  }
  await revalidateProject(input.projectId);
  return data as ArtContinuityEntry;
}

export async function updateArtContinuityEntry(
  entryId: string,
  updates: Partial<{
    scriptDay: string | null;
    dueDayId: string | null;
    subjectType: ArtContinuitySubjectType;
    subjectName: string;
    notes: string | null;
    tags: string[];
    riskLevel: ArtRiskLevel;
    isResolved: boolean;
  }>,
): Promise<ArtContinuityEntry> {
  const projectId = await resolveProjectIdForContinuityEntry(entryId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("ArtContinuityEntry")
    .select("*")
    .eq("id", entryId)
    .single();

  if (existingError || !existing) {
    throw new Error("Continuity entry not found");
  }

  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.scriptDay !== undefined) updatePayload.scriptDay = trimOrNull(updates.scriptDay);
  if (updates.dueDayId !== undefined) updatePayload.dueDayId = updates.dueDayId || null;
  if (updates.subjectType !== undefined) updatePayload.subjectType = updates.subjectType;
  if (updates.subjectName !== undefined) updatePayload.subjectName = updates.subjectName.trim();
  if (updates.notes !== undefined) updatePayload.notes = trimOrNull(updates.notes);
  if (updates.tags !== undefined) updatePayload.tags = updates.tags;
  if (updates.riskLevel !== undefined) updatePayload.riskLevel = updates.riskLevel;
  if (updates.isResolved !== undefined) {
    updatePayload.isResolved = updates.isResolved;
    updatePayload.resolvedBy = updates.isResolved ? userId : null;
    updatePayload.resolvedAt = updates.isResolved ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("ArtContinuityEntry")
    .update(updatePayload)
    .eq("id", entryId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update continuity entry");
  }

  await refreshArtReadinessForSceneInternal(projectId, data.sceneId as string, userId);

  const affectedDayIds = new Set<string>();
  if (existing.dueDayId) affectedDayIds.add(existing.dueDayId as string);
  if (data.dueDayId) affectedDayIds.add(data.dueDayId as string);

  for (const dayId of affectedDayIds) {
    await refreshArtDependenciesForShootingDayInternal(projectId, dayId, userId);
  }

  await revalidateProject(projectId);
  return data as ArtContinuityEntry;
}

export async function addArtContinuityPhoto(input: {
  entryId: string;
  fileUrl: string;
  angle?: string | null;
  lookType?: string | null;
  sortOrder?: number;
}): Promise<ArtContinuityPhoto> {
  const projectId = await resolveProjectIdForContinuityEntry(input.entryId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ArtContinuityPhoto")
    .insert({
      entryId: input.entryId,
      fileUrl: input.fileUrl,
      angle: trimOrNull(input.angle),
      lookType: trimOrNull(input.lookType),
      sortOrder: input.sortOrder ?? 0,
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to add continuity photo");
  }

  await revalidateProject(projectId);
  return data as ArtContinuityPhoto;
}

export async function deleteArtContinuityPhoto(photoId: string): Promise<void> {
  const supabase = await createClient();
  const { data: photo, error: photoError } = await supabase
    .from("ArtContinuityPhoto")
    .select("entryId")
    .eq("id", photoId)
    .single();

  if (photoError || !photo) {
    throw new Error("Continuity photo not found");
  }

  const projectId = await resolveProjectIdForContinuityEntry(photo.entryId as string);
  await requireArtManager(projectId);

  const { error } = await supabase
    .from("ArtContinuityPhoto")
    .delete()
    .eq("id", photoId);

  if (error) {
    throw new Error(error.message);
  }

  await revalidateProject(projectId);
}

export async function createArtPullListFromScene(input: {
  projectId: string;
  sceneId: string;
  shootingDayId?: string | null;
  ownerCrewId?: string | null;
  notes?: string | null;
  overwriteExisting?: boolean;
}): Promise<{ pullList: ArtPullList; createdItemCount: number }> {
  const { userId } = await requireArtManager(input.projectId);
  const supabase = await createClient();

  const { data: scene, error: sceneError } = await supabase
    .from("Scene")
    .select("id")
    .eq("id", input.sceneId)
    .eq("projectId", input.projectId)
    .single();

  if (sceneError || !scene) {
    throw new Error("Scene not found for this project");
  }

  let existingQuery = supabase
    .from("ArtPullList")
    .select("*")
    .eq("projectId", input.projectId)
    .eq("sceneId", input.sceneId);

  if (input.shootingDayId) {
    existingQuery = existingQuery.eq("shootingDayId", input.shootingDayId);
  } else {
    existingQuery = existingQuery.is("shootingDayId", null);
  }

  const { data: existingList, error: existingListError } = await existingQuery.maybeSingle();

  if (existingListError) {
    throw new Error(existingListError.message);
  }

  let pullList = existingList as ArtPullList | null;

  if (!pullList) {
    const { data: createdList, error: createListError } = await supabase
      .from("ArtPullList")
      .insert({
        projectId: input.projectId,
        sceneId: input.sceneId,
        shootingDayId: input.shootingDayId || null,
        ownerCrewId: input.ownerCrewId || null,
        notes: trimOrNull(input.notes),
        status: "DRAFT",
        createdBy: userId,
      })
      .select("*")
      .single();

    if (createListError || !createdList) {
      throw new Error(createListError?.message || "Failed to create Art pull list");
    }

    pullList = createdList as ArtPullList;
  } else if (input.overwriteExisting) {
    const { error: clearError } = await supabase
      .from("ArtPullItem")
      .delete()
      .eq("listId", pullList.id);
    if (clearError) {
      throw new Error(clearError.message);
    }
  } else {
    return { pullList, createdItemCount: 0 };
  }

  const { data: sceneElements, error: sceneElementsError } = await supabase
    .from("SceneElement")
    .select("id, quantity, notes, element:Element(name, category)")
    .eq("sceneId", input.sceneId);

  if (sceneElementsError) {
    throw new Error(sceneElementsError.message);
  }

  const artRows = (sceneElements || []).filter((row) => {
    const element = row.element as { name: string; category: string } | { name: string; category: string }[] | null;
    const normalized = Array.isArray(element) ? element[0] : element;
    if (!normalized) return false;
    return ART_SCENE_ELEMENT_CATEGORIES.has(normalized.category);
  });

  if (artRows.length === 0) {
    await refreshPullListStatus(pullList.id);
    await refreshArtReadinessForSceneInternal(input.projectId, input.sceneId, userId);
    if (input.shootingDayId) {
      await refreshArtDependenciesForShootingDayInternal(
        input.projectId,
        input.shootingDayId,
        userId,
      );
    }
    await revalidateProject(input.projectId);
    return { pullList, createdItemCount: 0 };
  }

  const itemsToInsert = artRows.map((row) => {
    const element = row.element as { name: string; category: string } | { name: string; category: string }[] | null;
    const normalized = Array.isArray(element) ? element[0] : element;
    return {
      listId: pullList!.id,
      sourceElementId: row.id,
      name: normalized?.name || "Art item",
      qty: Math.max(1, Number(row.quantity || 1)),
      source: "STOCK" as ArtPullSource,
      dueDayId: input.shootingDayId || null,
      status: "TO_SOURCE" as ArtPullItemStatus,
      notes: trimOrNull(row.notes as string | null | undefined),
      isBlocking: true,
    };
  });

  const { error: insertItemsError } = await supabase
    .from("ArtPullItem")
    .insert(itemsToInsert);

  if (insertItemsError) {
    throw new Error(insertItemsError.message);
  }

  await refreshPullListStatus(pullList.id);
  await refreshArtReadinessForSceneInternal(input.projectId, input.sceneId, userId);
  if (input.shootingDayId) {
    await refreshArtDependenciesForShootingDayInternal(input.projectId, input.shootingDayId, userId);
  }

  await revalidateProject(input.projectId);

  return { pullList, createdItemCount: itemsToInsert.length };
}

export async function createArtPullItem(input: {
  listId: string;
  sourceElementId?: string | null;
  name: string;
  qty?: number;
  source?: ArtPullSource;
  dueDayId?: string | null;
  status?: ArtPullItemStatus;
  vendor?: string | null;
  plannedUnitCost?: number;
  plannedAmount?: number;
  actualAmount?: number;
  isBlocking?: boolean;
  notes?: string | null;
}): Promise<ArtPullItem> {
  const projectId = await resolveProjectIdForPullList(input.listId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) {
    throw new Error("Item name is required");
  }

  const qty = Math.max(1, Math.round(parseNumber(input.qty || 1)));
  const plannedUnitCost = formatCurrencyLike(parseNumber(input.plannedUnitCost));
  const plannedAmount =
    input.plannedAmount !== undefined
      ? formatCurrencyLike(parseNumber(input.plannedAmount))
      : formatCurrencyLike(plannedUnitCost * qty);
  const actualAmount = formatCurrencyLike(parseNumber(input.actualAmount));

  const { data: createdItem, error } = await supabase
    .from("ArtPullItem")
    .insert({
      listId: input.listId,
      sourceElementId: input.sourceElementId || null,
      name,
      qty,
      source: input.source || "STOCK",
      dueDayId: input.dueDayId || null,
      status: input.status || "TO_SOURCE",
      vendor: trimOrNull(input.vendor),
      plannedUnitCost,
      plannedAmount,
      actualAmount,
      isBlocking: input.isBlocking ?? true,
      notes: trimOrNull(input.notes),
    })
    .select("*")
    .single();

  if (error || !createdItem) {
    throw new Error(error?.message || "Failed to create Art pull item");
  }

  const { data: pullList } = await supabase
    .from("ArtPullList")
    .select("sceneId, shootingDayId")
    .eq("id", input.listId)
    .single();

  await refreshPullListStatus(input.listId);
  if (pullList?.sceneId) {
    await refreshArtReadinessForSceneInternal(projectId, pullList.sceneId as string, userId);
  }

  const affectedDayIds = new Set<string>();
  if (createdItem.dueDayId) affectedDayIds.add(createdItem.dueDayId as string);
  if (pullList?.shootingDayId) affectedDayIds.add(pullList.shootingDayId as string);

  for (const dayId of affectedDayIds) {
    await refreshArtDependenciesForShootingDayInternal(projectId, dayId, userId);
  }

  await revalidateProject(projectId);
  return createdItem as ArtPullItem;
}

export async function updateArtPullItem(
  itemId: string,
  updates: Partial<{
    name: string;
    qty: number;
    source: ArtPullSource;
    dueDayId: string | null;
    status: ArtPullItemStatus;
    vendor: string | null;
    plannedUnitCost: number;
    plannedAmount: number;
    actualAmount: number;
    isBlocking: boolean;
    notes: string | null;
  }>,
): Promise<ArtPullItem> {
  const projectId = await resolveProjectIdForPullItem(itemId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("ArtPullItem")
    .select("*, list:ArtPullList(sceneId, shootingDayId)")
    .eq("id", itemId)
    .single();

  if (existingError || !existing) {
    throw new Error("Art pull item not found");
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.qty !== undefined) payload.qty = Math.max(1, Math.round(parseNumber(updates.qty)));
  if (updates.source !== undefined) payload.source = updates.source;
  if (updates.dueDayId !== undefined) payload.dueDayId = updates.dueDayId || null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.vendor !== undefined) payload.vendor = trimOrNull(updates.vendor);
  if (updates.plannedUnitCost !== undefined) {
    payload.plannedUnitCost = formatCurrencyLike(parseNumber(updates.plannedUnitCost));
  }
  if (updates.plannedAmount !== undefined) {
    payload.plannedAmount = formatCurrencyLike(parseNumber(updates.plannedAmount));
  }
  if (updates.actualAmount !== undefined) {
    payload.actualAmount = formatCurrencyLike(parseNumber(updates.actualAmount));
  }
  if (updates.isBlocking !== undefined) payload.isBlocking = updates.isBlocking;
  if (updates.notes !== undefined) payload.notes = trimOrNull(updates.notes);

  const { data, error } = await supabase
    .from("ArtPullItem")
    .update(payload)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update Art pull item");
  }

  const list = existing.list as { sceneId?: string; shootingDayId?: string | null } | { sceneId?: string; shootingDayId?: string | null }[] | null;
  const normalizedList = Array.isArray(list) ? list[0] : list;

  await refreshPullListStatus(existing.listId as string);

  if (normalizedList?.sceneId) {
    await refreshArtReadinessForSceneInternal(projectId, normalizedList.sceneId, userId);
  }

  const affectedDayIds = new Set<string>();
  if (existing.dueDayId) affectedDayIds.add(existing.dueDayId as string);
  if (data.dueDayId) affectedDayIds.add(data.dueDayId as string);
  if (normalizedList?.shootingDayId) affectedDayIds.add(normalizedList.shootingDayId);

  for (const dayId of affectedDayIds) {
    await refreshArtDependenciesForShootingDayInternal(projectId, dayId, userId);
  }

  await revalidateProject(projectId);
  return data as ArtPullItem;
}

export async function updateArtPullItemStatus(
  itemId: string,
  status: ArtPullItemStatus,
): Promise<ArtPullItem> {
  return updateArtPullItem(itemId, { status });
}

export async function deleteArtPullItem(itemId: string): Promise<void> {
  const projectId = await resolveProjectIdForPullItem(itemId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("ArtPullItem")
    .select("listId, dueDayId, list:ArtPullList(sceneId, shootingDayId)")
    .eq("id", itemId)
    .single();

  if (existingError || !existing) {
    throw new Error("Art pull item not found");
  }

  const { error } = await supabase
    .from("ArtPullItem")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  await refreshPullListStatus(existing.listId as string);

  const list = existing.list as { sceneId?: string; shootingDayId?: string | null } | { sceneId?: string; shootingDayId?: string | null }[] | null;
  const normalizedList = Array.isArray(list) ? list[0] : list;

  if (normalizedList?.sceneId) {
    await refreshArtReadinessForSceneInternal(projectId, normalizedList.sceneId, userId);
  }

  const affectedDayIds = new Set<string>();
  if (existing.dueDayId) affectedDayIds.add(existing.dueDayId as string);
  if (normalizedList?.shootingDayId) affectedDayIds.add(normalizedList.shootingDayId);

  for (const dayId of affectedDayIds) {
    await refreshArtDependenciesForShootingDayInternal(projectId, dayId, userId);
  }

  await revalidateProject(projectId);
}

export async function createArtWorkOrder(input: {
  projectId: string;
  locationId?: string | null;
  sceneIds?: string[];
  type: ArtWorkOrderType;
  startDayId?: string | null;
  endDayId?: string | null;
  status?: ArtWorkOrderStatus;
  summary?: string | null;
  notes?: string | null;
}): Promise<ArtWorkOrder> {
  const { userId } = await requireArtManager(input.projectId);
  const supabase = await createClient();

  const { data: workOrder, error } = await supabase
    .from("ArtWorkOrder")
    .insert({
      projectId: input.projectId,
      locationId: input.locationId || null,
      type: input.type,
      startDayId: input.startDayId || null,
      endDayId: input.endDayId || null,
      status: input.status || "PLANNED",
      summary: trimOrNull(input.summary),
      notes: trimOrNull(input.notes),
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error || !workOrder) {
    throw new Error(error?.message || "Failed to create Art work order");
  }

  if (input.sceneIds && input.sceneIds.length > 0) {
    const rows = Array.from(new Set(input.sceneIds)).map((sceneId) => ({
      workOrderId: workOrder.id,
      sceneId,
    }));
    const { error: sceneLinkError } = await supabase
      .from("ArtWorkOrderScene")
      .insert(rows);

    if (sceneLinkError) {
      throw new Error(sceneLinkError.message);
    }
  }

  const affectedDayIds = new Set<string>();
  if (workOrder.startDayId) affectedDayIds.add(workOrder.startDayId as string);
  if (workOrder.endDayId) affectedDayIds.add(workOrder.endDayId as string);

  for (const dayId of affectedDayIds) {
    await refreshArtDependenciesForShootingDayInternal(input.projectId, dayId, userId);
  }

  await revalidateProject(input.projectId);
  return workOrder as ArtWorkOrder;
}

export async function updateArtWorkOrder(
  workOrderId: string,
  updates: Partial<{
    locationId: string | null;
    type: ArtWorkOrderType;
    startDayId: string | null;
    endDayId: string | null;
    status: ArtWorkOrderStatus;
    summary: string | null;
    notes: string | null;
  }>,
): Promise<ArtWorkOrder> {
  const projectId = await resolveProjectIdForWorkOrder(workOrderId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("ArtWorkOrder")
    .select("*")
    .eq("id", workOrderId)
    .single();

  if (existingError || !existing) {
    throw new Error("Art work order not found");
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.locationId !== undefined) payload.locationId = updates.locationId || null;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.startDayId !== undefined) payload.startDayId = updates.startDayId || null;
  if (updates.endDayId !== undefined) payload.endDayId = updates.endDayId || null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.summary !== undefined) payload.summary = trimOrNull(updates.summary);
  if (updates.notes !== undefined) payload.notes = trimOrNull(updates.notes);

  const { data, error } = await supabase
    .from("ArtWorkOrder")
    .update(payload)
    .eq("id", workOrderId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update Art work order");
  }

  const affectedDayIds = new Set<string>();
  if (existing.startDayId) affectedDayIds.add(existing.startDayId as string);
  if (existing.endDayId) affectedDayIds.add(existing.endDayId as string);
  if (data.startDayId) affectedDayIds.add(data.startDayId as string);
  if (data.endDayId) affectedDayIds.add(data.endDayId as string);

  for (const dayId of affectedDayIds) {
    await refreshArtDependenciesForShootingDayInternal(projectId, dayId, userId);
  }

  await revalidateProject(projectId);
  return data as ArtWorkOrder;
}

export async function setArtWorkOrderScenes(
  workOrderId: string,
  sceneIds: string[],
): Promise<void> {
  const projectId = await resolveProjectIdForWorkOrder(workOrderId);
  await requireArtManager(projectId);
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("ArtWorkOrderScene")
    .delete()
    .eq("workOrderId", workOrderId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const uniqueSceneIds = Array.from(new Set(sceneIds.filter(Boolean)));
  if (uniqueSceneIds.length > 0) {
    const { error: insertError } = await supabase
      .from("ArtWorkOrderScene")
      .insert(
        uniqueSceneIds.map((sceneId) => ({
          workOrderId,
          sceneId,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  await revalidateProject(projectId);
}

export async function assignArtCrewToWorkOrder(input: {
  workOrderId: string;
  crewMemberId: string;
  hours?: number;
}): Promise<ArtCrewAssignment> {
  const projectId = await resolveProjectIdForWorkOrder(input.workOrderId);
  await requireArtManager(projectId);
  const supabase = await createClient();

  const hours = formatCurrencyLike(parseNumber(input.hours || 0));

  const { data, error } = await supabase
    .from("ArtCrewAssignment")
    .upsert(
      {
        workOrderId: input.workOrderId,
        crewMemberId: input.crewMemberId,
        hours,
      },
      { onConflict: "workOrderId,crewMemberId" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to assign crew to work order");
  }

  await revalidateProject(projectId);
  return data as ArtCrewAssignment;
}

export async function syncArtPullItemToBudget(input: {
  pullItemId: string;
  budgetId?: string;
  categoryId?: string;
}): Promise<{ lineItemId: string; link: DepartmentBudgetLink }> {
  const projectId = await resolveProjectIdForPullItem(input.pullItemId);
  const { userId } = await requireArtManager(projectId);
  const supabase = await createClient();

  const { data: itemWithList, error: itemError } = await supabase
    .from("ArtPullItem")
    .select("*, list:ArtPullList(projectId)")
    .eq("id", input.pullItemId)
    .single();

  if (itemError || !itemWithList) {
    throw new Error("Art pull item not found");
  }

  let budgetId = input.budgetId || null;
  if (!budgetId) {
    const { data: latestBudget, error: budgetError } = await supabase
      .from("Budget")
      .select("id")
      .eq("projectId", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (budgetError || !latestBudget) {
      throw new Error("No budget found for this project");
    }
    budgetId = latestBudget.id as string;
  }

  let categoryId = input.categoryId || null;
  if (!categoryId) {
    const { data: preferredCategory } = await supabase
      .from("BudgetCategory")
      .select("id")
      .eq("budgetId", budgetId)
      .ilike("name", "%art%")
      .order("sortOrder", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (preferredCategory?.id) {
      categoryId = preferredCategory.id as string;
    } else {
      const { data: fallbackCategory, error: fallbackCategoryError } = await supabase
        .from("BudgetCategory")
        .select("id")
        .eq("budgetId", budgetId)
        .order("sortOrder", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallbackCategoryError || !fallbackCategory) {
        throw new Error("No budget category available for sync");
      }
      categoryId = fallbackCategory.id as string;
    }
  }

  const qty = Math.max(1, Number(itemWithList.qty || 1));
  const plannedUnitCost =
    formatCurrencyLike(parseNumber(itemWithList.plannedUnitCost)) ||
    formatCurrencyLike(parseNumber(itemWithList.plannedAmount) / qty);

  const lineItem = await createBudgetLineItem(categoryId, {
    accountCode: "2200",
    description: `[Art Pull] ${itemWithList.name}`,
    units: "EACH",
    quantity: qty,
    rate: plannedUnitCost,
    fringePercent: 0,
    notes: trimOrNull(itemWithList.notes) || "Synced from Art pull list item.",
  });

  const plannedAmount =
    formatCurrencyLike(parseNumber(itemWithList.plannedAmount)) ||
    formatCurrencyLike(plannedUnitCost * qty);
  const actualAmount = formatCurrencyLike(parseNumber(itemWithList.actualAmount));

  const { data: link, error: linkError } = await supabase
    .from("DepartmentBudgetLink")
    .upsert(
      {
        projectId,
        department: ART_DEPARTMENT_KEY,
        sourceType: "ART_PULL_ITEM",
        sourceId: input.pullItemId,
        budgetId,
        categoryId,
        lineItemId: lineItem.id,
        plannedAmount,
        committedAmount: plannedAmount,
        actualAmount,
        lastSyncedAt: new Date().toISOString(),
        createdBy: userId,
      },
      { onConflict: "projectId,department,sourceType,sourceId" },
    )
    .select("*")
    .single();

  if (linkError || !link) {
    throw new Error(linkError?.message || "Failed to create budget sync link");
  }

  await revalidateProject(projectId);
  return {
    lineItemId: lineItem.id,
    link: link as DepartmentBudgetLink,
  };
}
