import { createClient } from "@/lib/supabase/server";

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
  brandDisplayName: string | null;
  brandLogoUrl: string | null;
  headerAccentColor: string | null;
  headerTextColor: string | null;
  footerText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallSheetUpdates {
  nearestHospital?: string | null;
  safetyNotes?: string | null;
  parkingNotes?: string | null;
  mealNotes?: string | null;
  advanceNotes?: string | null;
  brandDisplayName?: string | null;
  brandLogoUrl?: string | null;
  headerAccentColor?: string | null;
  headerTextColor?: string | null;
  footerText?: string | null;
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

type PostgrestLikeError = {
  code?: string;
  message?: string | null;
  details?: string | null;
};

function isNoRowsError(error: PostgrestLikeError | null): boolean {
  if (!error) return false;

  if (error.code === "PGRST116" || error.code === "PGRST505") {
    return true;
  }

  const text = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return (
    text.includes("0 rows") ||
    text.includes("no rows") ||
    text.includes("no data found")
  );
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export async function getCallSheetsForProjectData(projectId: string) {
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
    `,
    )
    .eq("shootingDay.projectId", projectId);

  if (error) {
    console.error("Error fetching call sheets:", error);
    return { data: null, error: error.message };
  }

  const normalized = (data || []).map((row) => {
    const shootingDay = firstRelation(
      (
        row as {
          shootingDay?: { projectId: string } | { projectId: string }[] | null;
        }
      ).shootingDay,
    );
    return {
      id: row.id,
      shootingDayId: row.shootingDayId,
      version: row.version,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      shootingDay: shootingDay || { projectId },
    };
  });

  return { data: normalized, error: null };
}

export async function getOrCreateCallSheetData(shootingDayId: string) {
  const supabase = await createClient();

  let { data: callSheet, error: fetchError } = await supabase
    .from("CallSheet")
    .select("*")
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching call sheet:", fetchError);
    return { data: null, error: fetchError.message };
  }

  if (!callSheet) {
    const { data: newCallSheet, error: createError } = await supabase
      .from("CallSheet")
      .insert({ shootingDayId })
      .select("*")
      .maybeSingle();

    if (createError) {
      // Handle race condition where another request inserted first.
      if (createError.code === "23505") {
        const { data: existing, error: retryError } = await supabase
          .from("CallSheet")
          .select("*")
          .eq("shootingDayId", shootingDayId)
          .maybeSingle();

        if (retryError || !existing) {
          console.error(
            "Error refetching call sheet after unique conflict:",
            retryError,
          );
          return {
            data: null,
            error: retryError?.message || createError.message,
          };
        }

        callSheet = existing;
      } else {
        console.error("Error creating call sheet:", createError);
        return { data: null, error: createError.message };
      }
    } else if (newCallSheet) {
      callSheet = newCallSheet;
    } else {
      // Insert can succeed but return no row depending on RLS/select visibility.
      const { data: existing, error: retryError } = await supabase
        .from("CallSheet")
        .select("*")
        .eq("shootingDayId", shootingDayId)
        .maybeSingle();

      if (retryError || !existing) {
        console.error("Call sheet created but could not be re-read:", retryError);
        return {
          data: null,
          error:
            retryError?.message ||
            "Call sheet exists but could not be read. Verify CallSheet SELECT policy.",
        };
      }

      callSheet = existing;
    }
  }

  return { data: callSheet as CallSheetRow, error: null };
}

export async function updateCallSheetData(
  callSheetId: string,
  updates: CallSheetUpdates,
) {
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
    return { data: null, error: error.message, projectId: null };
  }

  const shootingDay = firstRelation(
    (
      data as {
        shootingDay?: { projectId?: string } | { projectId?: string }[] | null;
      }
    ).shootingDay,
  );
  const projectId = shootingDay?.projectId ?? null;
  return { data: data as CallSheetRow, error: null, projectId };
}

export async function publishCallSheetData(callSheetId: string) {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("CallSheet")
    .select("version, shootingDay:ShootingDay(projectId)")
    .eq("id", callSheetId)
    .single();

  if (fetchError) {
    console.error("Error fetching call sheet for publish:", fetchError);
    return { data: null, error: fetchError.message, projectId: null };
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
    return { data: null, error: error.message, projectId: null };
  }

  const shootingDay = firstRelation(
    (
      current as {
        shootingDay?: { projectId?: string } | { projectId?: string }[] | null;
      }
    ).shootingDay,
  );
  const projectId = shootingDay?.projectId ?? null;
  return { data: data as CallSheetRow, error: null, projectId };
}

export async function getFullCallSheetDataForProject(
  shootingDayId: string,
  projectId: string,
): Promise<{ data: CallSheetFullData | null; error: string | null }> {
  const supabase = await createClient();

  const { data: callSheet, error: csError } =
    await getOrCreateCallSheetData(shootingDayId);
  if (csError || !callSheet) {
    return { data: null, error: csError || "Failed to get call sheet" };
  }

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
        name
      )
    `,
    )
    .eq("id", shootingDayId)
    .single();

  if (sdError || !shootingDay) {
    console.error("Error fetching shooting day:", sdError);
    return { data: null, error: sdError?.message || "Shooting day not found" };
  }

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
    `,
    )
    .eq("shootingDayId", shootingDayId)
    .order("sortOrder", { ascending: true });

  if (scenesError) {
    console.error("Error fetching scenes:", scenesError);
    return { data: null, error: scenesError.message };
  }

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
    `,
    )
    .eq("shootingDayId", shootingDayId);

  if (castError) {
    console.error("Error fetching cast call times:", castError);
    return { data: null, error: castError.message };
  }

  const { data: departmentCalls, error: deptError } = await supabase
    .from("CallSheetDepartment")
    .select("id, department, callTime, notes")
    .eq("callSheetId", callSheet.id);

  if (deptError) {
    console.error("Error fetching department calls:", deptError);
    return { data: null, error: deptError.message };
  }

  const projectRelation = firstRelation(
    (
      shootingDay as {
        project?:
          | { id: string; name: string; productionCompany?: string | null; director?: string | null; producer?: string | null }
          | { id: string; name: string; productionCompany?: string | null; director?: string | null; producer?: string | null }[]
          | null;
      }
    ).project,
  );
  const normalizedProject = projectRelation
    ? {
        id: projectRelation.id,
        name: projectRelation.name,
        productionCompany: projectRelation.productionCompany ?? null,
        director: projectRelation.director ?? null,
        producer: projectRelation.producer ?? null,
      }
    : null;

  type SceneCastMemberRelation = {
    castMember?:
      | CallSheetFullData["scenes"][number]["scene"]["castMembers"][number]["castMember"]
      | CallSheetFullData["scenes"][number]["scene"]["castMembers"][number]["castMember"][]
      | null;
  };
  type SceneRelation = Omit<
    CallSheetFullData["scenes"][number]["scene"],
    "location" | "castMembers"
  > & {
    location?:
      | { name: string; address: string | null }
      | { name: string; address: string | null }[]
      | null;
    castMembers?: SceneCastMemberRelation[];
  };

  const normalizedScenes: CallSheetFullData["scenes"] = (scenes || [])
    .map((row) => {
      const rowWithScene = row as unknown as {
        scene?: SceneRelation | SceneRelation[] | null;
      };
      const sceneRelation = firstRelation(rowWithScene.scene);

      if (!sceneRelation) return null;

      const location = firstRelation(sceneRelation.location);
      const castMembers = (sceneRelation.castMembers || [])
        .map((cm) => {
          const castMember = firstRelation(cm.castMember);
          if (!castMember) return null;
          return { castMember };
        })
        .filter(
          (
            cm,
          ): cm is {
            castMember: CallSheetFullData["scenes"][number]["scene"]["castMembers"][number]["castMember"];
          } => cm !== null,
        );

      return {
        sceneId: row.sceneId,
        sortOrder: row.sortOrder,
        scene: {
          ...sceneRelation,
          location: location
            ? { name: location.name, address: location.address }
            : null,
          castMembers,
        },
      };
    })
    .filter((row): row is CallSheetFullData["scenes"][number] => row !== null);

  const normalizedCastCallTimes: CallSheetFullData["castCallTimes"] = (
    castCallTimes || []
  )
    .map((row) => {
      const castMember = firstRelation(
        (
          row as {
            castMember?:
              | CallSheetFullData["castCallTimes"][number]["castMember"]
              | CallSheetFullData["castCallTimes"][number]["castMember"][]
              | null;
          }
        ).castMember,
      );
      if (!castMember) return null;
      return {
        id: row.id,
        castMemberId: row.castMemberId,
        workStatus: row.workStatus,
        pickupTime: row.pickupTime,
        muHairCall: row.muHairCall,
        onSetCall: row.onSetCall,
        remarks: row.remarks,
        castMember,
      };
    })
    .filter(
      (row): row is CallSheetFullData["castCallTimes"][number] => row !== null,
    );

  const locationNames = new Set<string>();
  const locations: CallSheetFullData["locations"] = [];
  for (const s of normalizedScenes) {
    const loc = s.scene.location;
    if (loc?.name && !locationNames.has(loc.name)) {
      locationNames.add(loc.name);
      const { data: locDetail, error: locError } = await supabase
        .from("Location")
        .select("name, address, contactName, contactPhone, parkingNotes")
        .eq("projectId", projectId)
        .eq("name", loc.name)
        .maybeSingle();

      if (locError && !isNoRowsError(locError)) {
        console.error("Error fetching location details for call sheet:", {
          locationName: loc.name,
          error: locError,
        });
      }

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
      project: normalizedProject || {
        id: "",
        name: "Production",
        productionCompany: null,
        director: null,
        producer: null,
      },
      scenes: normalizedScenes,
      castCallTimes: normalizedCastCallTimes,
      departmentCalls: (departmentCalls ||
        []) as CallSheetFullData["departmentCalls"],
      locations,
    },
    error: null,
  };
}
