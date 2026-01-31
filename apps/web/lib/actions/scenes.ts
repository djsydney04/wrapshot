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
  // Stripeboard fields
  episode?: string | null;
  scenePartNumber?: number | null;
  setName?: string | null;
  scriptPageStart?: number | null;
  scriptPageEnd?: number | null;
  pageEighths?: number | null;
  sequence?: string | null;
  estimatedHours?: number | null;
  breakdownStatus?: BreakdownStatus;
  // Joined data
  location?: { id: string; name: string } | null;
  cast?: { id: string; castMemberId: string; castMember: { id: string; characterName: string; actorName: string | null } }[];
}

// Fetch all scenes for a project
export async function getScenes(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Scene")
    .select(`
      *,
      location:Location(id, name),
      cast:SceneCastMember(
        id,
        castMemberId,
        castMember:CastMember(id, characterName, actorName)
      )
    `)
    .eq("projectId", projectId)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Error fetching scenes:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Scene[], error: null };
}

// Get a single scene
export async function getScene(sceneId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Scene")
    .select(`
      *,
      location:Location(id, name),
      cast:SceneCastMember(
        id,
        castMemberId,
        castMember:CastMember(id, characterName, actorName)
      )
    `)
    .eq("id", sceneId)
    .single();

  if (error) {
    console.error("Error fetching scene:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Scene, error: null };
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

  // Create the scene
  const { data: scene, error: sceneError } = await supabase
    .from("Scene")
    .insert({
      projectId: input.projectId,
      sceneNumber: input.sceneNumber,
      synopsis: input.synopsis || null,
      intExt: input.intExt || "INT",
      dayNight: input.dayNight || "DAY",
      locationId: input.locationId || null,
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
