"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Types for call sheet data
export interface CallSheetSummary {
  id: string;
  shootingDayId: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface CallSheetRow {
  id: string;
  shootingDayId: string;
  version: number;
  publishedAt: string | null;
  nearestHospital: string | null;
  safetyNotes: string | null;
  parkingNotes: string | null;
  mealNotes: string | null;
  advanceNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallSheetUpdates {
  nearestHospital?: string | null;
  safetyNotes?: string | null;
  parkingNotes?: string | null;
  mealNotes?: string | null;
  advanceNotes?: string | null;
}

export interface CallSheetFullData {
  callSheet: CallSheetRow;
  shootingDay: {
    id: string;
    projectId: string;
    date: string;
    dayNumber: number;
    unit: string;
    generalCall: string | null;
    shootingCall: string | null;
    estimatedWrap: string | null;
    weatherNotes: string | null;
    notes: string | null;
    status: string;
  };
  project: {
    id: string;
    name: string;
    productionCompany: string | null;
    director: string | null;
    producer: string | null;
  };
  scenes: Array<{
    sceneId: string;
    sortOrder: number;
    scene: {
      id: string;
      sceneNumber: string;
      synopsis: string | null;
      intExt: string;
      dayNight: string;
      pageCount: number;
      setName: string | null;
      location: { name: string; address: string | null } | null;
      castMembers: Array<{
        castMember: {
          id: string;
          castNumber: number | null;
          characterName: string;
          actorName: string | null;
        };
      }>;
    };
  }>;
  castCallTimes: Array<{
    id: string;
    castMemberId: string;
    workStatus: string;
    pickupTime: string | null;
    muHairCall: string | null;
    onSetCall: string | null;
    remarks: string | null;
    castMember: {
      id: string;
      castNumber: number | null;
      characterName: string;
      actorName: string | null;
      email: string | null;
      phone: string | null;
    };
  }>;
  departmentCalls: Array<{
    id: string;
    department: string;
    callTime: string;
    notes: string | null;
  }>;
  locations: Array<{
    name: string;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    parkingNotes: string | null;
  }>;
}

// Get all call sheets for a project (for list view status)
export async function getCallSheetsForProject(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("CallSheet")
    .select(
      `
      id,
      shootingDayId,
      version,
      publishedAt,
      createdAt,
      shootingDay:ShootingDay!inner(projectId)
    `
    )
    .eq("shootingDay.projectId", projectId);

  if (error) {
    console.error("Error fetching call sheets:", error);
    return { data: null, error: error.message };
  }

  return { data: data as unknown as (CallSheetSummary & { shootingDay: { projectId: string } })[], error: null };
}

// Get or create a call sheet for a shooting day
export async function getOrCreateCallSheet(shootingDayId: string) {
  const supabase = await createClient();

  // Try to get existing
  let { data: callSheet, error: fetchError } = await supabase
    .from("CallSheet")
    .select("*")
    .eq("shootingDayId", shootingDayId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Error fetching call sheet:", fetchError);
    return { data: null, error: fetchError.message };
  }

  // Create if doesn't exist
  if (!callSheet) {
    const { data: newCallSheet, error: createError } = await supabase
      .from("CallSheet")
      .insert({ shootingDayId })
      .select("*")
      .single();

    if (createError) {
      console.error("Error creating call sheet:", createError);
      return { data: null, error: createError.message };
    }
    callSheet = newCallSheet;
  }

  return { data: callSheet as CallSheetRow, error: null };
}

// Update a call sheet's notes/info fields
export async function updateCallSheet(callSheetId: string, updates: CallSheetUpdates) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("CallSheet")
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", callSheetId)
    .select("*, shootingDay:ShootingDay(projectId)")
    .single();

  if (error) {
    console.error("Error updating call sheet:", error);
    return { data: null, error: error.message };
  }

  const projectId = (data as any)?.shootingDay?.projectId;
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }

  return { data: data as unknown as CallSheetRow, error: null };
}

// Publish a call sheet (sets publishedAt, increments version)
export async function publishCallSheet(callSheetId: string) {
  const supabase = await createClient();

  // First get current version
  const { data: current, error: fetchError } = await supabase
    .from("CallSheet")
    .select("version, shootingDay:ShootingDay(projectId)")
    .eq("id", callSheetId)
    .single();

  if (fetchError) {
    console.error("Error fetching call sheet for publish:", fetchError);
    return { data: null, error: fetchError.message };
  }

  const { data, error } = await supabase
    .from("CallSheet")
    .update({
      publishedAt: new Date().toISOString(),
      version: (current?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", callSheetId)
    .select("*")
    .single();

  if (error) {
    console.error("Error publishing call sheet:", error);
    return { data: null, error: error.message };
  }

  const pubProjectId = (current as any)?.shootingDay?.projectId;
  if (pubProjectId) {
    revalidatePath(`/projects/${pubProjectId}`);
  }

  return { data: data as unknown as CallSheetRow, error: null };
}

// Get full call sheet data (deep join for preview/PDF/email)
export async function getFullCallSheetData(
  shootingDayId: string,
  projectId: string
): Promise<{ data: CallSheetFullData | null; error: string | null }> {
  const supabase = await createClient();

  // Get or create the call sheet
  const { data: callSheet, error: csError } = await getOrCreateCallSheet(shootingDayId);
  if (csError || !callSheet) {
    return { data: null, error: csError || "Failed to get call sheet" };
  }

  // Fetch shooting day with project info
  const { data: shootingDay, error: sdError } = await supabase
    .from("ShootingDay")
    .select(
      `
      id,
      projectId,
      date,
      dayNumber,
      unit,
      generalCall,
      shootingCall,
      estimatedWrap,
      weatherNotes,
      notes,
      status,
      project:Project(
        id,
        name,
        productionCompany,
        director,
        producer
      )
    `
    )
    .eq("id", shootingDayId)
    .single();

  if (sdError || !shootingDay) {
    console.error("Error fetching shooting day:", sdError);
    return { data: null, error: sdError?.message || "Shooting day not found" };
  }

  // Fetch scenes for this shooting day (with cast and locations)
  const { data: scenes, error: scenesError } = await supabase
    .from("ShootingDayScene")
    .select(
      `
      sceneId,
      sortOrder,
      scene:Scene(
        id,
        sceneNumber,
        synopsis,
        intExt,
        dayNight,
        pageCount,
        setName,
        location:Location(name, address),
        castMembers:SceneCastMember(
          castMember:CastMember(
            id,
            castNumber,
            characterName,
            actorName
          )
        )
      )
    `
    )
    .eq("shootingDayId", shootingDayId)
    .order("sortOrder", { ascending: true });

  if (scenesError) {
    console.error("Error fetching scenes:", scenesError);
    return { data: null, error: scenesError.message };
  }

  // Fetch cast call times
  const { data: castCallTimes, error: castError } = await supabase
    .from("ShootingDayCast")
    .select(
      `
      id,
      castMemberId,
      workStatus,
      pickupTime,
      muHairCall,
      onSetCall,
      remarks,
      castMember:CastMember(
        id,
        castNumber,
        characterName,
        actorName,
        email,
        phone
      )
    `
    )
    .eq("shootingDayId", shootingDayId);

  if (castError) {
    console.error("Error fetching cast call times:", castError);
    return { data: null, error: castError.message };
  }

  // Fetch department calls
  const { data: departmentCalls, error: deptError } = await supabase
    .from("CallSheetDepartment")
    .select("id, department, callTime, notes")
    .eq("callSheetId", callSheet.id);

  if (deptError) {
    console.error("Error fetching department calls:", deptError);
    return { data: null, error: deptError.message };
  }

  // Collect unique locations from scenes
  const locationNames = new Set<string>();
  const locations: CallSheetFullData["locations"] = [];
  for (const s of scenes || []) {
    const loc = (s.scene as any)?.location;
    if (loc && !locationNames.has(loc.name)) {
      locationNames.add(loc.name);
      // Fetch full location details
      const { data: locDetail } = await supabase
        .from("Location")
        .select("name, address, contactName, contactPhone, parkingNotes")
        .eq("projectId", projectId)
        .eq("name", loc.name)
        .single();
      if (locDetail) {
        locations.push(locDetail);
      }
    }
  }

  return {
    data: {
      callSheet,
      shootingDay: {
        id: shootingDay.id,
        projectId: shootingDay.projectId,
        date: shootingDay.date,
        dayNumber: shootingDay.dayNumber,
        unit: shootingDay.unit,
        generalCall: shootingDay.generalCall,
        shootingCall: shootingDay.shootingCall,
        estimatedWrap: shootingDay.estimatedWrap,
        weatherNotes: shootingDay.weatherNotes,
        notes: shootingDay.notes,
        status: shootingDay.status,
      },
      project: (shootingDay as any).project,
      scenes: (scenes || []) as unknown as CallSheetFullData["scenes"],
      castCallTimes: (castCallTimes || []) as unknown as CallSheetFullData["castCallTimes"],
      departmentCalls: (departmentCalls || []) as unknown as CallSheetFullData["departmentCalls"],
      locations,
    },
    error: null,
  };
}
