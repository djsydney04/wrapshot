"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export type SceneStatus =
  | "NOT_SCHEDULED"
  | "SCHEDULED"
  | "PARTIALLY_SHOT"
  | "COMPLETED"
  | "CUT";

export type IntExt = "INT" | "EXT" | "BOTH";
export type DayNight = "DAY" | "NIGHT" | "DAWN" | "DUSK" | "MORNING" | "AFTERNOON" | "EVENING";

export interface SceneInput {
  projectId: string;
  sceneNumber: string;
  synopsis?: string;
  intExt?: IntExt;
  dayNight?: DayNight;
  setName?: string;
  locationId?: string;
  pageCount?: number;
  scriptDay?: string;
  estimatedMinutes?: number;
  notes?: string;
  status?: SceneStatus;
  sortOrder?: number;
  castIds?: string[];
}

export type BreakdownStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW";

export interface Scene {
  id: string;
  projectId: string;
  scriptId: string | null;
  sceneNumber: string;
  synopsis: string | null;
  intExt: IntExt;
  dayNight: DayNight;
  locationId: string | null;
  pageCount: number;
  scriptDay: string | null;
  estimatedMinutes: number | null;
  notes: string | null;
  status: SceneStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Stripboard fields
  episode?: string | null;
  scenePartNumber?: number | null;
  setName?: string | null;
  scriptPageStart?: number | null;
  scriptPageEnd?: number | null;
  pageEighths?: number | null;
  sequence?: string | null;
  estimatedHours?: number | null;
  breakdownStatus?: BreakdownStatus;
  scriptText?: string | null;
  elements?: string[];
  elementDetails?: SceneElementDetail[];
  // Joined data
  location?: { id: string; name: string } | null;
  cast?: { id: string; castMemberId: string; castMember: { id: string; characterName: string; actorName: string | null } }[];
}

export interface SceneElementDetail {
  id: string;
  elementId: string;
  quantity: number;
  notes: string | null;
  name: string;
  category: string;
  description: string | null;
  taskType: "FIND" | "PICK_UP" | "SOURCE" | "PREP" | "OTHER" | null;
  assignedToCrewId: string | null;
  assignedCrew?: {
    id: string;
    name: string;
    role: string;
    department: string;
  } | null;
}

interface SceneRow extends Omit<Scene, "elements" | "elementDetails"> {
  elementDetails?: Array<{
    id: string;
    elementId: string;
    quantity: number;
    notes: string | null;
    element:
      | {
          id: string;
          name: string;
          category: string;
          description: string | null;
          taskType?: "FIND" | "PICK_UP" | "SOURCE" | "PREP" | "OTHER" | null;
          assignedToCrewId?: string | null;
          assignedCrew?: {
            id: string;
            name: string;
            role: string;
            department: string;
          } | null;
        }
      | Array<{
          id: string;
          name: string;
          category: string;
          description: string | null;
          taskType?: "FIND" | "PICK_UP" | "SOURCE" | "PREP" | "OTHER" | null;
          assignedToCrewId?: string | null;
          assignedCrew?: {
            id: string;
            name: string;
            role: string;
            department: string;
          } | null;
        }>
      | null;
  }>;
}

const SCENE_SELECT_CORE = `
  *,
  location:Location(id, name),
  cast:SceneCastMember(
    id,
    castMemberId,
    castMember:CastMember(id, characterName, actorName)
  )
`;

const SCENE_SELECT_WITH_ELEMENT_ASSIGNMENTS = `
  ${SCENE_SELECT_CORE},
  elementDetails:SceneElement(
    id,
    elementId,
    quantity,
    notes,
    element:Element(
      id,
      name,
      category,
      description,
      taskType,
      assignedToCrewId,
      assignedCrew:CrewMember(id, name, role, department)
    )
  )
`;

const SCENE_SELECT_WITH_ELEMENTS = `
  ${SCENE_SELECT_CORE},
  elementDetails:SceneElement(
    id,
    elementId,
    quantity,
    notes,
    element:Element(
      id,
      name,
      category,
      description
    )
  )
`;

const SCENE_SELECT_MINIMAL = SCENE_SELECT_CORE;

function normalizeRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] || null : relation;
}

function isSchemaCompatibilityError(errorMessage: string): boolean {
  const lowered = errorMessage.toLowerCase();
  return (
    lowered.includes("column") ||
    lowered.includes("relationship") ||
    lowered.includes("schema cache") ||
    lowered.includes("could not find") ||
    lowered.includes("does not exist")
  );
}

async function queryScenesWithFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  queryBuilder: (
    select: string
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  context: "getScenes" | "getScene"
) {
  const selectAttempts = [
    SCENE_SELECT_WITH_ELEMENT_ASSIGNMENTS,
    SCENE_SELECT_WITH_ELEMENTS,
    SCENE_SELECT_MINIMAL,
  ];

  let lastError: { message: string } | null = null;

  for (let index = 0; index < selectAttempts.length; index++) {
    const select = selectAttempts[index];
    const { data, error } = await queryBuilder(select);

    if (!error) {
      if (index > 0) {
        console.warn(
          `[${context}] Falling back to scene query shape #${index + 1} due to schema mismatch.`
        );
      }
      return { data, error: null };
    }

    lastError = error;
    if (!isSchemaCompatibilityError(error.message)) {
      return { data: null, error };
    }
  }

  return { data: null, error: lastError };
}

function mapSceneRow(scene: SceneRow): Scene {
  const details = (scene.elementDetails || [])
    .map((detail) => {
      const element = Array.isArray(detail.element) ? detail.element[0] : detail.element;
      if (!element) return null;

      return {
        id: detail.id,
        elementId: detail.elementId,
        quantity: detail.quantity,
        notes: detail.notes,
        name: element.name,
        category: element.category,
        description: element.description,
        taskType: element.taskType ?? null,
        assignedToCrewId: element.assignedToCrewId ?? null,
        assignedCrew: normalizeRelation(element.assignedCrew) || null,
      } as SceneElementDetail;
    })
    .filter(Boolean) as SceneElementDetail[];

  return {
    ...scene,
    elementDetails: details,
    elements: details.map((detail) => detail.name),
  };
}

// Fetch all scenes for a project
export async function getScenes(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await queryScenesWithFallback(
    supabase,
    (select) =>
      supabase
        .from("Scene")
        .select(select)
        .eq("projectId", projectId)
        .order("sortOrder", { ascending: true }),
    "getScenes"
  );

  if (error) {
    console.error("Error fetching scenes:", error);
    return { data: null, error: error.message };
  }

  const mapped = ((data || []) as SceneRow[]).map((scene) => mapSceneRow(scene));
  return { data: mapped, error: null };
}

// Get a single scene
export async function getScene(sceneId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await queryScenesWithFallback(
    supabase,
    (select) => supabase.from("Scene").select(select).eq("id", sceneId).single(),
    "getScene"
  );

  if (error) {
    console.error("Error fetching scene:", error);
    return { data: null, error: error.message };
  }

  const mapped = mapSceneRow(data as SceneRow);
  return { data: mapped, error: null };
}

// Create a new scene
export async function createScene(input: SceneInput) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get current max sortOrder for the project
  const { data: existingScenes } = await supabase
    .from("Scene")
    .select("sortOrder")
    .eq("projectId", input.projectId)
    .order("sortOrder", { ascending: false })
    .limit(1);

  const maxSortOrder = existingScenes?.[0]?.sortOrder ?? -1;

  let resolvedLocationId = input.locationId || null;
  const normalizedSetName = input.setName?.trim();

  // If no explicit location was selected, auto-create a location from set name.
  if (!resolvedLocationId && normalizedSetName) {
    const { data: existingLocation } = await supabase
      .from("Location")
      .select("id")
      .eq("projectId", input.projectId)
      .eq("name", normalizedSetName)
      .limit(1)
      .maybeSingle();

    if (existingLocation?.id) {
      resolvedLocationId = existingLocation.id;
    } else {
      const { data: createdLocation } = await supabase
        .from("Location")
        .insert({
          projectId: input.projectId,
          name: normalizedSetName,
          interiorExterior: input.intExt || "INT",
        })
        .select("id")
        .single();

      resolvedLocationId = createdLocation?.id || null;
    }
  }

  // Create the scene
  const { data: scene, error: sceneError } = await supabase
    .from("Scene")
    .insert({
      projectId: input.projectId,
      sceneNumber: input.sceneNumber,
      synopsis: input.synopsis || null,
      intExt: input.intExt || "INT",
      dayNight: input.dayNight || "DAY",
      setName: normalizedSetName || null,
      locationId: resolvedLocationId,
      pageCount: input.pageCount || 1,
      scriptDay: input.scriptDay || null,
      estimatedMinutes: input.estimatedMinutes || null,
      notes: input.notes || null,
      status: input.status || "NOT_SCHEDULED",
      sortOrder: input.sortOrder ?? maxSortOrder + 1,
    })
    .select()
    .single();

  if (sceneError) {
    console.error("Error creating scene:", sceneError);
    return { data: null, error: sceneError.message };
  }

  // Add cast members if provided
  if (input.castIds && input.castIds.length > 0) {
    const castInserts = input.castIds.map((castMemberId) => ({
      sceneId: scene.id,
      castMemberId,
    }));

    const { error: castError } = await supabase
      .from("SceneCastMember")
      .insert(castInserts);

    if (castError) {
      console.error("Error adding cast to scene:", castError);
      // Don't fail the whole operation
    }
  }

  revalidatePath(`/projects/${input.projectId}`);

  return { data: scene, error: null };
}

// Update a scene
export async function updateScene(id: string, updates: Partial<SceneInput>) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Extract castIds to handle separately
  const { castIds, projectId, ...sceneUpdates } = updates;
  const normalizedSetName = sceneUpdates.setName?.trim();

  if (!sceneUpdates.locationId && normalizedSetName) {
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const { data: existingScene } = await supabase
        .from("Scene")
        .select("projectId")
        .eq("id", id)
        .single();
      resolvedProjectId = existingScene?.projectId;
    }

    if (!resolvedProjectId) {
      console.error("Unable to resolve projectId while auto-creating location for scene update");
    } else {
    const { data: existingLocation } = await supabase
      .from("Location")
      .select("id")
      .eq("projectId", resolvedProjectId)
      .eq("name", normalizedSetName)
      .limit(1)
      .maybeSingle();

    if (existingLocation?.id) {
      sceneUpdates.locationId = existingLocation.id;
    } else {
      const { data: createdLocation } = await supabase
        .from("Location")
        .insert({
          projectId: resolvedProjectId,
          name: normalizedSetName,
          interiorExterior: sceneUpdates.intExt || "INT",
        })
        .select("id")
        .single();

      if (createdLocation?.id) {
        sceneUpdates.locationId = createdLocation.id;
      }
    }
    }
  }

  // Update the scene
  const { data, error } = await supabase
    .from("Scene")
    .update({
      ...sceneUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating scene:", error);
    return { data: null, error: error.message };
  }

  // Update cast members if provided
  if (castIds !== undefined) {
    // Delete existing cast associations
    await supabase.from("SceneCastMember").delete().eq("sceneId", id);

    // Insert new associations
    if (castIds.length > 0) {
      const castInserts = castIds.map((castMemberId) => ({
        sceneId: id,
        castMemberId,
      }));

      await supabase.from("SceneCastMember").insert(castInserts);
    }
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data, error: null };
}

// Delete a scene
export async function deleteScene(id: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("Scene").delete().eq("id", id);

  if (error) {
    console.error("Error deleting scene:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Reorder scenes
export async function reorderScenes(projectId: string, sceneIds: string[]) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Update sortOrder for each scene
  const updates = sceneIds.map((id, index) =>
    supabase
      .from("Scene")
      .update({ sortOrder: index, updatedAt: new Date().toISOString() })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    console.error("Error reordering scenes:", errors);
    return { success: false, error: "Failed to reorder some scenes" };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Add cast member to scene
export async function addCastToScene(sceneId: string, castMemberId: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("SceneCastMember")
    .insert({ sceneId, castMemberId });

  if (error) {
    console.error("Error adding cast to scene:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Remove cast member from scene
export async function removeCastFromScene(sceneId: string, castMemberId: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("SceneCastMember")
    .delete()
    .eq("sceneId", sceneId)
    .eq("castMemberId", castMemberId);

  if (error) {
    console.error("Error removing cast from scene:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Assign scene to a shooting day
export async function assignSceneToShootingDay(
  sceneId: string,
  shootingDayId: string,
  position: number,
  projectId: string
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // First, remove the scene from any existing shooting day
  await supabase
    .from("ShootingDayScene")
    .delete()
    .eq("sceneId", sceneId);

  // Add to the new shooting day
  const { error: insertError } = await supabase
    .from("ShootingDayScene")
    .insert({
      shootingDayId,
      sceneId,
      sortOrder: position,
    });

  if (insertError) {
    console.error("Error assigning scene to shooting day:", insertError);
    return { success: false, error: insertError.message };
  }

  // Update scene status to SCHEDULED
  await supabase
    .from("Scene")
    .update({ status: "SCHEDULED", updatedAt: new Date().toISOString() })
    .eq("id", sceneId);

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Remove scene from a shooting day
export async function removeSceneFromShootingDay(
  sceneId: string,
  shootingDayId: string,
  projectId: string
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("ShootingDayScene")
    .delete()
    .eq("sceneId", sceneId)
    .eq("shootingDayId", shootingDayId);

  if (error) {
    console.error("Error removing scene from shooting day:", error);
    return { success: false, error: error.message };
  }

  // Update scene status to NOT_SCHEDULED
  await supabase
    .from("Scene")
    .update({ status: "NOT_SCHEDULED", updatedAt: new Date().toISOString() })
    .eq("id", sceneId);

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Update scene breakdown (bulk update cast, elements, etc.)
export async function updateSceneBreakdown(
  sceneId: string,
  projectId: string,
  updates: {
    castIds?: string[];
    elements?: { elementId: string; quantity: number; notes?: string }[];
    locationId?: string;
    notes?: string;
    breakdownStatus?: BreakdownStatus;
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  // Update scene fields if provided
  const sceneUpdates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (updates.locationId !== undefined) {
    sceneUpdates.locationId = updates.locationId || null;
  }
  if (updates.notes !== undefined) {
    sceneUpdates.notes = updates.notes || null;
  }
  if (updates.breakdownStatus !== undefined) {
    sceneUpdates.breakdownStatus = updates.breakdownStatus;
  }

  const { error: sceneError } = await supabase
    .from("Scene")
    .update(sceneUpdates)
    .eq("id", sceneId);

  if (sceneError) {
    console.error("Error updating scene:", sceneError);
    return { error: sceneError.message };
  }

  // Update cast members if provided
  if (updates.castIds !== undefined) {
    // Delete existing cast associations
    await supabase.from("SceneCastMember").delete().eq("sceneId", sceneId);

    // Insert new associations
    if (updates.castIds.length > 0) {
      const castInserts = updates.castIds.map((castMemberId) => ({
        sceneId,
        castMemberId,
      }));

      const { error: castError } = await supabase
        .from("SceneCastMember")
        .insert(castInserts);

      if (castError) {
        console.error("Error updating cast:", castError);
        // Don't fail the whole operation
      }
    }
  }

  // Update elements if provided
  if (updates.elements !== undefined) {
    // Delete existing element associations
    await supabase.from("SceneElement").delete().eq("sceneId", sceneId);

    // Insert new associations
    if (updates.elements.length > 0) {
      const elementInserts = updates.elements.map((elem) => ({
        sceneId,
        elementId: elem.elementId,
        quantity: elem.quantity,
        notes: elem.notes || null,
      }));

      const { error: elemError } = await supabase
        .from("SceneElement")
        .insert(elementInserts);

      if (elemError) {
        console.error("Error updating elements:", elemError);
        // Don't fail the whole operation
      }
    }
  }

  revalidatePath(`/projects/${projectId}`);

  return { error: null };
}

// Batch import scenes from breakdown
export async function batchCreateScenes(
  projectId: string,
  scenes: Array<{
    sceneNumber: string;
    synopsis?: string;
    intExt?: IntExt;
    dayNight?: DayNight;
    setName?: string;
    pageEighths?: number;
    scriptPageStart?: number;
    scriptPageEnd?: number;
  }>
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get current max sortOrder
  const { data: existingScenes } = await supabase
    .from("Scene")
    .select("sortOrder")
    .eq("projectId", projectId)
    .order("sortOrder", { ascending: false })
    .limit(1);

  let sortOrder = (existingScenes?.[0]?.sortOrder ?? -1) + 1;

  const scenesToInsert = scenes.map((scene) => ({
    projectId,
    sceneNumber: scene.sceneNumber,
    synopsis: scene.synopsis || null,
    intExt: scene.intExt || "INT",
    dayNight: scene.dayNight || "DAY",
    setName: scene.setName || null,
    pageCount: scene.pageEighths ? scene.pageEighths / 8 : 1,
    pageEighths: scene.pageEighths || 8,
    scriptPageStart: scene.scriptPageStart || null,
    scriptPageEnd: scene.scriptPageEnd || null,
    status: "NOT_SCHEDULED",
    breakdownStatus: "PENDING",
    sortOrder: sortOrder++,
  }));

  const { data, error } = await supabase
    .from("Scene")
    .insert(scenesToInsert)
    .select();

  if (error) {
    console.error("Error batch creating scenes:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { data, error: null };
}
