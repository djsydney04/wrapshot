"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export type LocationType = "PRACTICAL" | "STUDIO" | "BACKLOT" | "VIRTUAL";
export type IntExt = "INT" | "EXT" | "BOTH";
export type PermitStatus = "NOT_STARTED" | "APPLIED" | "APPROVED" | "DENIED";

export interface LocationInput {
  projectId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationType?: LocationType;
  interiorExterior?: IntExt;
  permitStatus?: PermitStatus;
  permitStartDate?: string;
  permitEndDate?: string;
  locationFee?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  technicalNotes?: string;
  parkingNotes?: string;
  loadInNotes?: string;
  soundNotes?: string;
  backupLocationId?: string;
}

export interface Location {
  id: string;
  projectId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationType: LocationType;
  interiorExterior: IntExt;
  permitStatus: PermitStatus;
  permitStartDate: string | null;
  permitEndDate: string | null;
  locationFee: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  technicalNotes: string | null;
  parkingNotes: string | null;
  loadInNotes: string | null;
  soundNotes: string | null;
  backupLocationId: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  backupLocation?: { id: string; name: string } | null;
  sceneCount?: number;
}

// Fetch all locations for a project
export async function getLocations(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Location")
    .select(`
      *,
      backupLocation:Location!backupLocationId(id, name)
    `)
    .eq("projectId", projectId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching locations:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Location[], error: null };
}

// Get a single location
export async function getLocation(locationId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Location")
    .select(`
      *,
      backupLocation:Location!backupLocationId(id, name)
    `)
    .eq("id", locationId)
    .single();

  if (error) {
    console.error("Error fetching location:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Location, error: null };
}

// Create a new location
export async function createLocation(input: LocationInput) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Location")
    .insert({
      projectId: input.projectId,
      name: input.name,
      address: input.address || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      locationType: input.locationType || "PRACTICAL",
      interiorExterior: input.interiorExterior || "BOTH",
      permitStatus: input.permitStatus || "NOT_STARTED",
      permitStartDate: input.permitStartDate || null,
      permitEndDate: input.permitEndDate || null,
      locationFee: input.locationFee || null,
      contactName: input.contactName || null,
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      technicalNotes: input.technicalNotes || null,
      parkingNotes: input.parkingNotes || null,
      loadInNotes: input.loadInNotes || null,
      soundNotes: input.soundNotes || null,
      backupLocationId: input.backupLocationId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating location:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);

  return { data, error: null };
}

// Update a location
export async function updateLocation(id: string, updates: Partial<LocationInput>) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Remove projectId from updates if present
  const { projectId, ...locationUpdates } = updates;

  const { data, error } = await supabase
    .from("Location")
    .update({
      ...locationUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating location:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data, error: null };
}

// Delete a location
export async function deleteLocation(id: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("Location").delete().eq("id", id);

  if (error) {
    console.error("Error deleting location:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Get locations with scene counts
export async function getLocationsWithSceneCounts(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get locations
  const { data: locations, error: locError } = await supabase
    .from("Location")
    .select("*")
    .eq("projectId", projectId)
    .order("name", { ascending: true });

  if (locError) {
    console.error("Error fetching locations:", locError);
    return { data: null, error: locError.message };
  }

  // Get scene counts for each location
  const { data: sceneCounts, error: sceneError } = await supabase
    .from("Scene")
    .select("locationId")
    .eq("projectId", projectId)
    .not("locationId", "is", null);

  if (sceneError) {
    console.error("Error fetching scene counts:", sceneError);
    return { data: locations as Location[], error: null };
  }

  // Count scenes per location
  const countMap = new Map<string, number>();
  sceneCounts?.forEach((scene) => {
    if (scene.locationId) {
      countMap.set(scene.locationId, (countMap.get(scene.locationId) || 0) + 1);
    }
  });

  // Add counts to locations
  const locationsWithCounts = locations.map((loc) => ({
    ...loc,
    sceneCount: countMap.get(loc.id) || 0,
  }));

  return { data: locationsWithCounts as Location[], error: null };
}
