"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProjectPermission } from "@/lib/permissions/server";

export type ProjectTaskStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE";

export type ProjectTaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ProjectTaskType =
  | "GENERAL"
  | "ELEMENT"
  | "RIGGING"
  | "BUDGET"
  | "SCENE"
  | "CALLSHEET";

export type ProjectTaskAssigneeRole = "OWNER" | "COLLABORATOR";
export type ProjectTaskAssigneeType = "CREW" | "CAST";

export interface ProjectTaskAssigneeInput {
  type: ProjectTaskAssigneeType;
  memberId: string;
  assignmentRole?: ProjectTaskAssigneeRole;
}

export interface ProjectTaskAssignee {
  id: string;
  taskId: string;
  assignmentRole: ProjectTaskAssigneeRole;
  assigneeType: ProjectTaskAssigneeType;
  crewMemberId: string | null;
  castMemberId: string | null;
  assigneeName: string;
  assigneeSubtitle: string | null;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  taskType: ProjectTaskType;
  sourceId: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignments: ProjectTaskAssignee[];
}

export interface CreateProjectTaskInput {
  projectId: string;
  title: string;
  description?: string | null;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  taskType?: ProjectTaskType;
  sourceId?: string | null;
  dueDate?: string | null;
  assignees?: ProjectTaskAssigneeInput[];
}

export interface UpdateProjectTaskInput {
  title?: string;
  description?: string | null;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  taskType?: ProjectTaskType;
  sourceId?: string | null;
  dueDate?: string | null;
  assignees?: ProjectTaskAssigneeInput[];
}

interface CrewMemberRelation {
  id: string;
  name: string;
  role: string;
  department: string;
  userId: string | null;
}

interface CastMemberRelation {
  id: string;
  characterName: string;
  actorName: string | null;
  userId: string | null;
}

interface ProjectTaskAssigneeRow {
  id: string;
  taskId: string;
  crewMemberId: string | null;
  castMemberId: string | null;
  assignmentRole: ProjectTaskAssigneeRole;
  createdAt: string;
  updatedAt: string;
  crewMember: CrewMemberRelation | CrewMemberRelation[] | null;
  castMember: CastMemberRelation | CastMemberRelation[] | null;
}

interface ProjectTaskRow {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  taskType: ProjectTaskType;
  sourceId: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignments?: ProjectTaskAssigneeRow[] | null;
}

const PROJECT_TASK_SELECT = `
  id,
  projectId,
  title,
  description,
  status,
  priority,
  taskType,
  sourceId,
  dueDate,
  createdBy,
  createdAt,
  updatedAt,
  assignments:ProjectTaskAssignee(
    id,
    taskId,
    crewMemberId,
    castMemberId,
    assignmentRole,
    createdAt,
    updatedAt,
    crewMember:CrewMember(id, name, role, department, userId),
    castMember:CastMember(id, characterName, actorName, userId)
  )
`;

interface NormalizedTaskAssigneeInput {
  assignmentRole: ProjectTaskAssigneeRole;
  crewMemberId: string | null;
  castMemberId: string | null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function mapTaskAssignee(row: ProjectTaskAssigneeRow): ProjectTaskAssignee {
  const crewMember = normalizeRelation(row.crewMember);
  const castMember = normalizeRelation(row.castMember);

  if (row.crewMemberId) {
    return {
      id: row.id,
      taskId: row.taskId,
      assignmentRole: row.assignmentRole,
      assigneeType: "CREW",
      crewMemberId: row.crewMemberId,
      castMemberId: null,
      assigneeName: crewMember?.name || "Unknown Crew",
      assigneeSubtitle: crewMember?.role || null,
      assigneeUserId: crewMember?.userId || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    id: row.id,
    taskId: row.taskId,
    assignmentRole: row.assignmentRole,
    assigneeType: "CAST",
    crewMemberId: null,
    castMemberId: row.castMemberId,
    assigneeName: castMember?.characterName || "Unknown Cast",
    assigneeSubtitle: castMember?.actorName || null,
    assigneeUserId: castMember?.userId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTaskRow(row: ProjectTaskRow): ProjectTask {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    taskType: row.taskType,
    sourceId: row.sourceId,
    dueDate: row.dueDate,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignments: (row.assignments || []).map(mapTaskAssignee),
  };
}

function normalizeAssignees(
  assignees: ProjectTaskAssigneeInput[] | undefined
): NormalizedTaskAssigneeInput[] {
  if (!assignees || assignees.length === 0) return [];

  const dedupe = new Set<string>();
  const normalized: NormalizedTaskAssigneeInput[] = [];
  let ownerSet = false;

  for (const assignee of assignees) {
    const memberId = assignee.memberId.trim();
    if (!memberId) continue;

    const key = `${assignee.type}:${memberId}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    let assignmentRole: ProjectTaskAssigneeRole = assignee.assignmentRole || "OWNER";
    if (assignmentRole === "OWNER") {
      if (ownerSet) {
        assignmentRole = "COLLABORATOR";
      } else {
        ownerSet = true;
      }
    }

    normalized.push({
      assignmentRole,
      crewMemberId: assignee.type === "CREW" ? memberId : null,
      castMemberId: assignee.type === "CAST" ? memberId : null,
    });
  }

  if (normalized.length > 0 && !ownerSet) {
    normalized[0].assignmentRole = "OWNER";
  }

  return normalized;
}

async function getTaskProjectId(taskId: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectTask")
    .select("projectId")
    .eq("id", taskId)
    .single();

  if (error || !data?.projectId) {
    throw new Error("Task not found");
  }

  return data.projectId as string;
}

async function fetchTaskById(taskId: string): Promise<ProjectTask> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ProjectTask")
    .select(PROJECT_TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (error || !data) {
    throw new Error("Task not found");
  }

  return mapTaskRow(data as ProjectTaskRow);
}

async function replaceTaskAssignees(
  projectId: string,
  taskId: string,
  assignees: ProjectTaskAssigneeInput[] | undefined
): Promise<void> {
  const supabase = await createClient();
  const normalizedAssignees = normalizeAssignees(assignees);

  const crewIds = normalizedAssignees
    .map((assignee) => assignee.crewMemberId)
    .filter((id): id is string => Boolean(id));
  const castIds = normalizedAssignees
    .map((assignee) => assignee.castMemberId)
    .filter((id): id is string => Boolean(id));

  if (crewIds.length > 0) {
    const { data, error } = await supabase
      .from("CrewMember")
      .select("id")
      .eq("projectId", projectId)
      .in("id", crewIds);

    if (error) throw new Error(error.message);

    const found = new Set((data || []).map((row) => row.id as string));
    if (crewIds.some((id) => !found.has(id))) {
      throw new Error("One or more selected crew members are not in this project");
    }
  }

  if (castIds.length > 0) {
    const { data, error } = await supabase
      .from("CastMember")
      .select("id")
      .eq("projectId", projectId)
      .in("id", castIds);

    if (error) throw new Error(error.message);

    const found = new Set((data || []).map((row) => row.id as string));
    if (castIds.some((id) => !found.has(id))) {
      throw new Error("One or more selected cast members are not in this project");
    }
  }

  const { error: deleteError } = await supabase
    .from("ProjectTaskAssignee")
    .delete()
    .eq("taskId", taskId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (normalizedAssignees.length === 0) return;

  const insertRows = normalizedAssignees.map((assignee) => ({
    taskId,
    assignmentRole: assignee.assignmentRole,
    crewMemberId: assignee.crewMemberId,
    castMemberId: assignee.castMemberId,
  }));

  const { error: insertError } = await supabase
    .from("ProjectTaskAssignee")
    .insert(insertRows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function getProjectTasks(
  projectId: string
): Promise<{ data: ProjectTask[] | null; error: string | null }> {
  try {
    await requireProjectPermission(projectId, "project:read");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ProjectTask")
      .select(PROJECT_TASK_SELECT)
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: ((data || []) as ProjectTaskRow[]).map(mapTaskRow),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch tasks",
    };
  }
}

export async function createProjectTask(
  input: CreateProjectTaskInput
): Promise<{ data: ProjectTask | null; error: string | null }> {
  const title = input.title.trim();
  if (!title) {
    return { data: null, error: "Task title is required" };
  }

  try {
    const { userId } = await requireProjectPermission(input.projectId, "project:write");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ProjectTask")
      .insert({
        projectId: input.projectId,
        title,
        description: input.description?.trim() || null,
        status: input.status || "TODO",
        priority: input.priority || "NONE",
        taskType: input.taskType || "GENERAL",
        sourceId: input.sourceId || null,
        dueDate: input.dueDate || null,
        createdBy: userId,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return { data: null, error: error?.message || "Failed to create task" };
    }

    if (input.assignees !== undefined) {
      await replaceTaskAssignees(input.projectId, data.id as string, input.assignees);
    }

    revalidatePath(`/projects/${input.projectId}`);
    return { data: await fetchTaskById(data.id as string), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}

export async function updateProjectTask(
  taskId: string,
  updates: UpdateProjectTaskInput
): Promise<{ data: ProjectTask | null; error: string | null }> {
  try {
    const projectId = await getTaskProjectId(taskId);
    await requireProjectPermission(projectId, "project:write");
    const supabase = await createClient();

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      const title = updates.title.trim();
      if (!title) return { data: null, error: "Task title is required" };
      patch.title = title;
    }
    if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.taskType !== undefined) patch.taskType = updates.taskType;
    if (updates.sourceId !== undefined) patch.sourceId = updates.sourceId || null;
    if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate || null;

    if (Object.keys(patch).length > 1) {
      const { error } = await supabase.from("ProjectTask").update(patch).eq("id", taskId);
      if (error) return { data: null, error: error.message };
    }

    if (updates.assignees !== undefined) {
      await replaceTaskAssignees(projectId, taskId, updates.assignees);
    }

    revalidatePath(`/projects/${projectId}`);
    return { data: await fetchTaskById(taskId), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to update task",
    };
  }
}

export async function moveProjectTask(
  taskId: string,
  status: ProjectTaskStatus
): Promise<{ data: ProjectTask | null; error: string | null }> {
  return updateProjectTask(taskId, { status });
}

export async function assignTaskToCrewMember(
  taskId: string,
  crewMemberId: string,
  assignmentRole: ProjectTaskAssigneeRole = "OWNER"
): Promise<{ data: ProjectTask | null; error: string | null }> {
  try {
    const projectId = await getTaskProjectId(taskId);
    await requireProjectPermission(projectId, "project:write");
    const supabase = await createClient();

    const { data: crewMember, error: crewError } = await supabase
      .from("CrewMember")
      .select("id")
      .eq("id", crewMemberId)
      .eq("projectId", projectId)
      .maybeSingle();

    if (crewError) return { data: null, error: crewError.message };
    if (!crewMember) {
      return { data: null, error: "Crew member not found in this project" };
    }

    if (assignmentRole === "OWNER") {
      const { error: demoteError } = await supabase
        .from("ProjectTaskAssignee")
        .update({ assignmentRole: "COLLABORATOR" })
        .eq("taskId", taskId)
        .eq("assignmentRole", "OWNER");
      if (demoteError) return { data: null, error: demoteError.message };
    }

    const { data: existing, error: existingError } = await supabase
      .from("ProjectTaskAssignee")
      .select("id")
      .eq("taskId", taskId)
      .eq("crewMemberId", crewMemberId)
      .maybeSingle();

    if (existingError) {
      return { data: null, error: existingError.message };
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("ProjectTaskAssignee")
        .update({ assignmentRole })
        .eq("id", existing.id);

      if (updateError) return { data: null, error: updateError.message };
    } else {
      const { error: insertError } = await supabase.from("ProjectTaskAssignee").insert({
        taskId,
        crewMemberId,
        castMemberId: null,
        assignmentRole,
      });
      if (insertError) return { data: null, error: insertError.message };
    }

    revalidatePath(`/projects/${projectId}`);
    return { data: await fetchTaskById(taskId), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to assign task",
    };
  }
}

export async function assignTaskToCastMember(
  taskId: string,
  castMemberId: string,
  assignmentRole: ProjectTaskAssigneeRole = "OWNER"
): Promise<{ data: ProjectTask | null; error: string | null }> {
  try {
    const projectId = await getTaskProjectId(taskId);
    await requireProjectPermission(projectId, "project:write");
    const supabase = await createClient();

    const { data: castMember, error: castError } = await supabase
      .from("CastMember")
      .select("id")
      .eq("id", castMemberId)
      .eq("projectId", projectId)
      .maybeSingle();

    if (castError) return { data: null, error: castError.message };
    if (!castMember) {
      return { data: null, error: "Cast member not found in this project" };
    }

    if (assignmentRole === "OWNER") {
      const { error: demoteError } = await supabase
        .from("ProjectTaskAssignee")
        .update({ assignmentRole: "COLLABORATOR" })
        .eq("taskId", taskId)
        .eq("assignmentRole", "OWNER");
      if (demoteError) return { data: null, error: demoteError.message };
    }

    const { data: existing, error: existingError } = await supabase
      .from("ProjectTaskAssignee")
      .select("id")
      .eq("taskId", taskId)
      .eq("castMemberId", castMemberId)
      .maybeSingle();

    if (existingError) {
      return { data: null, error: existingError.message };
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("ProjectTaskAssignee")
        .update({ assignmentRole })
        .eq("id", existing.id);

      if (updateError) return { data: null, error: updateError.message };
    } else {
      const { error: insertError } = await supabase.from("ProjectTaskAssignee").insert({
        taskId,
        crewMemberId: null,
        castMemberId,
        assignmentRole,
      });
      if (insertError) return { data: null, error: insertError.message };
    }

    revalidatePath(`/projects/${projectId}`);
    return { data: await fetchTaskById(taskId), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to assign task",
    };
  }
}

interface TaskLookupRelation {
  projectId: string;
}

interface TaskLookupRow {
  id: string;
  taskId: string;
  task: TaskLookupRelation | TaskLookupRelation[] | null;
}

export async function unassignTask(
  assignmentId: string
): Promise<{ data: ProjectTask | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ProjectTaskAssignee")
      .select(`
        id,
        taskId,
        task:ProjectTask(projectId)
      `)
      .eq("id", assignmentId)
      .single();

    if (error || !data) {
      return { data: null, error: error?.message || "Assignment not found" };
    }

    const task = normalizeRelation((data as TaskLookupRow).task);
    if (!task?.projectId) {
      return { data: null, error: "Task not found for assignment" };
    }

    await requireProjectPermission(task.projectId, "project:write");

    const { error: deleteError } = await supabase
      .from("ProjectTaskAssignee")
      .delete()
      .eq("id", assignmentId);

    if (deleteError) return { data: null, error: deleteError.message };

    revalidatePath(`/projects/${task.projectId}`);
    return { data: await fetchTaskById((data as TaskLookupRow).taskId), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to unassign task",
    };
  }
}

export async function deleteProjectTask(
  taskId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const projectId = await getTaskProjectId(taskId);
    await requireProjectPermission(projectId, "project:write");
    const supabase = await createClient();

    const { error } = await supabase.from("ProjectTask").delete().eq("id", taskId);
    if (error) return { success: false, error: error.message };

    revalidatePath(`/projects/${projectId}`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete task",
    };
  }
}

export async function getTasksForPerson(
  projectId: string,
  person:
    | { type: "CREW"; crewMemberId: string }
    | { type: "CAST"; castMemberId: string }
): Promise<{ data: ProjectTask[] | null; error: string | null }> {
  const result = await getProjectTasks(projectId);
  if (result.error || !result.data) return result;

  const filtered = result.data.filter((task) =>
    task.assignments.some((assignee) => {
      if (person.type === "CREW") {
        return assignee.assigneeType === "CREW" && assignee.crewMemberId === person.crewMemberId;
      }
      return assignee.assigneeType === "CAST" && assignee.castMemberId === person.castMemberId;
    })
  );

  return { data: filtered, error: null };
}

export async function getUnassignedTasks(
  projectId: string
): Promise<{ data: ProjectTask[] | null; error: string | null }> {
  const result = await getProjectTasks(projectId);
  if (result.error || !result.data) return result;

  return {
    data: result.data.filter((task) => task.assignments.length === 0),
    error: null,
  };
}
