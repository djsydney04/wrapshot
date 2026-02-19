"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export type DepartmentReadinessStatus = "NOT_READY" | "IN_PROGRESS" | "READY";
export type DepartmentAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type DepartmentDependencyStatus = "OPEN" | "RESOLVED";

export interface DepartmentSceneReadiness {
  id: string;
  projectId: string;
  sceneId: string;
  department: string;
  status: DepartmentReadinessStatus;
  notes: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDayDependency {
  id: string;
  projectId: string;
  shootingDayId: string;
  department: string;
  sourceType: string;
  sourceId: string;
  status: DepartmentDependencyStatus;
  severity: DepartmentAlertSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpsertSceneReadinessInput {
  projectId: string;
  sceneId: string;
  department: string;
  status: DepartmentReadinessStatus;
  notes?: string | null;
}

interface UpsertDayDependencyInput {
  projectId: string;
  shootingDayId: string;
  department: string;
  sourceType: string;
  sourceId: string;
  severity: DepartmentAlertSeverity;
  message: string;
  metadata?: Record<string, unknown> | null;
}

const AUTO_ALERTS_START = "[AUTO_DEPARTMENT_ALERTS]";
const AUTO_ALERTS_END = "[/AUTO_DEPARTMENT_ALERTS]";

function stripAutoAlertsBlock(input: string | null | undefined): string {
  const text = input || "";
  const start = text.indexOf(AUTO_ALERTS_START);
  const end = text.indexOf(AUTO_ALERTS_END);

  if (start === -1 || end === -1 || end < start) {
    return text.trim();
  }

  const before = text.slice(0, start).trim();
  const after = text.slice(end + AUTO_ALERTS_END.length).trim();
  return [before, after].filter(Boolean).join("\n\n").trim();
}

function buildAutoAlertsBlock(alerts: DepartmentDayDependency[]): string {
  if (alerts.length === 0) return "";

  const lines = alerts.map(
    (alert) => `- [${alert.department}] (${alert.severity}) ${alert.message}`,
  );

  return [
    AUTO_ALERTS_START,
    "Department readiness alerts:",
    ...lines,
    AUTO_ALERTS_END,
  ].join("\n");
}

function rankSeverity(value: DepartmentAlertSeverity): number {
  if (value === "CRITICAL") return 3;
  if (value === "WARNING") return 2;
  return 1;
}

export async function getDepartmentSceneReadiness(
  projectId: string,
  department?: string,
) {
  const supabase = await createClient();
  let query = supabase
    .from("DepartmentSceneReadiness")
    .select("*")
    .eq("projectId", projectId)
    .order("updatedAt", { ascending: false });

  if (department) {
    query = query.eq("department", department);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching department scene readiness:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as DepartmentSceneReadiness[], error: null };
}

export async function getSceneDepartmentReadiness(
  sceneId: string,
  department: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("DepartmentSceneReadiness")
    .select("*")
    .eq("sceneId", sceneId)
    .eq("department", department)
    .maybeSingle();

  if (error) {
    console.error("Error fetching scene department readiness:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || null) as DepartmentSceneReadiness | null, error: null };
}

export async function upsertDepartmentSceneReadiness(
  input: UpsertSceneReadinessInput,
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const payload = {
    projectId: input.projectId,
    sceneId: input.sceneId,
    department: input.department,
    status: input.status,
    notes: input.notes || null,
    updatedBy: userId,
  };

  const { data, error } = await supabase
    .from("DepartmentSceneReadiness")
    .upsert(payload, { onConflict: "sceneId,department" })
    .select("*")
    .single();

  if (error) {
    console.error("Error upserting department scene readiness:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as DepartmentSceneReadiness, error: null };
}

export async function getDepartmentDayDependencies(
  projectId: string,
  options?: {
    shootingDayId?: string;
    department?: string;
    status?: DepartmentDependencyStatus;
  },
) {
  const supabase = await createClient();

  let query = supabase
    .from("DepartmentDayDependency")
    .select("*")
    .eq("projectId", projectId)
    .order("updatedAt", { ascending: false });

  if (options?.shootingDayId) {
    query = query.eq("shootingDayId", options.shootingDayId);
  }
  if (options?.department) {
    query = query.eq("department", options.department);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching department day dependencies:", error);
    return { data: null, error: error.message };
  }

  const dependencies = ((data || []) as DepartmentDayDependency[]).sort(
    (a, b) => rankSeverity(b.severity) - rankSeverity(a.severity),
  );

  return { data: dependencies, error: null };
}

export async function upsertDepartmentDayDependency(
  input: UpsertDayDependencyInput,
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const payload = {
    projectId: input.projectId,
    shootingDayId: input.shootingDayId,
    department: input.department,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    severity: input.severity,
    message: input.message,
    metadata: input.metadata || null,
    status: "OPEN",
    resolvedAt: null,
    resolvedBy: null,
    createdBy: userId,
  };

  const { data, error } = await supabase
    .from("DepartmentDayDependency")
    .upsert(payload, {
      onConflict: "projectId,shootingDayId,department,sourceType,sourceId",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error upserting department day dependency:", error);
    return { data: null, error: error.message };
  }

  await syncDayDependenciesToCallSheet(input.shootingDayId);
  revalidatePath(`/projects/${input.projectId}`);

  return { data: data as DepartmentDayDependency, error: null };
}

export async function resolveDepartmentDayDependency(
  dependencyId: string,
  projectId: string,
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: updated, error } = await supabase
    .from("DepartmentDayDependency")
    .update({
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: userId,
    })
    .eq("id", dependencyId)
    .select("shootingDayId")
    .single();

  if (error) {
    console.error("Error resolving department day dependency:", error);
    return { success: false, error: error.message };
  }

  await syncDayDependenciesToCallSheet(updated.shootingDayId);
  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

export async function resolveDepartmentDependencyBySource(
  projectId: string,
  shootingDayId: string,
  department: string,
  sourceType: string,
  sourceId: string,
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("DepartmentDayDependency")
    .update({
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: userId,
    })
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .eq("department", department)
    .eq("sourceType", sourceType)
    .eq("sourceId", sourceId)
    .eq("status", "OPEN");

  if (error) {
    console.error("Error resolving department dependency by source:", error);
    return { success: false, error: error.message };
  }

  await syncDayDependenciesToCallSheet(shootingDayId);
  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

export async function syncDayDependenciesToCallSheet(shootingDayId: string) {
  const supabase = await createClient();

  const { data: dependencies, error: depError } = await supabase
    .from("DepartmentDayDependency")
    .select("*")
    .eq("shootingDayId", shootingDayId)
    .eq("status", "OPEN");

  if (depError) {
    console.error("Error fetching dependencies for call sheet sync:", depError);
    return { success: false, error: depError.message };
  }

  const alerts = ((dependencies || []) as DepartmentDayDependency[]).sort(
    (a, b) => rankSeverity(b.severity) - rankSeverity(a.severity),
  );

  let { data: callSheet, error: callSheetError } = await supabase
    .from("CallSheet")
    .select("id, advanceNotes")
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  if (callSheetError) {
    console.error("Error fetching call sheet during dependency sync:", callSheetError);
    return { success: false, error: callSheetError.message };
  }

  if (!callSheet) {
    const { data: createdCallSheet, error: createError } = await supabase
      .from("CallSheet")
      .insert({ shootingDayId })
      .select("id, advanceNotes")
      .single();

    if (createError) {
      console.error("Error creating call sheet during dependency sync:", createError);
      return { success: false, error: createError.message };
    }

    callSheet = createdCallSheet;
  }

  const manualNotes = stripAutoAlertsBlock(callSheet.advanceNotes);
  const autoBlock = buildAutoAlertsBlock(alerts);
  const nextAdvanceNotes = [manualNotes, autoBlock].filter(Boolean).join("\n\n").trim();

  const { error: updateError } = await supabase
    .from("CallSheet")
    .update({ advanceNotes: nextAdvanceNotes || null })
    .eq("id", callSheet.id);

  if (updateError) {
    console.error("Error updating call sheet with department alerts:", updateError);
    return { success: false, error: updateError.message };
  }

  return { success: true, error: null };
}
