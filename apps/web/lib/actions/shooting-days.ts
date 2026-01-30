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

// Reschedule a shooting day to a new date
export async function rescheduleShootingDay(
  id: string,
  newDate: string,
  newCallTime?: string
) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    date: newDate,
    updatedAt: new Date().toISOString(),
  };

  if (newCallTime) {
    updateData.generalCall = newCallTime;
  }

  const { data, error } = await supabase
    .from("ShootingDay")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error rescheduling shooting day:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/schedule");

  return { data, error: null };
}

// Update scene order within a shooting day
export async function updateSceneOrder(
  shootingDayId: string,
  sceneIds: string[]
) {
  const supabase = await createClient();

  // Delete existing scene associations
  const { error: deleteError } = await supabase
    .from("ShootingDayScene")
    .delete()
    .eq("shootingDayId", shootingDayId);

  if (deleteError) {
    console.error("Error deleting scene associations:", deleteError);
    return { success: false, error: deleteError.message };
  }

  // Insert new associations with updated sort order
  if (sceneIds.length > 0) {
    const sceneInserts = sceneIds.map((sceneId, index) => ({
      shootingDayId,
      sceneId,
      sortOrder: index,
    }));

    const { error: insertError } = await supabase
      .from("ShootingDayScene")
      .insert(sceneInserts);

    if (insertError) {
      console.error("Error inserting scene associations:", insertError);
      return { success: false, error: insertError.message };
    }
  }

  // Get the shooting day to revalidate the project path
  const { data: shootingDay } = await supabase
    .from("ShootingDay")
    .select("projectId")
    .eq("id", shootingDayId)
    .single();

  if (shootingDay) {
    revalidatePath(`/projects/${shootingDay.projectId}`);
  }
  revalidatePath("/schedule");

  return { success: true, error: null };
}

// Cast call time type
export interface CastCallTime {
  castMemberId: string;
  workStatus: "W" | "SW" | "WF" | "SWF" | "H" | "R" | "T" | "WD";
  pickupTime?: string;
  muHairCall?: string;
  onSetCall?: string;
  remarks?: string;
}

// Update cast call times for a shooting day
export async function updateCastCallTimes(
  shootingDayId: string,
  castTimes: CastCallTime[]
) {
  const supabase = await createClient();

  // Delete existing cast associations
  const { error: deleteError } = await supabase
    .from("ShootingDayCast")
    .delete()
    .eq("shootingDayId", shootingDayId);

  if (deleteError) {
    console.error("Error deleting cast associations:", deleteError);
    return { success: false, error: deleteError.message };
  }

  // Insert new associations
  if (castTimes.length > 0) {
    const castInserts = castTimes.map((ct) => ({
      shootingDayId,
      castMemberId: ct.castMemberId,
      workStatus: ct.workStatus,
      pickupTime: ct.pickupTime || null,
      muHairCall: ct.muHairCall || null,
      onSetCall: ct.onSetCall || null,
      remarks: ct.remarks || null,
    }));

    const { error: insertError } = await supabase
      .from("ShootingDayCast")
      .insert(castInserts);

    if (insertError) {
      console.error("Error inserting cast associations:", insertError);
      return { success: false, error: insertError.message };
    }
  }

  // Get the shooting day to revalidate the project path
  const { data: shootingDay } = await supabase
    .from("ShootingDay")
    .select("projectId")
    .eq("id", shootingDayId)
    .single();

  if (shootingDay) {
    revalidatePath(`/projects/${shootingDay.projectId}`);
  }
  revalidatePath("/schedule");

  return { success: true, error: null };
}

// Department call time type
export interface DepartmentCallTime {
  department: string;
  callTime: string;
  notes?: string;
}

// Update department call times for a shooting day
export async function updateDepartmentCallTimes(
  shootingDayId: string,
  deptTimes: DepartmentCallTime[]
) {
  const supabase = await createClient();

  // First get or create the call sheet for this shooting day
  let { data: callSheet, error: fetchError } = await supabase
    .from("CallSheet")
    .select("id")
    .eq("shootingDayId", shootingDayId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("Error fetching call sheet:", fetchError);
    return { success: false, error: fetchError.message };
  }

  // Create call sheet if it doesn't exist
  if (!callSheet) {
    const { data: newCallSheet, error: createError } = await supabase
      .from("CallSheet")
      .insert({ shootingDayId })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating call sheet:", createError);
      return { success: false, error: createError.message };
    }
    callSheet = newCallSheet;
  }

  // Delete existing department calls
  const { error: deleteError } = await supabase
    .from("CallSheetDepartment")
    .delete()
    .eq("callSheetId", callSheet.id);

  if (deleteError) {
    console.error("Error deleting department calls:", deleteError);
    return { success: false, error: deleteError.message };
  }

  // Insert new department calls
  if (deptTimes.length > 0) {
    const deptInserts = deptTimes.map((dt) => ({
      callSheetId: callSheet!.id,
      department: dt.department,
      callTime: dt.callTime,
      notes: dt.notes || null,
    }));

    const { error: insertError } = await supabase
      .from("CallSheetDepartment")
      .insert(deptInserts);

    if (insertError) {
      console.error("Error inserting department calls:", insertError);
      return { success: false, error: insertError.message };
    }
  }

  // Get the shooting day to revalidate the project path
  const { data: shootingDay } = await supabase
    .from("ShootingDay")
    .select("projectId")
    .eq("id", shootingDayId)
    .single();

  if (shootingDay) {
    revalidatePath(`/projects/${shootingDay.projectId}`);
  }
  revalidatePath("/schedule");

  return { success: true, error: null };
}

// Get cast call times for a shooting day
export async function getShootingDayCast(shootingDayId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ShootingDayCast")
    .select(
      `
      *,
      castMember:CastMember(
        id,
        characterName,
        actorName,
        castNumber
      )
    `
    )
    .eq("shootingDayId", shootingDayId);

  if (error) {
    console.error("Error fetching shooting day cast:", error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Get department call times for a shooting day
export async function getShootingDayDepartments(shootingDayId: string) {
  const supabase = await createClient();

  const { data: callSheet, error: fetchError } = await supabase
    .from("CallSheet")
    .select(
      `
      id,
      departmentCalls:CallSheetDepartment(
        department,
        callTime,
        notes
      )
    `
    )
    .eq("shootingDayId", shootingDayId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      // No call sheet exists yet
      return { data: [], error: null };
    }
    console.error("Error fetching department calls:", fetchError);
    return { data: null, error: fetchError.message };
  }

  return { data: callSheet?.departmentCalls || [], error: null };
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
