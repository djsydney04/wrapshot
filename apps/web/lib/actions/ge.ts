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

export type LightingPlanStatus = "DRAFT" | "IN_PROGRESS" | "PUBLISHED";
export type NeedStatus = "PENDING" | "SOURCED" | "UNAVAILABLE" | "READY";

export interface LightingPlan {
  id: string;
  projectId: string;
  sceneId: string;
  shootingDayId: string | null;
  gafferId: string | null;
  status: LightingPlanStatus;
  notes: string | null;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  scene?: { id: string; sceneNumber: string } | null;
  shootingDay?: { id: string; dayNumber: number; date: string } | null;
  needs?: LightingNeed[];
}

export interface LightingNeed {
  id: string;
  planId: string;
  fixtureType: string;
  qty: number;
  powerDraw: number;
  source: "OWNED" | "RENTAL" | "PURCHASE" | "BORROW";
  status: NeedStatus;
  estimatedRate: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiggingTask {
  id: string;
  projectId: string;
  locationId: string | null;
  startDayId: string | null;
  endDayId: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED";
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  scenes?: Array<{ id: string; sceneId: string }>;
  assignments?: GripCrewAssignment[];
}

export interface GripCrewAssignment {
  id: string;
  taskId: string;
  crewMemberId: string;
  role: string | null;
  callTime: string | null;
  hours: number;
  createdAt: string;
  updatedAt: string;
}

export interface PowerPlan {
  id: string;
  projectId: string;
  shootingDayId: string;
  locationId: string | null;
  generator: string | null;
  capacityAmps: number;
  distroNotes: string | null;
  status: "DRAFT" | "IN_PROGRESS" | "PASSED" | "FAILED";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  circuits?: PowerCircuit[];
  safetyChecklist?: SafetyChecklistItem[];
}

export interface PowerCircuit {
  id: string;
  powerPlanId: string;
  runLabel: string;
  loadAmps: number;
  breaker: string | null;
  status: "PLANNED" | "ACTIVE" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

export interface SafetyChecklistItem {
  id: string;
  projectId: string;
  shootingDayId: string;
  department: string;
  item: string;
  status: "REQUIRED" | "IN_PROGRESS" | "COMPLETE" | "FAILED";
  completedBy: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

async function recomputeGeSceneReadiness(projectId: string, sceneId: string) {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("LightingPlan")
    .select("id, status")
    .eq("projectId", projectId)
    .eq("sceneId", sceneId);

  const planRows = plans || [];

  if (planRows.length === 0) {
    await upsertDepartmentSceneReadiness({
      projectId,
      sceneId,
      department: "GE",
      status: "NOT_READY",
      notes: "No lighting plan created for this scene.",
    });
    return;
  }

  const planIds = planRows.map((row) => row.id as string);

  const { data: openNeeds } = await supabase
    .from("LightingNeed")
    .select("id")
    .in("planId", planIds)
    .in("status", ["PENDING", "UNAVAILABLE"]);

  const hasUnresolvedNeeds = (openNeeds || []).length > 0;
  const hasPublishedPlan = planRows.some((row) => row.status === "PUBLISHED");

  await upsertDepartmentSceneReadiness({
    projectId,
    sceneId,
    department: "GE",
    status: hasPublishedPlan && !hasUnresolvedNeeds ? "READY" : "IN_PROGRESS",
    notes: hasPublishedPlan && !hasUnresolvedNeeds
      ? "Lighting plan and needs are ready."
      : "Lighting prep is in progress.",
  });
}

async function syncLightingDependencyForDay(projectId: string, shootingDayId: string) {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("LightingPlan")
    .select("id")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId);

  const planIds = (plans || []).map((row) => row.id as string);

  if (planIds.length === 0) {
    await resolveDepartmentDependencyBySource(
      projectId,
      shootingDayId,
      "GE",
      "LIGHTING_PLAN",
      shootingDayId,
    );
    return;
  }

  const { data: unresolvedNeeds } = await supabase
    .from("LightingNeed")
    .select("id")
    .in("planId", planIds)
    .in("status", ["PENDING", "UNAVAILABLE"]);

  const unresolvedCount = (unresolvedNeeds || []).length;

  if (unresolvedCount > 0) {
    await upsertDepartmentDayDependency({
      projectId,
      shootingDayId,
      department: "GE",
      sourceType: "LIGHTING_PLAN",
      sourceId: shootingDayId,
      severity: "WARNING",
      message: `${unresolvedCount} lighting need(s) are unresolved for this day.`,
      metadata: { unresolvedCount },
    });
  } else {
    await resolveDepartmentDependencyBySource(
      projectId,
      shootingDayId,
      "GE",
      "LIGHTING_PLAN",
      shootingDayId,
    );
  }
}

async function syncRiggingDependencies(taskId: string) {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("RiggingTask")
    .select("id, projectId, status")
    .eq("id", taskId)
    .single();

  if (!task?.projectId) return;

  const { data: taskScenes } = await supabase
    .from("RiggingTaskScene")
    .select("sceneId")
    .eq("taskId", taskId);

  const sceneIds = (taskScenes || []).map((row) => row.sceneId as string);

  if (sceneIds.length === 0) return;

  const { data: shootingDayScenes } = await supabase
    .from("ShootingDayScene")
    .select("shootingDayId")
    .in("sceneId", sceneIds);

  const dayIds = Array.from(
    new Set((shootingDayScenes || []).map((row) => row.shootingDayId as string)),
  );

  for (const dayId of dayIds) {
    const sourceId = `${taskId}:${dayId}`;

    if (task.status === "COMPLETE") {
      await resolveDepartmentDependencyBySource(
        task.projectId as string,
        dayId,
        "GE",
        "RIGGING_TASK",
        sourceId,
      );
    } else {
      await upsertDepartmentDayDependency({
        projectId: task.projectId as string,
        shootingDayId: dayId,
        department: "GE",
        sourceType: "RIGGING_TASK",
        sourceId,
        severity: "WARNING",
        message: "Rigging dependency is incomplete for scenes on this day.",
        metadata: { taskId },
      });
    }
  }
}

async function evaluatePowerSafetyReadiness(projectId: string, shootingDayId: string) {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("PowerPlan")
    .select("id, capacityAmps")
    .eq("projectId", projectId)
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  if (!plan?.id) {
    await upsertDepartmentDayDependency({
      projectId,
      shootingDayId,
      department: "GE",
      sourceType: "POWER_SAFETY",
      sourceId: shootingDayId,
      severity: "WARNING",
      message: "No power plan exists for this shooting day.",
    });
    return;
  }

  const [{ data: circuits }, { data: checklist }] = await Promise.all([
    supabase
      .from("PowerCircuit")
      .select("loadAmps, status")
      .eq("powerPlanId", plan.id),
    supabase
      .from("SafetyChecklist")
      .select("status")
      .eq("projectId", projectId)
      .eq("shootingDayId", shootingDayId),
  ]);

  const totalLoad = (circuits || []).reduce((sum, row) => {
    return sum + Number(row.loadAmps || 0);
  }, 0);

  const capacity = Number(plan.capacityAmps || 0);
  const checklistItems = checklist || [];
  const failedSafety = checklistItems.some((item) => item.status === "FAILED");
  const incompleteSafety = checklistItems.some(
    (item) => item.status !== "COMPLETE",
  );

  if (totalLoad > capacity || failedSafety || incompleteSafety) {
    const severity = totalLoad > capacity || failedSafety ? "CRITICAL" : "WARNING";

    const reasons: string[] = [];
    if (totalLoad > capacity) {
      reasons.push(
        `power load ${totalLoad.toFixed(1)}A exceeds capacity ${capacity.toFixed(1)}A`,
      );
    }
    if (failedSafety) reasons.push("one or more safety checks failed");
    if (!failedSafety && incompleteSafety) reasons.push("safety checklist is incomplete");

    await upsertDepartmentDayDependency({
      projectId,
      shootingDayId,
      department: "GE",
      sourceType: "POWER_SAFETY",
      sourceId: shootingDayId,
      severity,
      message: `Power/safety warning: ${reasons.join(", ")}.`,
      metadata: { totalLoad, capacity },
    });
  } else {
    await resolveDepartmentDependencyBySource(
      projectId,
      shootingDayId,
      "GE",
      "POWER_SAFETY",
      shootingDayId,
    );
  }
}

export async function getLightingPlans(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("LightingPlan")
    .select(
      `
      *,
      scene:Scene(id, sceneNumber),
      shootingDay:ShootingDay(id, dayNumber, date),
      needs:LightingNeed(*)
    `,
    )
    .eq("projectId", projectId)
    .order("shootingDayId", { ascending: true })
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching lighting plans:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as LightingPlan[], error: null };
}

export async function createLightingPlan(input: {
  projectId: string;
  sceneId: string;
  shootingDayId?: string;
  gafferId?: string;
  status?: LightingPlanStatus;
  notes?: string;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("LightingPlan")
    .insert({
      projectId: input.projectId,
      sceneId: input.sceneId,
      shootingDayId: input.shootingDayId || null,
      gafferId: input.gafferId || null,
      status: input.status || "DRAFT",
      notes: input.notes || null,
      publishedAt: input.status === "PUBLISHED" ? new Date().toISOString() : null,
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating lighting plan:", error);
    return { data: null, error: error.message };
  }

  await recomputeGeSceneReadiness(input.projectId, input.sceneId);
  if (input.shootingDayId) {
    await syncLightingDependencyForDay(input.projectId, input.shootingDayId);
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as LightingPlan, error: null };
}

export async function updateLightingPlan(
  id: string,
  updates: Partial<{
    shootingDayId: string | null;
    gafferId: string | null;
    status: LightingPlanStatus;
    notes: string;
  }>,
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("LightingPlan")
    .select("projectId, sceneId, shootingDayId")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("LightingPlan")
    .update({
      ...updates,
      ...(updates.status === "PUBLISHED" ? { publishedAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating lighting plan:", error);
    return { data: null, error: error.message };
  }

  await recomputeGeSceneReadiness(data.projectId as string, data.sceneId as string);

  const oldDay = (existing?.shootingDayId as string | null) || null;
  const newDay = data.shootingDayId as string | null;

  if (oldDay) {
    await syncLightingDependencyForDay(data.projectId as string, oldDay);
  }
  if (newDay && newDay !== oldDay) {
    await syncLightingDependencyForDay(data.projectId as string, newDay);
  }

  revalidatePath(`/projects/${data.projectId}`);
  return { data: data as LightingPlan, error: null };
}

export async function createLightingNeed(input: {
  planId: string;
  fixtureType: string;
  qty?: number;
  powerDraw?: number;
  source?: "OWNED" | "RENTAL" | "PURCHASE" | "BORROW";
  status?: NeedStatus;
  estimatedRate?: number;
  notes?: string;
}) {
  const supabase = await createClient();

  const fixtureType = input.fixtureType.trim();
  if (!fixtureType) {
    return { data: null, error: "Fixture type is required" };
  }

  const { data, error } = await supabase
    .from("LightingNeed")
    .insert({
      planId: input.planId,
      fixtureType,
      qty: Math.max(1, input.qty || 1),
      powerDraw: Math.max(0, Number(input.powerDraw || 0)),
      source: input.source || "OWNED",
      status: input.status || "PENDING",
      estimatedRate: Math.max(0, Number(input.estimatedRate || 0)),
      notes: input.notes || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating lighting need:", error);
    return { data: null, error: error.message };
  }

  const { data: plan } = await supabase
    .from("LightingPlan")
    .select("projectId, sceneId, shootingDayId")
    .eq("id", input.planId)
    .single();

  if (plan?.projectId && plan?.sceneId) {
    await recomputeGeSceneReadiness(plan.projectId as string, plan.sceneId as string);
  }
  if (plan?.projectId && plan?.shootingDayId) {
    await syncLightingDependencyForDay(
      plan.projectId as string,
      plan.shootingDayId as string,
    );
  }

  if (
    ["RENTAL", "PURCHASE", "BORROW"].includes((data.source as string) || "") &&
    Number(data.estimatedRate || 0) > 0 &&
    plan?.projectId
  ) {
    await autoSyncDepartmentBudgetRequest({
      projectId: plan.projectId as string,
      department: "GE",
      sourceType: "LIGHTING_NEED",
      sourceId: data.id as string,
      plannedAmount: Number(data.estimatedRate || 0) * Number(data.qty || 1),
      reason: `Lighting need: ${data.fixtureType}`,
    });
  }

  if (plan?.projectId) {
    revalidatePath(`/projects/${plan.projectId}`);
  }
  return { data: data as LightingNeed, error: null };
}

export async function getRiggingTasks(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("RiggingTask")
    .select(
      `
      *,
      scenes:RiggingTaskScene(id, sceneId),
      assignments:GripCrewAssignment(*)
    `,
    )
    .eq("projectId", projectId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching rigging tasks:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as RiggingTask[], error: null };
}

export async function createRiggingTask(input: {
  projectId: string;
  locationId?: string;
  startDayId?: string;
  endDayId?: string;
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED";
  notes?: string;
  sceneIds?: string[];
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("RiggingTask")
    .insert({
      projectId: input.projectId,
      locationId: input.locationId || null,
      startDayId: input.startDayId || null,
      endDayId: input.endDayId || null,
      status: input.status || "PLANNED",
      notes: input.notes || null,
      createdBy: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating rigging task:", error);
    return { data: null, error: error.message };
  }

  if (input.sceneIds && input.sceneIds.length > 0) {
    await supabase.from("RiggingTaskScene").insert(
      input.sceneIds.map((sceneId) => ({
        taskId: data.id,
        sceneId,
      })),
    );
  }

  await syncRiggingDependencies(data.id as string);

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as RiggingTask, error: null };
}

export async function updateRiggingTask(
  id: string,
  updates: Partial<{
    locationId: string | null;
    startDayId: string | null;
    endDayId: string | null;
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED";
    notes: string;
    sceneIds: string[];
  }>,
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("RiggingTask")
    .select("projectId")
    .eq("id", id)
    .single();

  const { sceneIds, ...taskUpdates } = updates;

  const { data, error } = await supabase
    .from("RiggingTask")
    .update({
      ...taskUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating rigging task:", error);
    return { data: null, error: error.message };
  }

  if (sceneIds) {
    await supabase.from("RiggingTaskScene").delete().eq("taskId", id);
    if (sceneIds.length > 0) {
      await supabase.from("RiggingTaskScene").insert(
        sceneIds.map((sceneId) => ({ taskId: id, sceneId })),
      );
    }
  }

  await syncRiggingDependencies(id);

  revalidatePath(`/projects/${data.projectId}`);
  if (existing?.projectId && existing.projectId !== data.projectId) {
    revalidatePath(`/projects/${existing.projectId}`);
  }

  return { data: data as RiggingTask, error: null };
}

export async function upsertPowerPlanForDay(input: {
  projectId: string;
  shootingDayId: string;
  locationId?: string;
  generator?: string;
  capacityAmps?: number;
  distroNotes?: string;
  status?: "DRAFT" | "IN_PROGRESS" | "PASSED" | "FAILED";
  circuits: Array<{
    runLabel: string;
    loadAmps?: number;
    breaker?: string;
    status?: "PLANNED" | "ACTIVE" | "FAILED";
  }>;
  safetyChecklist: Array<{
    department: string;
    item: string;
    status?: "REQUIRED" | "IN_PROGRESS" | "COMPLETE" | "FAILED";
    notes?: string;
  }>;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data: existingPlan } = await supabase
    .from("PowerPlan")
    .select("id")
    .eq("projectId", input.projectId)
    .eq("shootingDayId", input.shootingDayId)
    .maybeSingle();

  let powerPlanId = existingPlan?.id as string | undefined;

  if (!powerPlanId) {
    const { data: createdPlan, error: createError } = await supabase
      .from("PowerPlan")
      .insert({
        projectId: input.projectId,
        shootingDayId: input.shootingDayId,
        locationId: input.locationId || null,
        generator: input.generator || null,
        capacityAmps: Math.max(0, Number(input.capacityAmps || 0)),
        distroNotes: input.distroNotes || null,
        status: input.status || "DRAFT",
        createdBy: userId,
      })
      .select("id")
      .single();

    if (createError || !createdPlan?.id) {
      console.error("Error creating power plan:", createError);
      return { data: null, error: createError?.message || "Failed to create power plan" };
    }

    powerPlanId = createdPlan.id as string;
  } else {
    const { error: updateError } = await supabase
      .from("PowerPlan")
      .update({
        locationId: input.locationId || null,
        generator: input.generator || null,
        capacityAmps: Math.max(0, Number(input.capacityAmps || 0)),
        distroNotes: input.distroNotes || null,
        status: input.status || "IN_PROGRESS",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", powerPlanId);

    if (updateError) {
      console.error("Error updating power plan:", updateError);
      return { data: null, error: updateError.message };
    }
  }

  await supabase.from("PowerCircuit").delete().eq("powerPlanId", powerPlanId);

  if (input.circuits.length > 0) {
    await supabase.from("PowerCircuit").insert(
      input.circuits
        .map((circuit) => ({
          powerPlanId,
          runLabel: circuit.runLabel.trim(),
          loadAmps: Math.max(0, Number(circuit.loadAmps || 0)),
          breaker: circuit.breaker || null,
          status: circuit.status || "PLANNED",
        }))
        .filter((circuit) => circuit.runLabel.length > 0),
    );
  }

  await supabase
    .from("SafetyChecklist")
    .delete()
    .eq("projectId", input.projectId)
    .eq("shootingDayId", input.shootingDayId)
    .eq("department", "GE");

  if (input.safetyChecklist.length > 0) {
    await supabase.from("SafetyChecklist").insert(
      input.safetyChecklist
        .map((item) => ({
          projectId: input.projectId,
          shootingDayId: input.shootingDayId,
          department: "GE",
          item: item.item.trim(),
          status: item.status || "REQUIRED",
          notes: item.notes || null,
          completedBy:
            item.status === "COMPLETE" || item.status === "FAILED" ? userId : null,
          completedAt:
            item.status === "COMPLETE" || item.status === "FAILED"
              ? new Date().toISOString()
              : null,
        }))
        .filter((item) => item.item.length > 0),
    );
  }

  await evaluatePowerSafetyReadiness(input.projectId, input.shootingDayId);

  if ((input.capacityAmps || 0) > 0 && input.generator) {
    await autoSyncDepartmentBudgetRequest({
      projectId: input.projectId,
      department: "GE",
      sourceType: "POWER_PLAN",
      sourceId: powerPlanId,
      plannedAmount: Math.max(0, Number(input.capacityAmps || 0)) * 10,
      reason: "Power plan generator/distribution estimate",
    });
  }

  const { data: powerPlan, error: loadError } = await supabase
    .from("PowerPlan")
    .select(
      `
      *,
      circuits:PowerCircuit(*),
      safetyChecklist:SafetyChecklist(*)
    `,
    )
    .eq("id", powerPlanId)
    .single();

  if (loadError) {
    console.error("Error loading power plan:", loadError);
    return { data: null, error: loadError.message };
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: powerPlan as PowerPlan, error: null };
}

export async function getPowerPlans(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("PowerPlan")
    .select(
      `
      *,
      circuits:PowerCircuit(*),
      safetyChecklist:SafetyChecklist(*)
    `,
    )
    .eq("projectId", projectId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching power plans:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as PowerPlan[], error: null };
}
