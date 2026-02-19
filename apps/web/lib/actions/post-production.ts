"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import {
  deriveIngestBatchStatus,
  normalizeRolls,
} from "@/lib/post-production/workflow";
import {
  createDepartmentAttachment,
  getDepartmentAttachments,
  type DepartmentAttachment,
} from "@/lib/actions/departments-attachments";
import {
  createDepartmentComment,
  getDepartmentComments,
} from "@/lib/actions/departments-comments";
import {
  getDepartmentDayDependencies,
  getDepartmentSceneReadiness,
  resolveDepartmentDependencyBySource,
  syncDayDependenciesToCallSheet,
  upsertDepartmentDayDependency,
  upsertDepartmentSceneReadiness,
  type DepartmentDayDependency,
  type DepartmentSceneReadiness,
} from "@/lib/actions/departments-readiness";

type ProjectRole =
  | "ADMIN"
  | "COORDINATOR"
  | "DEPARTMENT_HEAD"
  | "CREW"
  | "CAST"
  | "VIEWER";

type PostManagerRole = "ADMIN" | "COORDINATOR" | "DEPARTMENT_HEAD";

export type DepartmentReadinessStatus = "NOT_READY" | "IN_PROGRESS" | "READY";
export type PostIngestBatchStatus = "QUEUED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED";
export type PostIngestQcStatus = "PENDING" | "PASSED" | "FAILED" | "MISSING";
export type PostIssueStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type EditVersionStatus = "ASSEMBLY" | "DIRECTOR_CUT" | "LOCKED";
export type EditReviewNoteStatus = "OPEN" | "RESOLVED";
export type VfxShotStatus = "NOT_SENT" | "IN_VENDOR" | "CLIENT_REVIEW" | "FINAL";
export type DeliveryChecklistStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETE";
export type PostAlertSeverity = "INFO" | "WARNING" | "BLOCKER";
export type PostAlertStatus = "OPEN" | "RESOLVED";

export type PostBudgetSourceType =
  | "INGEST_BATCH"
  | "INGEST_ITEM"
  | "EDIT_VERSION"
  | "VFX_SHOT"
  | "DELIVERY_ITEM";

export type PostEntityType =
  | "INGEST_BATCH"
  | "INGEST_ITEM"
  | "EDIT_VERSION"
  | "EDIT_REVIEW_NOTE"
  | "VFX_SHOT"
  | "VFX_TURNOVER"
  | "DELIVERY_ITEM"
  | "DEPENDENCY_ALERT";

export interface PostSceneReadiness {
  id: string;
  projectId: string;
  sceneId: string;
  status: DepartmentReadinessStatus;
  blockerCount: number;
  summary: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostDayReadiness {
  id: string;
  projectId: string;
  shootingDayId: string;
  status: DepartmentReadinessStatus;
  blockerCount: number;
  summary: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostDependencyAlert {
  id: string;
  projectId: string;
  sceneId: string | null;
  shootingDayId: string | null;
  source: string;
  severity: PostAlertSeverity;
  message: string;
  status: PostAlertStatus;
  createdBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostIngestBatch {
  id: string;
  projectId: string;
  shootingDayId: string;
  sourceReportId: string | null;
  status: PostIngestBatchStatus;
  expectedRollCount: number;
  receivedRollCount: number;
  qcPassedCount: number;
  qcFailedCount: number;
  missingRollCount: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostIngestItem {
  id: string;
  batchId: string;
  roll: string;
  checksum: string | null;
  codec: string | null;
  tcStart: string | null;
  tcEnd: string | null;
  offloadedAt: string | null;
  sizeBytes: number | null;
  qcStatus: PostIngestQcStatus;
  issue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostIssue {
  id: string;
  projectId: string;
  shootingDayId: string | null;
  batchId: string | null;
  itemId: string | null;
  assignedDepartment: string;
  title: string;
  message: string | null;
  status: PostIssueStatus;
  createdBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditVersion {
  id: string;
  projectId: string;
  name: string;
  sourceRange: string | null;
  exportedAt: string | null;
  status: EditVersionStatus;
  storageUrl: string | null;
  durationSeconds: number | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditReviewNote {
  id: string;
  versionId: string;
  timecode: string;
  note: string;
  authorId: string | null;
  status: EditReviewNoteStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VfxShot {
  id: string;
  projectId: string;
  sceneId: string | null;
  shotCode: string;
  vendor: string | null;
  bid: number | null;
  actualCost: number | null;
  status: VfxShotStatus;
  dueDate: string | null;
  ownerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VfxTurnover {
  id: string;
  vfxShotId: string;
  plateRefs: string | null;
  notes: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryChecklistItem {
  id: string;
  projectId: string;
  type: string;
  dueDate: string | null;
  status: DeliveryChecklistStatus;
  ownerId: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostBudgetLink {
  id: string;
  projectId: string;
  sourceType: PostBudgetSourceType;
  sourceId: string;
  budgetId: string | null;
  lineItemId: string | null;
  plannedAmount: number;
  committedAmount: number;
  actualAmount: number;
  syncToBudget: boolean;
  lastSyncedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostAttachment {
  id: string;
  projectId: string;
  entityType: PostEntityType;
  entityId: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface PostComment {
  id: string;
  projectId: string;
  entityType: PostEntityType;
  entityId: string;
  parentCommentId: string | null;
  authorId: string;
  content: string;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostWorkspaceData {
  ingestBatches: PostIngestBatch[];
  ingestItems: PostIngestItem[];
  issues: PostIssue[];
  sceneReadiness: PostSceneReadiness[];
  dayReadiness: PostDayReadiness[];
  dependencyAlerts: PostDependencyAlert[];
  editVersions: EditVersion[];
  reviewNotes: EditReviewNote[];
  vfxShots: VfxShot[];
  vfxTurnovers: VfxTurnover[];
  deliveryChecklist: DeliveryChecklistItem[];
  budgetLinks: PostBudgetLink[];
}

interface PostPermissionContext {
  userId: string;
  role: ProjectRole;
  canManage: boolean;
}

interface IngestSummary {
  expectedRollCount: number;
  receivedRollCount: number;
  qcPassedCount: number;
  qcFailedCount: number;
  missingRollCount: number;
  status: PostIngestBatchStatus;
  blockerCount: number;
}

const POST_MANAGER_ROLES: PostManagerRole[] = [
  "ADMIN",
  "COORDINATOR",
  "DEPARTMENT_HEAD",
];

const POST_DEPARTMENT_KEY = "POST";
const POST_ATTACHMENT_PREFIX = "POST:";

function toDepartmentEntityType(entityType: PostEntityType): string {
  return `${POST_ATTACHMENT_PREFIX}${entityType}`;
}

function fromDepartmentEntityType(entityType: string): PostEntityType {
  if (entityType.startsWith(POST_ATTACHMENT_PREFIX)) {
    return entityType.slice(POST_ATTACHMENT_PREFIX.length) as PostEntityType;
  }
  return entityType as PostEntityType;
}

function toDepartmentSeverity(severity: PostAlertSeverity): "INFO" | "WARNING" | "CRITICAL" {
  if (severity === "BLOCKER") return "CRITICAL";
  return severity;
}

function fromDepartmentSeverity(
  severity: "INFO" | "WARNING" | "CRITICAL"
): PostAlertSeverity {
  if (severity === "CRITICAL") return "BLOCKER";
  return severity;
}

function mapDepartmentDependencyToPostAlert(
  dependency: DepartmentDayDependency
): PostDependencyAlert {
  return {
    id: dependency.id,
    projectId: dependency.projectId,
    sceneId: null,
    shootingDayId: dependency.shootingDayId,
    source: dependency.sourceType,
    severity: fromDepartmentSeverity(dependency.severity),
    message: dependency.message,
    status: dependency.status,
    createdBy: dependency.createdBy,
    resolvedBy: dependency.resolvedBy,
    resolvedAt: dependency.resolvedAt,
    createdAt: dependency.createdAt,
    updatedAt: dependency.updatedAt,
  };
}

function mapDepartmentSceneReadinessToPost(
  readiness: DepartmentSceneReadiness
): PostSceneReadiness {
  return {
    id: readiness.id,
    projectId: readiness.projectId,
    sceneId: readiness.sceneId,
    status: readiness.status,
    blockerCount: readiness.status === "NOT_READY" ? 1 : 0,
    summary: readiness.notes,
    updatedBy: readiness.updatedBy,
    createdAt: readiness.createdAt,
    updatedAt: readiness.updatedAt,
  };
}

function parseNumber(input: number | string | null | undefined): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : 0;
  }

  if (typeof input === "string" && input.trim()) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getPermissionContext(projectId: string): Promise<PostPermissionContext> {
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
    canManage: POST_MANAGER_ROLES.includes(role as PostManagerRole),
  };
}

async function requirePostManager(projectId: string): Promise<PostPermissionContext> {
  const context = await getPermissionContext(projectId);
  if (!context.canManage) {
    throw new Error("Unauthorized: Post workflow editing requires manager access");
  }
  return context;
}

async function resolveProjectIdForBatch(batchId: string): Promise<string> {
  const supabase = await createClient();
  const { data: batch, error } = await supabase
    .from("PostIngestBatch")
    .select("projectId")
    .eq("id", batchId)
    .single();

  if (error || !batch) {
    throw new Error("Ingest batch not found");
  }

  return batch.projectId as string;
}

async function resolveProjectIdForEditVersion(versionId: string): Promise<string> {
  const supabase = await createClient();
  const { data: version, error } = await supabase
    .from("EditVersion")
    .select("projectId")
    .eq("id", versionId)
    .single();

  if (error || !version) {
    throw new Error("Edit version not found");
  }

  return version.projectId as string;
}

async function resolveProjectIdForVfxShot(vfxShotId: string): Promise<string> {
  const supabase = await createClient();
  const { data: vfxShot, error } = await supabase
    .from("VfxShot")
    .select("projectId")
    .eq("id", vfxShotId)
    .single();

  if (error || !vfxShot) {
    throw new Error("VFX shot not found");
  }

  return vfxShot.projectId as string;
}

async function upsertIngestItemIssue(
  projectId: string,
  shootingDayId: string,
  batchId: string,
  item: Pick<PostIngestItem, "id" | "roll" | "qcStatus" | "issue">,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const shouldBeOpen = item.qcStatus === "FAILED" || item.qcStatus === "MISSING";

  const { data: existingIssue, error: issueLookupError } = await supabase
    .from("PostIssue")
    .select("id, status")
    .eq("itemId", item.id)
    .maybeSingle();

  if (issueLookupError) {
    console.error("Failed to load existing post issue for ingest item", issueLookupError);
  }

  if (shouldBeOpen) {
    if (existingIssue && existingIssue.status !== "RESOLVED") {
      await supabase
        .from("PostIssue")
        .update({
          title: `Media issue on roll ${item.roll}`,
          message: item.issue || "QC flagged this roll for follow-up.",
          status: "OPEN",
          resolvedAt: null,
          resolvedBy: null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existingIssue.id);
      return;
    }

    if (existingIssue && existingIssue.status === "RESOLVED") {
      await supabase
        .from("PostIssue")
        .update({
          status: "OPEN",
          resolvedAt: null,
          resolvedBy: null,
          title: `Media issue on roll ${item.roll}`,
          message: item.issue || "QC flagged this roll for follow-up.",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existingIssue.id);
      return;
    }

    await supabase.from("PostIssue").insert({
      projectId,
      shootingDayId,
      batchId,
      itemId: item.id,
      assignedDepartment: "CAMERA",
      title: `Media issue on roll ${item.roll}`,
      message: item.issue || "QC flagged this roll for follow-up.",
      status: "OPEN",
      createdBy: userId,
    });

    return;
  }

  if (existingIssue && existingIssue.status !== "RESOLVED") {
    await supabase
      .from("PostIssue")
      .update({
        status: "RESOLVED",
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", existingIssue.id);
  }
}

async function syncIngestAlert(
  projectId: string,
  shootingDayId: string,
  blockerCount: number,
  message: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const { data: existingAlert } = await supabase
    .from("PostDependencyAlert")
    .select("id, status")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .eq("source", "INGEST_QC")
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (blockerCount > 0) {
    if (existingAlert) {
      await supabase
        .from("PostDependencyAlert")
        .update({
          message,
          severity: "BLOCKER",
          status: "OPEN",
          resolvedBy: null,
          resolvedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existingAlert.id);
    } else {
      await supabase.from("PostDependencyAlert").insert({
        projectId,
        shootingDayId,
        source: "INGEST_QC",
        severity: "BLOCKER",
        message,
        status: "OPEN",
        createdBy: userId,
      });
    }

    const sharedResult = await upsertDepartmentDayDependency({
      projectId,
      shootingDayId,
      department: POST_DEPARTMENT_KEY,
      sourceType: "INGEST_QC",
      sourceId: shootingDayId,
      severity: toDepartmentSeverity("BLOCKER"),
      message,
      metadata: { blockerCount },
    });

    if (sharedResult.error) {
      console.error("Failed to sync shared department dependency for post ingest", sharedResult.error);
    }

    return;
  }

  if (existingAlert && existingAlert.status !== "RESOLVED") {
    await supabase
      .from("PostDependencyAlert")
      .update({
        status: "RESOLVED",
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", existingAlert.id);
  }

  const resolveResult = await resolveDepartmentDependencyBySource(
    projectId,
    shootingDayId,
    POST_DEPARTMENT_KEY,
    "INGEST_QC",
    shootingDayId
  );
  if (resolveResult.error) {
    console.error("Failed to resolve shared department dependency for post ingest", resolveResult.error);
  }
}

async function refreshPostDayReadiness(
  projectId: string,
  shootingDayId: string,
  userId: string
): Promise<PostDayReadiness | null> {
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("PostIngestBatch")
    .select("id, status")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  const { count: postSpecificBlockerCount } = await supabase
    .from("PostDependencyAlert")
    .select("id", { count: "exact", head: true })
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .eq("status", "OPEN")
    .eq("severity", "BLOCKER");

  const sharedDependencies = await getDepartmentDayDependencies(projectId, {
    shootingDayId,
    department: POST_DEPARTMENT_KEY,
    status: "OPEN",
  });

  const sharedBlockerCount =
    sharedDependencies.data?.filter((dependency) => dependency.severity === "CRITICAL").length ||
    0;
  const blockerCount =
    sharedDependencies.error ? postSpecificBlockerCount || 0 : sharedBlockerCount;

  let status: DepartmentReadinessStatus = "NOT_READY";
  let summary = "No ingest batch exists for this day.";

  if (batch && (blockerCount || 0) > 0) {
    status = "NOT_READY";
    summary = `${blockerCount || 0} unresolved post blocker${
      blockerCount === 1 ? "" : "s"
    }.`;
  } else if (batch && batch.status === "COMPLETE") {
    status = "READY";
    summary = "Dailies ingest complete and QC clear.";
  } else if (batch) {
    status = "IN_PROGRESS";
    summary = "Ingest and QC are still in progress.";
  }

  const { data, error } = await supabase
    .from("PostDayReadiness")
    .upsert(
      {
        projectId,
        shootingDayId,
        status,
        blockerCount: blockerCount || 0,
        summary,
        updatedBy: userId,
      },
      { onConflict: "shootingDayId" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("Failed to refresh post day readiness", error);
    return null;
  }

  return data as PostDayReadiness;
}

async function refreshPostSceneReadiness(
  projectId: string,
  sceneId: string,
  userId: string
): Promise<PostSceneReadiness | null> {
  const supabase = await createClient();

  const { count: blockerCount } = await supabase
    .from("PostDependencyAlert")
    .select("id", { count: "exact", head: true })
    .eq("projectId", projectId)
    .eq("sceneId", sceneId)
    .eq("status", "OPEN")
    .eq("severity", "BLOCKER");

  const { count: unresolvedVfxCount } = await supabase
    .from("VfxShot")
    .select("id", { count: "exact", head: true })
    .eq("projectId", projectId)
    .eq("sceneId", sceneId)
    .neq("status", "FINAL");

  let status: DepartmentReadinessStatus = "NOT_READY";
  let summary = "Pending post readiness.";

  if ((blockerCount || 0) > 0) {
    status = "NOT_READY";
    summary = `${blockerCount || 0} unresolved post blocker${
      blockerCount === 1 ? "" : "s"
    }.`;
  } else if ((unresolvedVfxCount || 0) > 0) {
    status = "IN_PROGRESS";
    summary = `${unresolvedVfxCount || 0} VFX shot${
      unresolvedVfxCount === 1 ? "" : "s"
    } still in progress.`;
  } else {
    status = "READY";
    summary = "Scene is clear for post dependencies.";
  }

  const { data, error } = await supabase
    .from("PostSceneReadiness")
    .upsert(
      {
        projectId,
        sceneId,
        status,
        blockerCount: blockerCount || 0,
        summary,
        updatedBy: userId,
      },
      { onConflict: "sceneId" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("Failed to refresh post scene readiness", error);
    return null;
  }

  const sharedReadiness = await upsertDepartmentSceneReadiness({
    projectId,
    sceneId,
    department: POST_DEPARTMENT_KEY,
    status,
    notes: summary,
  });
  if (sharedReadiness.error) {
    console.error("Failed to sync shared department scene readiness for post", sharedReadiness.error);
  }

  return data as PostSceneReadiness;
}

async function recalculateIngestBatch(batchId: string, userId: string): Promise<IngestSummary> {
  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("PostIngestBatch")
    .select("id, projectId, shootingDayId, expectedRollCount")
    .eq("id", batchId)
    .single();

  if (batchError || !batch) {
    throw new Error("Ingest batch not found");
  }

  const { data: items, error: itemsError } = await supabase
    .from("PostIngestItem")
    .select("id, roll, qcStatus, issue")
    .eq("batchId", batchId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const receivedRollCount = items?.length || 0;
  const qcPassedCount = (items || []).filter((item) => item.qcStatus === "PASSED").length;
  const qcFailedCount = (items || []).filter((item) => item.qcStatus === "FAILED").length;
  const missingRollCount = (items || []).filter((item) => item.qcStatus === "MISSING").length;

  const expectedRollCount = Math.max(batch.expectedRollCount || 0, receivedRollCount);
  const { status, blockerCount } = deriveIngestBatchStatus({
    expectedRollCount,
    receivedRollCount,
    qcPassedCount,
    qcFailedCount,
    missingRollCount,
  });

  const { error: batchUpdateError } = await supabase
    .from("PostIngestBatch")
    .update({
      status,
      expectedRollCount,
      receivedRollCount,
      qcPassedCount,
      qcFailedCount,
      missingRollCount,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (batchUpdateError) {
    throw new Error(batchUpdateError.message);
  }

  for (const item of items || []) {
    await upsertIngestItemIssue(
      batch.projectId,
      batch.shootingDayId,
      batch.id,
      {
        id: item.id,
        roll: item.roll,
        qcStatus: item.qcStatus as PostIngestQcStatus,
        issue: item.issue,
      },
      userId
    );
  }

  const blockerMessage =
    blockerCount > 0
      ? `Post ingest blocked: ${missingRollCount} missing roll${
          missingRollCount === 1 ? "" : "s"
        }, ${qcFailedCount} failed QC roll${qcFailedCount === 1 ? "" : "s"}.`
      : "Post ingest blockers resolved.";

  await syncIngestAlert(
    batch.projectId,
    batch.shootingDayId,
    blockerCount,
    blockerMessage,
    userId
  );

  await refreshPostDayReadiness(batch.projectId, batch.shootingDayId, userId);

  return {
    expectedRollCount,
    receivedRollCount,
    qcPassedCount,
    qcFailedCount,
    missingRollCount,
    status,
    blockerCount,
  };
}

async function revalidateProject(projectId: string): Promise<void> {
  revalidatePath(`/projects/${projectId}`);
}

export async function getPostWorkspaceData(
  projectId: string
): Promise<PostWorkspaceData> {
  await getPermissionContext(projectId);
  const supabase = await createClient();

  const [
    ingestBatchesResult,
    sceneReadinessResult,
    dayReadinessResult,
    dependencyAlertsResult,
    sharedSceneReadinessResult,
    sharedDependenciesResult,
    issuesResult,
    editVersionsResult,
    reviewNotesResult,
    vfxShotsResult,
    vfxTurnoversResult,
    deliveryChecklistResult,
    budgetLinksResult,
  ] = await Promise.all([
    supabase
      .from("PostIngestBatch")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("PostSceneReadiness")
      .select("*")
      .eq("projectId", projectId)
      .order("updatedAt", { ascending: false }),
    supabase
      .from("PostDayReadiness")
      .select("*")
      .eq("projectId", projectId)
      .order("updatedAt", { ascending: false }),
    supabase
      .from("PostDependencyAlert")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    getDepartmentSceneReadiness(projectId, POST_DEPARTMENT_KEY),
    getDepartmentDayDependencies(projectId, {
      department: POST_DEPARTMENT_KEY,
    }),
    supabase
      .from("PostIssue")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("EditVersion")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("EditReviewNote")
      .select("*")
      .order("createdAt", { ascending: false }),
    supabase
      .from("VfxShot")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("VfxTurnover")
      .select("*")
      .order("createdAt", { ascending: false }),
    supabase
      .from("DeliveryChecklistItem")
      .select("*")
      .eq("projectId", projectId)
      .order("dueDate", { ascending: true }),
    supabase
      .from("PostBudgetLink")
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false }),
  ]);

  const ingestBatches = (ingestBatchesResult.data || []) as PostIngestBatch[];
  const batchIds = ingestBatches.map((batch) => batch.id);

  let ingestItems: PostIngestItem[] = [];
  if (batchIds.length > 0) {
    const ingestItemsResult = await supabase
      .from("PostIngestItem")
      .select("*")
      .in("batchId", batchIds)
      .order("createdAt", { ascending: true });

    ingestItems = (ingestItemsResult.data || []) as PostIngestItem[];
  }

  const editVersions = (editVersionsResult.data || []) as EditVersion[];
  const editVersionIds = editVersions.map((version) => version.id);

  const filteredReviewNotes = (reviewNotesResult.data || []).filter((note) =>
    editVersionIds.includes(note.versionId)
  ) as EditReviewNote[];

  const vfxShots = (vfxShotsResult.data || []) as VfxShot[];
  const vfxShotIds = vfxShots.map((shot) => shot.id);

  const filteredTurnovers = (vfxTurnoversResult.data || []).filter((turnover) =>
    vfxShotIds.includes(turnover.vfxShotId)
  ) as VfxTurnover[];

  const sharedSceneReadiness = (sharedSceneReadinessResult.data || []).map(
    mapDepartmentSceneReadinessToPost
  );
  const sharedDependencyAlerts = (sharedDependenciesResult.data || []).map(
    mapDepartmentDependencyToPostAlert
  );

  const sceneReadiness =
    sharedSceneReadiness.length > 0
      ? sharedSceneReadiness
      : ((sceneReadinessResult.data || []) as PostSceneReadiness[]);

  const dependencyAlerts =
    sharedDependencyAlerts.length > 0
      ? sharedDependencyAlerts
      : ((dependencyAlertsResult.data || []) as PostDependencyAlert[]);

  return {
    ingestBatches,
    ingestItems,
    issues: (issuesResult.data || []) as PostIssue[],
    sceneReadiness,
    dayReadiness: (dayReadinessResult.data || []) as PostDayReadiness[],
    dependencyAlerts,
    editVersions,
    reviewNotes: filteredReviewNotes,
    vfxShots,
    vfxTurnovers: filteredTurnovers,
    deliveryChecklist: (deliveryChecklistResult.data || []) as DeliveryChecklistItem[],
    budgetLinks: (budgetLinksResult.data || []) as PostBudgetLink[],
  };
}

export async function ensurePostIngestBatch(input: {
  projectId: string;
  shootingDayId: string;
  sourceReportId?: string | null;
  expectedRollCount?: number;
  notes?: string;
}): Promise<PostIngestBatch> {
  const { userId } = await requirePostManager(input.projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("PostIngestBatch")
    .upsert(
      {
        projectId: input.projectId,
        shootingDayId: input.shootingDayId,
        sourceReportId: trimOrNull(input.sourceReportId),
        expectedRollCount: Math.max(0, parseNumber(input.expectedRollCount)),
        notes: trimOrNull(input.notes),
        createdBy: userId,
      },
      { onConflict: "shootingDayId" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create ingest batch");
  }

  await refreshPostDayReadiness(input.projectId, input.shootingDayId, userId);
  await revalidateProject(input.projectId);

  return data as PostIngestBatch;
}

export async function upsertPostIngestItem(input: {
  batchId: string;
  roll: string;
  checksum?: string | null;
  codec?: string | null;
  tcStart?: string | null;
  tcEnd?: string | null;
  offloadedAt?: string | null;
  sizeBytes?: number | null;
  qcStatus?: PostIngestQcStatus;
  issue?: string | null;
}): Promise<{ item: PostIngestItem; summary: IngestSummary }> {
  const projectId = await resolveProjectIdForBatch(input.batchId);
  await requirePostManager(projectId);

  const supabase = await createClient();

  const roll = input.roll.trim().toUpperCase();
  if (!roll) {
    throw new Error("Roll is required");
  }

  const { data: item, error } = await supabase
    .from("PostIngestItem")
    .upsert(
      {
        batchId: input.batchId,
        roll,
        checksum: trimOrNull(input.checksum),
        codec: trimOrNull(input.codec),
        tcStart: trimOrNull(input.tcStart),
        tcEnd: trimOrNull(input.tcEnd),
        offloadedAt: trimOrNull(input.offloadedAt),
        sizeBytes: input.sizeBytes ?? null,
        qcStatus: input.qcStatus || "PENDING",
        issue: trimOrNull(input.issue),
      },
      { onConflict: "batchId,roll" }
    )
    .select("*")
    .single();

  if (error || !item) {
    throw new Error(error?.message || "Failed to save ingest item");
  }

  const userId = (await getCurrentUserId()) as string;
  const summary = await recalculateIngestBatch(input.batchId, userId);
  await revalidateProject(projectId);

  return { item: item as PostIngestItem, summary };
}

export async function reconcilePostIngestBatch(input: {
  batchId: string;
  expectedRolls?: string[];
}): Promise<{ summary: IngestSummary; missingRolls: string[] }> {
  const projectId = await resolveProjectIdForBatch(input.batchId);
  await requirePostManager(projectId);

  const supabase = await createClient();
  const userId = (await getCurrentUserId()) as string;

  const { data: batch, error: batchError } = await supabase
    .from("PostIngestBatch")
    .select("id, projectId, shootingDayId")
    .eq("id", input.batchId)
    .single();

  if (batchError || !batch) {
    throw new Error("Ingest batch not found");
  }

  let expectedRolls = normalizeRolls(input.expectedRolls || []);

  if (expectedRolls.length === 0) {
    const { data: cameraRows, error: cameraError } = await supabase
      .from("CameraCardLog")
      .select("roll")
      .eq("shootingDayId", batch.shootingDayId);

    if (cameraError) {
      if (cameraError.code === "42P01") {
        throw new Error(
          "Camera card logs are not available yet. Add expected rolls manually to reconcile this batch."
        );
      }
      throw new Error(cameraError.message);
    }

    expectedRolls = normalizeRolls((cameraRows || []).map((row) => row.roll));
  }

  const { data: currentItems, error: itemsError } = await supabase
    .from("PostIngestItem")
    .select("id, roll")
    .eq("batchId", input.batchId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const existingRolls = new Set(
    (currentItems || []).map((item) => (item.roll || "").trim().toUpperCase())
  );

  const missingRolls = expectedRolls.filter((roll) => !existingRolls.has(roll));

  if (expectedRolls.length > 0) {
    await supabase
      .from("PostIngestBatch")
      .update({
        expectedRollCount: expectedRolls.length,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", input.batchId);
  }

  for (const missingRoll of missingRolls) {
    await supabase
      .from("PostIngestItem")
      .upsert(
        {
          batchId: input.batchId,
          roll: missingRoll,
          qcStatus: "MISSING",
          issue: "Expected roll is missing from ingest.",
        },
        { onConflict: "batchId,roll" }
      );
  }

  const summary = await recalculateIngestBatch(input.batchId, userId);
  await revalidateProject(batch.projectId);

  return { summary, missingRolls };
}

export async function getPostDependenciesForShootingDay(
  projectId: string,
  shootingDayId: string
): Promise<{ readiness: PostDayReadiness | null; alerts: PostDependencyAlert[] }> {
  await getPermissionContext(projectId);
  const supabase = await createClient();

  const [readinessResult, alertsResult, sharedAlertsResult] = await Promise.all([
    supabase
      .from("PostDayReadiness")
      .select("*")
      .eq("projectId", projectId)
      .eq("shootingDayId", shootingDayId)
      .maybeSingle(),
    supabase
      .from("PostDependencyAlert")
      .select("*")
      .eq("projectId", projectId)
      .eq("shootingDayId", shootingDayId)
      .eq("status", "OPEN")
      .order("createdAt", { ascending: false }),
    getDepartmentDayDependencies(projectId, {
      shootingDayId,
      department: POST_DEPARTMENT_KEY,
      status: "OPEN",
    }),
  ]);

  const sharedAlerts = (sharedAlertsResult.data || []).map(mapDepartmentDependencyToPostAlert);
  const alerts =
    sharedAlerts.length > 0
      ? sharedAlerts
      : ((alertsResult.data || []) as PostDependencyAlert[]);

  return {
    readiness: (readinessResult.data || null) as PostDayReadiness | null,
    alerts,
  };
}

export async function syncPostBlockersToCallSheet(
  shootingDayId: string
): Promise<{ callSheetId: string; blockerCount: number; advanceNotes: string | null }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: shootingDay, error: dayError } = await supabase
    .from("ShootingDay")
    .select("id, projectId")
    .eq("id", shootingDayId)
    .single();

  if (dayError || !shootingDay) {
    throw new Error("Shooting day not found");
  }

  await requirePostManager(shootingDay.projectId);

  const sharedSync = await syncDayDependenciesToCallSheet(shootingDayId);
  if (!sharedSync.success) {
    throw new Error(sharedSync.error || "Failed to sync call sheet department alerts");
  }

  const { data: updatedCallSheet, error: callSheetError } = await supabase
    .from("CallSheet")
    .select("id, advanceNotes")
    .eq("shootingDayId", shootingDayId)
    .single();

  if (callSheetError || !updatedCallSheet) {
    throw new Error(callSheetError?.message || "Failed to load updated call sheet");
  }

  const { alerts } = await getPostDependenciesForShootingDay(shootingDay.projectId, shootingDay.id);

  revalidatePath(`/projects/${shootingDay.projectId}`);

  return {
    callSheetId: updatedCallSheet.id,
    blockerCount: alerts.filter((alert) => alert.severity === "BLOCKER").length,
    advanceNotes: updatedCallSheet.advanceNotes,
  };
}

export async function createEditVersion(input: {
  projectId: string;
  name: string;
  sourceRange?: string | null;
  exportedAt?: string | null;
  status?: EditVersionStatus;
  storageUrl?: string | null;
  durationSeconds?: number | null;
  notes?: string | null;
}): Promise<EditVersion> {
  const { userId } = await requirePostManager(input.projectId);
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) {
    throw new Error("Version name is required");
  }

  const { data, error } = await supabase
    .from("EditVersion")
    .insert({
      projectId: input.projectId,
      name,
      sourceRange: trimOrNull(input.sourceRange),
      exportedAt: trimOrNull(input.exportedAt),
      status: input.status || "ASSEMBLY",
      storageUrl: trimOrNull(input.storageUrl),
      durationSeconds:
        input.durationSeconds === undefined || input.durationSeconds === null
          ? null
          : Math.max(0, Math.round(input.durationSeconds)),
      notes: trimOrNull(input.notes),
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create edit version");
  }

  await revalidateProject(input.projectId);
  return data as EditVersion;
}

export async function updateEditVersionStatus(
  versionId: string,
  status: EditVersionStatus
): Promise<EditVersion> {
  const projectId = await resolveProjectIdForEditVersion(versionId);
  await requirePostManager(projectId);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("EditVersion")
    .update({
      status,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", versionId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update edit version");
  }

  await revalidateProject(projectId);
  return data as EditVersion;
}

export async function createEditReviewNote(input: {
  versionId: string;
  timecode: string;
  note: string;
}): Promise<EditReviewNote> {
  const projectId = await resolveProjectIdForEditVersion(input.versionId);
  const { userId } = await getPermissionContext(projectId);
  const supabase = await createClient();

  const timecode = input.timecode.trim();
  const note = input.note.trim();

  if (!timecode) {
    throw new Error("Timecode is required");
  }

  if (!note) {
    throw new Error("Note is required");
  }

  const { data, error } = await supabase
    .from("EditReviewNote")
    .insert({
      versionId: input.versionId,
      timecode,
      note,
      authorId: userId,
      status: "OPEN",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create review note");
  }

  await revalidateProject(projectId);
  return data as EditReviewNote;
}

export async function updateEditReviewNoteStatus(
  noteId: string,
  status: EditReviewNoteStatus
): Promise<EditReviewNote> {
  const supabase = await createClient();

  const { data: noteRow, error: noteLookupError } = await supabase
    .from("EditReviewNote")
    .select("id, versionId")
    .eq("id", noteId)
    .single();

  if (noteLookupError || !noteRow) {
    throw new Error("Review note not found");
  }

  const projectId = await resolveProjectIdForEditVersion(noteRow.versionId);
  const { userId } = await getPermissionContext(projectId);

  const updatePayload: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === "RESOLVED") {
    updatePayload.resolvedAt = new Date().toISOString();
    updatePayload.resolvedBy = userId;
  } else {
    updatePayload.resolvedAt = null;
    updatePayload.resolvedBy = null;
  }

  const { data, error } = await supabase
    .from("EditReviewNote")
    .update(updatePayload)
    .eq("id", noteId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update review note status");
  }

  await revalidateProject(projectId);
  return data as EditReviewNote;
}

export async function createVfxShot(input: {
  projectId: string;
  sceneId?: string | null;
  shotCode: string;
  vendor?: string | null;
  bid?: number | null;
  actualCost?: number | null;
  status?: VfxShotStatus;
  dueDate?: string | null;
  ownerId?: string | null;
  notes?: string | null;
}): Promise<VfxShot> {
  const { userId } = await requirePostManager(input.projectId);
  const supabase = await createClient();

  const shotCode = input.shotCode.trim().toUpperCase();
  if (!shotCode) {
    throw new Error("Shot code is required");
  }

  const { data, error } = await supabase
    .from("VfxShot")
    .insert({
      projectId: input.projectId,
      sceneId: trimOrNull(input.sceneId),
      shotCode,
      vendor: trimOrNull(input.vendor),
      bid: input.bid == null ? null : parseNumber(input.bid),
      actualCost: input.actualCost == null ? null : parseNumber(input.actualCost),
      status: input.status || "NOT_SENT",
      dueDate: trimOrNull(input.dueDate),
      ownerId: trimOrNull(input.ownerId),
      notes: trimOrNull(input.notes),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create VFX shot");
  }

  if (data.sceneId) {
    await refreshPostSceneReadiness(input.projectId, data.sceneId, userId);
  }

  await revalidateProject(input.projectId);
  return data as VfxShot;
}

export async function updateVfxShotStatus(
  vfxShotId: string,
  status: VfxShotStatus
): Promise<VfxShot> {
  const projectId = await resolveProjectIdForVfxShot(vfxShotId);
  const { userId } = await requirePostManager(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("VfxShot")
    .update({
      status,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", vfxShotId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update VFX shot status");
  }

  if (data.sceneId) {
    await refreshPostSceneReadiness(projectId, data.sceneId, userId);
  }

  await revalidateProject(projectId);
  return data as VfxShot;
}

export async function createVfxTurnover(input: {
  vfxShotId: string;
  plateRefs?: string | null;
  notes?: string | null;
  sentAt?: string | null;
  approvedAt?: string | null;
}): Promise<VfxTurnover> {
  const projectId = await resolveProjectIdForVfxShot(input.vfxShotId);
  const { userId } = await requirePostManager(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("VfxTurnover")
    .insert({
      vfxShotId: input.vfxShotId,
      plateRefs: trimOrNull(input.plateRefs),
      notes: trimOrNull(input.notes),
      sentAt: trimOrNull(input.sentAt),
      approvedAt: trimOrNull(input.approvedAt),
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create VFX turnover");
  }

  await revalidateProject(projectId);
  return data as VfxTurnover;
}

export async function createDeliveryChecklistItem(input: {
  projectId: string;
  type: string;
  dueDate?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  status?: DeliveryChecklistStatus;
}): Promise<DeliveryChecklistItem> {
  await requirePostManager(input.projectId);
  const supabase = await createClient();

  const type = input.type.trim();
  if (!type) {
    throw new Error("Checklist type is required");
  }

  const { data, error } = await supabase
    .from("DeliveryChecklistItem")
    .insert({
      projectId: input.projectId,
      type,
      dueDate: trimOrNull(input.dueDate),
      ownerId: trimOrNull(input.ownerId),
      notes: trimOrNull(input.notes),
      status: input.status || "NOT_STARTED",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create delivery checklist item");
  }

  await revalidateProject(input.projectId);
  return data as DeliveryChecklistItem;
}

export async function updateDeliveryChecklistItemStatus(
  itemId: string,
  status: DeliveryChecklistStatus
): Promise<DeliveryChecklistItem> {
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("DeliveryChecklistItem")
    .select("id, projectId")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    throw new Error("Delivery checklist item not found");
  }

  await requirePostManager(item.projectId);

  const { data, error } = await supabase
    .from("DeliveryChecklistItem")
    .update({
      status,
      completedAt: status === "COMPLETE" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update delivery item status");
  }

  await revalidateProject(item.projectId);
  return data as DeliveryChecklistItem;
}

export async function upsertPostBudgetLink(input: {
  projectId: string;
  sourceType: PostBudgetSourceType;
  sourceId: string;
  budgetId?: string | null;
  lineItemId?: string | null;
  plannedAmount?: number;
  committedAmount?: number;
  actualAmount?: number;
  syncToBudget?: boolean;
}): Promise<PostBudgetLink> {
  const { userId } = await requirePostManager(input.projectId);
  const supabase = await createClient();

  const sourceId = input.sourceId.trim();
  if (!sourceId) {
    throw new Error("Source ID is required");
  }

  const { data, error } = await supabase
    .from("PostBudgetLink")
    .upsert(
      {
        projectId: input.projectId,
        sourceType: input.sourceType,
        sourceId,
        budgetId: trimOrNull(input.budgetId),
        lineItemId: trimOrNull(input.lineItemId),
        plannedAmount: Math.max(0, parseNumber(input.plannedAmount)),
        committedAmount: Math.max(0, parseNumber(input.committedAmount)),
        actualAmount: Math.max(0, parseNumber(input.actualAmount)),
        syncToBudget: Boolean(input.syncToBudget),
        createdBy: userId,
      },
      { onConflict: "projectId,sourceType,sourceId" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save post budget link");
  }

  await revalidateProject(input.projectId);
  return data as PostBudgetLink;
}

export async function syncPostBudgetLinkToBudget(linkId: string): Promise<PostBudgetLink> {
  const supabase = await createClient();

  const { data: link, error: linkError } = await supabase
    .from("PostBudgetLink")
    .select("*")
    .eq("id", linkId)
    .single();

  if (linkError || !link) {
    throw new Error("Post budget link not found");
  }

  await requirePostManager(link.projectId);

  if (!link.lineItemId) {
    throw new Error("Link is missing a target budget line item");
  }

  const { error: lineItemError } = await supabase
    .from("BudgetLineItem")
    .update({
      committedCost: Math.max(0, parseNumber(link.committedAmount)),
      actualCost: Math.max(0, parseNumber(link.actualAmount)),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", link.lineItemId);

  if (lineItemError) {
    throw new Error(lineItemError.message);
  }

  const { data: updatedLink, error: updateLinkError } = await supabase
    .from("PostBudgetLink")
    .update({
      syncToBudget: true,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", linkId)
    .select("*")
    .single();

  if (updateLinkError || !updatedLink) {
    throw new Error(updateLinkError?.message || "Failed to update budget link sync state");
  }

  await revalidateProject(link.projectId);
  return updatedLink as PostBudgetLink;
}

export async function createPostAttachment(input: {
  projectId: string;
  entityType: PostEntityType;
  entityId: string;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}): Promise<PostAttachment> {
  await getPermissionContext(input.projectId);

  const entityId = input.entityId.trim();
  const fileUrl = input.fileUrl.trim();
  if (!entityId || !fileUrl) {
    throw new Error("Entity and file URL are required");
  }

  const result = await createDepartmentAttachment({
    projectId: input.projectId,
    entityType: toDepartmentEntityType(input.entityType),
    entityId,
    fileUrl,
    fileName: trimOrNull(input.fileName) || undefined,
    mimeType: trimOrNull(input.mimeType) || undefined,
    sizeBytes: input.sizeBytes ?? undefined,
  });

  if (result.error || !result.data) {
    throw new Error(result.error || "Failed to add attachment");
  }

  const attachment = result.data as DepartmentAttachment;
  return {
    id: attachment.id,
    projectId: attachment.projectId,
    entityType: fromDepartmentEntityType(attachment.entityType),
    entityId: attachment.entityId,
    fileUrl: attachment.fileUrl,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt,
  };
}

export async function getPostAttachments(input: {
  projectId: string;
  entityType: PostEntityType;
  entityId: string;
}): Promise<PostAttachment[]> {
  await getPermissionContext(input.projectId);

  const result = await getDepartmentAttachments(
    input.projectId,
    toDepartmentEntityType(input.entityType),
    input.entityId
  );

  if (result.error) {
    throw new Error(result.error);
  }

  return (result.data || []).map((attachment) => ({
    id: attachment.id,
    projectId: attachment.projectId,
    entityType: fromDepartmentEntityType(attachment.entityType),
    entityId: attachment.entityId,
    fileUrl: attachment.fileUrl,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt,
  }));
}

export async function createPostComment(input: {
  projectId: string;
  entityType: PostEntityType;
  entityId: string;
  content: string;
  parentCommentId?: string | null;
}): Promise<PostComment> {
  await getPermissionContext(input.projectId);
  const content = input.content.trim();
  const entityId = input.entityId.trim();

  if (!entityId || !content) {
    throw new Error("Entity and content are required");
  }

  const result = await createDepartmentComment({
    projectId: input.projectId,
    entityType: toDepartmentEntityType(input.entityType),
    entityId,
    body: content,
  });

  if (result.error || !result.data) {
    throw new Error(result.error || "Failed to add comment");
  }

  return {
    id: result.data.id,
    projectId: input.projectId,
    entityType: input.entityType,
    entityId,
    parentCommentId: trimOrNull(input.parentCommentId),
    authorId: result.data.authorId,
    content: result.data.body,
    isResolved: false,
    createdAt: result.data.createdAt,
    updatedAt: result.data.updatedAt,
  };
}

export async function getPostComments(input: {
  projectId: string;
  entityType: PostEntityType;
  entityId: string;
}): Promise<PostComment[]> {
  await getPermissionContext(input.projectId);
  const result = await getDepartmentComments(
    input.projectId,
    toDepartmentEntityType(input.entityType),
    input.entityId
  );

  if (result.error) {
    throw new Error(result.error);
  }

  return (result.data?.comments || []).map((comment) => ({
    id: comment.id,
    projectId: input.projectId,
    entityType: input.entityType,
    entityId: input.entityId,
    parentCommentId: null,
    authorId: comment.authorId,
    content: comment.body,
    isResolved: false,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  }));
}

export async function setPostCommentResolved(
  commentId: string,
  isResolved: boolean
): Promise<PostComment> {
  void commentId;
  void isResolved;
  throw new Error(
    "Comment resolution state is not supported for shared department comments in this build."
  );
}

export async function refreshPostReadinessForScene(
  projectId: string,
  sceneId: string
): Promise<PostSceneReadiness | null> {
  const { userId } = await requirePostManager(projectId);
  const readiness = await refreshPostSceneReadiness(projectId, sceneId, userId);
  await revalidateProject(projectId);
  return readiness;
}

export async function refreshPostReadinessForShootingDay(
  projectId: string,
  shootingDayId: string
): Promise<PostDayReadiness | null> {
  const { userId } = await requirePostManager(projectId);
  const readiness = await refreshPostDayReadiness(projectId, shootingDayId, userId);
  await revalidateProject(projectId);
  return readiness;
}
