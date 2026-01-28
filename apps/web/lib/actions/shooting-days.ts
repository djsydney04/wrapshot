"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShootingDayStatus =
  | "TENTATIVE"
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface ShootingDayInput {
  projectId: string;
  date: string;
  dayNumber: number;
  unit?: string;
  status?: ShootingDayStatus;
  generalCall?: string;
  estimatedWrap?: string;
  notes?: string;
  scenes?: string[];
}

export interface ShootingDayRow {
  id: string;
  projectId: string;
  date: string;
  dayNumber: number;
  unit: string;
  isShootingDay: boolean;
  generalCall: string | null;
  shootingCall: string | null;
  estimatedWrap: string | null;
  actualWrap: string | null;
  weatherNotes: string | null;
  notes: string | null;
  status: ShootingDayStatus;
  createdAt: string;
  updatedAt: string;
}

// Fetch all shooting days for a project
export async function getShootingDays(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ShootingDay")
    .select(
      `
      *,
      scenes:ShootingDayScene(
        sceneId,
        sortOrder,
        scene:Scene(
          id,
          sceneNumber,
          synopsis,
          intExt,
          dayNight,
          pageCount,
          location:Location(name)
        )
      )
    `
    )
    .eq("projectId", projectId)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching shooting days:", error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Create a new shooting day
export async function createShootingDay(input: ShootingDayInput) {
  const supabase = await createClient();

  // First, create the shooting day
  const { data: shootingDay, error: dayError } = await supabase
    .from("ShootingDay")
    .insert({
      projectId: input.projectId,
      date: input.date,
      dayNumber: input.dayNumber,
      unit: input.unit || "MAIN",
      status: input.status || "TENTATIVE",
      generalCall: input.generalCall || null,
      estimatedWrap: input.estimatedWrap || null,
      notes: input.notes || null,
      isShootingDay: true,
    })
    .select()
    .single();

  if (dayError) {
    console.error("Error creating shooting day:", dayError);
    return { data: null, error: dayError.message };
  }

  // If scenes are provided, create the scene associations
  if (input.scenes && input.scenes.length > 0) {
    const sceneInserts = input.scenes.map((sceneId, index) => ({
      shootingDayId: shootingDay.id,
      sceneId,
      sortOrder: index,
    }));

    const { error: scenesError } = await supabase
      .from("ShootingDayScene")
      .insert(sceneInserts);

    if (scenesError) {
      console.error("Error adding scenes to shooting day:", scenesError);
      // Don't fail the whole operation, just log the error
    }
  }

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/schedule");

  return { data: shootingDay, error: null };
}

// Update a shooting day
export async function updateShootingDay(
  id: string,
  updates: Partial<ShootingDayInput>
) {
  const supabase = await createClient();

  // Extract scenes from updates to handle separately
  const { scenes, ...dayUpdates } = updates;

  // Update the shooting day
  const { data, error } = await supabase
    .from("ShootingDay")
    .update({
      ...dayUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating shooting day:", error);
    return { data: null, error: error.message };
  }

  // If scenes are provided, update the scene associations
  if (scenes !== undefined) {
    // First delete existing scene associations
    await supabase.from("ShootingDayScene").delete().eq("shootingDayId", id);

    // Then insert new associations
    if (scenes.length > 0) {
      const sceneInserts = scenes.map((sceneId, index) => ({
        shootingDayId: id,
        sceneId,
        sortOrder: index,
      }));

      await supabase.from("ShootingDayScene").insert(sceneInserts);
    }
  }

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/schedule");

  return { data, error: null };
}

// Delete a shooting day
export async function deleteShootingDay(id: string, projectId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("ShootingDay").delete().eq("id", id);

  if (error) {
    console.error("Error deleting shooting day:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");

  return { success: true, error: null };
}

// Get scenes for a project (for the form)
export async function getProjectScenes(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("Scene")
    .select(
      `
      id,
      sceneNumber,
      synopsis,
      intExt,
      dayNight,
      pageCount,
      location:Location(name)
    `
    )
    .eq("projectId", projectId)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Error fetching scenes:", error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
