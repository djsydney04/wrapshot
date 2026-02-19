"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import {
  dedupeBySceneNumberAndSet,
  normalizeSceneNumber,
  sortByScriptPageOrder,
} from "@/lib/scripts/scene-order";
import type { IntExt, DayNight } from "./scenes";

export interface ExtractedScene {
  scene_number: string;
  int_ext: "INT" | "EXT" | "BOTH";
  set_name: string;
  time_of_day: string;
  page_length_eighths: number;
  synopsis: string;
  characters: string[];
  script_page_start: number;
  script_page_end: number;
}

export interface BreakdownResult {
  scenes: ExtractedScene[];
  total_pages: number;
  total_scenes: number;
}

// Map time_of_day string to DayNight enum
function mapTimeOfDay(timeOfDay: string): DayNight {
  const normalized = timeOfDay.toUpperCase().trim();
  switch (normalized) {
    case "DAY":
      return "DAY";
    case "NIGHT":
      return "NIGHT";
    case "DAWN":
      return "DAWN";
    case "DUSK":
      return "DUSK";
    case "MORNING":
      return "MORNING";
    case "AFTERNOON":
      return "AFTERNOON";
    case "EVENING":
      return "EVENING";
    case "CONTINUOUS":
      return "DAY"; // Default continuous to day
    default:
      return "DAY";
  }
}

// Start a script breakdown
export async function startScriptBreakdown(scriptId: string, fileUrl: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Call the breakdown API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/scripts/breakdown`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scriptId, fileUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || "Breakdown failed" };
    }

    const result = await response.json();
    return { success: true, data: result.data as BreakdownResult };
  } catch (error) {
    console.error("Error starting breakdown:", error);
    return { success: false, error: "Failed to start breakdown" };
  }
}

// Import extracted scenes into the project
export async function importBreakdownScenes(
  projectId: string,
  scriptId: string,
  scenes: ExtractedScene[]
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Get current max sortOrder
    const { data: existingScenes } = await supabase
      .from("Scene")
      .select("sortOrder")
      .eq("projectId", projectId)
      .order("sortOrder", { ascending: false })
      .limit(1);

    let sortOrder = (existingScenes?.[0]?.sortOrder ?? -1) + 1;

    const orderedScenes = sortByScriptPageOrder(
      dedupeBySceneNumberAndSet(
        scenes,
        (scene) => scene.scene_number,
        (scene) => scene.set_name
      ),
      (scene) => scene.script_page_start
    ).map((scene, index) => ({
      ...scene,
      scene_number: normalizeSceneNumber(scene.scene_number, index + 1),
    }));

    // Create scenes from extracted data
    const scenesToInsert = orderedScenes.map((scene) => ({
      projectId,
      scriptId,
      sceneNumber: scene.scene_number,
      synopsis: scene.synopsis,
      intExt: scene.int_ext as IntExt,
      dayNight: mapTimeOfDay(scene.time_of_day),
      setName: scene.set_name,
      scriptPageStart: scene.script_page_start,
      scriptPageEnd: scene.script_page_end,
      pageEighths: scene.page_length_eighths,
      pageCount: scene.page_length_eighths / 8, // Convert eighths to decimal
      status: "NOT_SCHEDULED",
      breakdownStatus: "PENDING",
      sortOrder: sortOrder++,
    }));

    const { data: insertedScenes, error: insertError } = await supabase
      .from("Scene")
      .insert(scenesToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting scenes:", insertError);
      return { success: false, error: insertError.message };
    }

    // Now try to create cast members from character names
    const allCharacters = new Set<string>();
    orderedScenes.forEach((scene) => {
      scene.characters?.forEach((char) => allCharacters.add(char.toUpperCase()));
    });

    // Check for existing cast members
    const { data: existingCast } = await supabase
      .from("CastMember")
      .select("characterName")
      .eq("projectId", projectId);

    const existingNames = new Set(
      (existingCast || []).map((c) => c.characterName.toUpperCase())
    );

    // Get current max cast number
    const { data: maxCast } = await supabase
      .from("CastMember")
      .select("castNumber")
      .eq("projectId", projectId)
      .order("castNumber", { ascending: false })
      .limit(1);

    let castNumber = (maxCast?.[0]?.castNumber ?? 0) + 1;

    // Create new cast members for characters not already in the project
    const newCharacters = Array.from(allCharacters).filter(
      (char) => !existingNames.has(char)
    );

    if (newCharacters.length > 0) {
      const castToInsert = newCharacters.map((char) => ({
        projectId,
        characterName: char,
        castNumber: castNumber++,
        workStatus: "ON_HOLD",
      }));

      await supabase.from("CastMember").insert(castToInsert);
    }

    // Link cast to scenes based on character names
    const { data: allCast } = await supabase
      .from("CastMember")
      .select("id, characterName")
      .eq("projectId", projectId);

    const castMap = new Map(
      (allCast || []).map((c) => [c.characterName.toUpperCase(), c.id])
    );

    // Create scene-cast links
    const scenecastLinks: { sceneId: string; castMemberId: string }[] = [];

    insertedScenes?.forEach((scene, index) => {
      const extractedScene = orderedScenes[index];
      if (!extractedScene) return;
      extractedScene.characters?.forEach((char) => {
        const castId = castMap.get(char.toUpperCase());
        if (castId) {
          scenecastLinks.push({ sceneId: scene.id, castMemberId: castId });
        }
      });
    });

    if (scenecastLinks.length > 0) {
      await supabase.from("SceneCastMember").insert(scenecastLinks);
    }

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      scenesCreated: insertedScenes?.length || 0,
      castCreated: newCharacters.length,
    };
  } catch (error) {
    console.error("Error importing breakdown scenes:", error);
    return { success: false, error: "Failed to import scenes" };
  }
}

// Get breakdown status for a script
export async function getBreakdownStatus(scriptId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Script")
    .select(
      "id, breakdownStatus, breakdownStartedAt, breakdownCompletedAt, parsedContent"
    )
    .eq("id", scriptId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Update scene breakdown details
export async function updateSceneBreakdown(
  sceneId: string,
  updates: {
    setName?: string;
    pageEighths?: number;
    estimatedHours?: number;
    breakdownStatus?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW";
    synopsis?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Scene")
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", sceneId)
    .select("projectId")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);
  return { success: true, error: null };
}
