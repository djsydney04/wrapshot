import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CallSheetListRow,
  type CallSheetSummary,
  type CastCallSummary,
  type DataResult,
  type DayOverview,
  type DepartmentCallSummary,
  type CrewCallSummary,
  type ProjectSummary,
  type SceneSummary,
  type ShootingDaySummary,
  type ShootingDayStatus,
} from "../types/mobile";
import { getSupabaseClient } from "./supabase";

type DayEditableFields = Pick<
  ShootingDaySummary,
  "status" | "notes" | "generalCall" | "shootingCall" | "estimatedWrap"
>;

type CallSheetEditableFields = Pick<
  CallSheetSummary,
  "nearestHospital" | "safetyNotes" | "parkingNotes" | "mealNotes" | "advanceNotes"
>;

type CastCallEditableFields = Pick<
  CastCallSummary,
  "workStatus" | "pickupTime" | "muHairCall" | "onSetCall" | "remarks"
>;

export function formatDateForDb(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeForInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function mapError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function requireClient(): DataResult<SupabaseClient> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error:
        "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  return { data: client, error: null };
}

export async function fetchProjects(): Promise<DataResult<ProjectSummary[]>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("Project")
    .select("id, name, status, updatedAt")
    .order("updatedAt", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data || []) as ProjectSummary[], error: null };
}

export async function fetchShootingDays(
  projectId: string,
): Promise<DataResult<ShootingDaySummary[]>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("ShootingDay")
    .select(
      "id, projectId, date, dayNumber, unit, status, generalCall, shootingCall, estimatedWrap, notes, updatedAt",
    )
    .eq("projectId", projectId)
    .order("date", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data || []) as ShootingDaySummary[], error: null };
}

interface RawCallSheetListRow {
  id: string;
  shootingDayId: string;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  shootingDay:
    | {
        dayNumber: number;
        date: string;
        projectId: string;
      }
    | {
        dayNumber: number;
        date: string;
        projectId: string;
      }[]
    | null;
}

export async function fetchCallSheetList(
  projectId: string,
): Promise<DataResult<CallSheetListRow[]>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("CallSheet")
    .select(
      "id, shootingDayId, version, publishedAt, updatedAt, shootingDay:ShootingDay!inner(dayNumber, date, projectId)",
    )
    .eq("shootingDay.projectId", projectId)
    .order("updatedAt", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  const normalized = ((data || []) as RawCallSheetListRow[])
    .map((row) => {
      const day = firstRelation(row.shootingDay);
      if (!day) return null;
      return {
        id: row.id,
        shootingDayId: row.shootingDayId,
        version: row.version,
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
        dayNumber: day.dayNumber,
        date: day.date,
      };
    })
    .filter((row): row is CallSheetListRow => row !== null);

  return { data: normalized, error: null };
}

async function fetchDayByDate(
  client: SupabaseClient,
  projectId: string,
  dateIso: string,
): Promise<ShootingDaySummary | null> {
  const columns =
    "id, projectId, date, dayNumber, unit, status, generalCall, shootingCall, estimatedWrap, notes, updatedAt";

  const todayResult = await client
    .from("ShootingDay")
    .select(columns)
    .eq("projectId", projectId)
    .eq("date", dateIso)
    .maybeSingle();

  if (!todayResult.error && todayResult.data) {
    return todayResult.data as ShootingDaySummary;
  }

  const upcomingResult = await client
    .from("ShootingDay")
    .select(columns)
    .eq("projectId", projectId)
    .gte("date", dateIso)
    .order("date", { ascending: true })
    .limit(1);

  if (!upcomingResult.error && (upcomingResult.data || []).length > 0) {
    return upcomingResult.data?.[0] as ShootingDaySummary;
  }

  const latestResult = await client
    .from("ShootingDay")
    .select(columns)
    .eq("projectId", projectId)
    .order("date", { ascending: false })
    .limit(1);

  if (!latestResult.error && (latestResult.data || []).length > 0) {
    return latestResult.data?.[0] as ShootingDaySummary;
  }

  return null;
}

async function getOrCreateCallSheet(
  client: SupabaseClient,
  shootingDayId: string,
): Promise<CallSheetSummary | null> {
  const existing = await client
    .from("CallSheet")
    .select(
      "id, shootingDayId, version, publishedAt, nearestHospital, safetyNotes, parkingNotes, mealNotes, advanceNotes, updatedAt",
    )
    .eq("shootingDayId", shootingDayId)
    .maybeSingle();

  if (!existing.error && existing.data) {
    return existing.data as CallSheetSummary;
  }

  const inserted = await client
    .from("CallSheet")
    .insert({ shootingDayId })
    .select(
      "id, shootingDayId, version, publishedAt, nearestHospital, safetyNotes, parkingNotes, mealNotes, advanceNotes, updatedAt",
    )
    .maybeSingle();

  if (!inserted.error && inserted.data) {
    return inserted.data as CallSheetSummary;
  }

  if (inserted.error && inserted.error.code === "23505") {
    const retry = await client
      .from("CallSheet")
      .select(
        "id, shootingDayId, version, publishedAt, nearestHospital, safetyNotes, parkingNotes, mealNotes, advanceNotes, updatedAt",
      )
      .eq("shootingDayId", shootingDayId)
      .maybeSingle();

    if (!retry.error && retry.data) {
      return retry.data as CallSheetSummary;
    }
  }

  return null;
}

interface RawSceneRow {
  sortOrder: number;
  scene:
    | {
        id: string;
        sceneNumber: string;
        synopsis: string | null;
        intExt: string;
        dayNight: string;
        pageCount: number;
        setName: string | null;
        location:
          | {
              name: string;
              address: string | null;
            }
          | {
              name: string;
              address: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        sceneNumber: string;
        synopsis: string | null;
        intExt: string;
        dayNight: string;
        pageCount: number;
        setName: string | null;
        location:
          | {
              name: string;
              address: string | null;
            }
          | {
              name: string;
              address: string | null;
            }[]
          | null;
      }[]
    | null;
}

interface RawCastCallRow {
  id: string;
  castMemberId: string;
  workStatus: string;
  pickupTime: string | null;
  muHairCall: string | null;
  onSetCall: string | null;
  remarks: string | null;
  castMember:
    | {
        characterName: string;
        actorName: string | null;
        castNumber: number | null;
      }
    | {
        characterName: string;
        actorName: string | null;
        castNumber: number | null;
      }[]
    | null;
}

export async function fetchDayOverview(
  projectId: string,
  dateIso: string = formatDateForDb(),
): Promise<DataResult<DayOverview>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };
  const client = clientResult.data;

  try {
    const day = await fetchDayByDate(client, projectId, dateIso);

    if (!day) {
      return {
        data: {
          day: null,
          callSheet: null,
          scenes: [],
          castCalls: [],
          departmentCalls: [],
          crewCalls: [],
        },
        error: null,
      };
    }

    const callSheet = await getOrCreateCallSheet(client, day.id);

    const [scenesRes, castRes, deptRes, crewRes] = await Promise.all([
      client
        .from("ShootingDayScene")
        .select(
          "sortOrder, scene:Scene(id, sceneNumber, synopsis, intExt, dayNight, pageCount, setName, location:Location(name, address))",
        )
        .eq("shootingDayId", day.id)
        .order("sortOrder", { ascending: true }),
      client
        .from("ShootingDayCast")
        .select(
          "id, castMemberId, workStatus, pickupTime, muHairCall, onSetCall, remarks, castMember:CastMember(characterName, actorName, castNumber)",
        )
        .eq("shootingDayId", day.id),
      callSheet
        ? client
            .from("CallSheetDepartment")
            .select("id, department, callTime, notes")
            .eq("callSheetId", callSheet.id)
            .order("department", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      callSheet
        ? client
            .from("CallSheetCrewCall")
            .select("id, crewName, callTime, notes, sortOrder")
            .eq("callSheetId", callSheet.id)
            .order("sortOrder", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (scenesRes.error) {
      return { data: null, error: scenesRes.error.message };
    }
    if (castRes.error) {
      return { data: null, error: castRes.error.message };
    }
    if (deptRes.error) {
      return { data: null, error: deptRes.error.message };
    }
    if (crewRes.error) {
      return { data: null, error: crewRes.error.message };
    }

    const scenes: SceneSummary[] = ((scenesRes.data || []) as RawSceneRow[])
      .map((row) => {
        const scene = firstRelation(row.scene);
        if (!scene) return null;

        const location = firstRelation(scene.location);

        return {
          id: scene.id,
          sceneNumber: scene.sceneNumber,
          synopsis: scene.synopsis,
          intExt: scene.intExt,
          dayNight: scene.dayNight,
          pageCount: scene.pageCount,
          setName: scene.setName,
          locationName: location?.name ?? null,
          locationAddress: location?.address ?? null,
        };
      })
      .filter((row): row is SceneSummary => row !== null);

    const castCalls: CastCallSummary[] = ((castRes.data || []) as RawCastCallRow[])
      .map((row) => {
        const castMember = firstRelation(row.castMember);
        if (!castMember) return null;

        return {
          id: row.id,
          castMemberId: row.castMemberId,
          characterName: castMember.characterName,
          actorName: castMember.actorName,
          castNumber: castMember.castNumber,
          workStatus: row.workStatus,
          pickupTime: row.pickupTime,
          muHairCall: row.muHairCall,
          onSetCall: row.onSetCall,
          remarks: row.remarks,
        };
      })
      .filter((row): row is CastCallSummary => row !== null)
      .sort((a, b) => (a.castNumber ?? Number.MAX_SAFE_INTEGER) - (b.castNumber ?? Number.MAX_SAFE_INTEGER));

    return {
      data: {
        day,
        callSheet,
        scenes,
        castCalls,
        departmentCalls: (deptRes.data || []) as DepartmentCallSummary[],
        crewCalls: (crewRes.data || []) as CrewCallSummary[],
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: mapError(error) };
  }
}

export async function updateShootingDay(
  shootingDayId: string,
  updates: Partial<DayEditableFields>,
): Promise<DataResult<ShootingDaySummary>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("ShootingDay")
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq("id", shootingDayId)
    .select(
      "id, projectId, date, dayNumber, unit, status, generalCall, shootingCall, estimatedWrap, notes, updatedAt",
    )
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as ShootingDaySummary, error: null };
}

export async function updateCallSheet(
  callSheetId: string,
  updates: Partial<CallSheetEditableFields>,
): Promise<DataResult<CallSheetSummary>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("CallSheet")
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq("id", callSheetId)
    .select(
      "id, shootingDayId, version, publishedAt, nearestHospital, safetyNotes, parkingNotes, mealNotes, advanceNotes, updatedAt",
    )
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as CallSheetSummary, error: null };
}

export async function publishCallSheet(callSheetId: string): Promise<DataResult<CallSheetSummary>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };
  const client = clientResult.data;

  const current = await client
    .from("CallSheet")
    .select("version")
    .eq("id", callSheetId)
    .maybeSingle();

  if (current.error || !current.data) {
    return { data: null, error: current.error?.message || "Call sheet not found" };
  }

  const { data, error } = await client
    .from("CallSheet")
    .update({
      version: (current.data.version || 0) + 1,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", callSheetId)
    .select(
      "id, shootingDayId, version, publishedAt, nearestHospital, safetyNotes, parkingNotes, mealNotes, advanceNotes, updatedAt",
    )
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as CallSheetSummary, error: null };
}

export async function updateCastCall(
  shootingDayCastId: string,
  updates: Partial<CastCallEditableFields>,
): Promise<DataResult<CastCallSummary>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("ShootingDayCast")
    .update(updates)
    .eq("id", shootingDayCastId)
    .select(
      "id, castMemberId, workStatus, pickupTime, muHairCall, onSetCall, remarks, castMember:CastMember(characterName, actorName, castNumber)",
    )
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  const castMemberRow = firstRelation(
    (
      data as {
        castMember:
          | {
              characterName: string;
              actorName: string | null;
              castNumber: number | null;
            }
          | {
              characterName: string;
              actorName: string | null;
              castNumber: number | null;
            }[]
          | null;
      }
    ).castMember,
  );

  if (!castMemberRow) {
    return { data: null, error: "Failed to resolve cast member for updated call" };
  }

  return {
    data: {
      id: data.id,
      castMemberId: data.castMemberId,
      characterName: castMemberRow.characterName,
      actorName: castMemberRow.actorName,
      castNumber: castMemberRow.castNumber,
      workStatus: data.workStatus,
      pickupTime: data.pickupTime,
      muHairCall: data.muHairCall,
      onSetCall: data.onSetCall,
      remarks: data.remarks,
    },
    error: null,
  };
}

interface DepartmentCallUpsertInput {
  callSheetId: string;
  department: string;
  callTime: string;
  notes: string | null;
}

export async function upsertDepartmentCall(
  input: DepartmentCallUpsertInput,
): Promise<DataResult<DepartmentCallSummary>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("CallSheetDepartment")
    .upsert(input, { onConflict: "callSheetId,department" })
    .select("id, department, callTime, notes")
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as DepartmentCallSummary, error: null };
}

interface CrewCallUpsertInput {
  callSheetId: string;
  crewName: string;
  callTime: string;
  notes: string | null;
  sortOrder: number;
}

export async function upsertCrewCall(
  input: CrewCallUpsertInput,
): Promise<DataResult<CrewCallSummary>> {
  const clientResult = requireClient();
  if (!clientResult.data) return { data: null, error: clientResult.error };

  const { data, error } = await clientResult.data
    .from("CallSheetCrewCall")
    .upsert(input, { onConflict: "callSheetId,crewName" })
    .select("id, crewName, callTime, notes, sortOrder")
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as CrewCallSummary, error: null };
}

export function normalizeDayStatus(status: string): ShootingDayStatus {
  const valid: ShootingDayStatus[] = [
    "TENTATIVE",
    "SCHEDULED",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ];

  if (valid.includes(status as ShootingDayStatus)) {
    return status as ShootingDayStatus;
  }

  return "SCHEDULED";
}
