import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient, SCENE_EXTRACTION_PROMPT, KimiClient as KC } from "@/lib/ai/kimi-client";
import { parseScript, normalizeScriptText } from "@/lib/scripts/parser";
import { ScriptChunker } from "@/lib/agents/script-analysis/chunker";
import {
  adjustChunkLocalPage,
  dedupeBySceneNumberAndSet,
  normalizeSceneNumber,
  sortByScriptPageOrder,
} from "@/lib/scripts/scene-order";
import { extractHeuristicScenesFromChunkText } from "@/lib/scripts/scene-heuristics";
import { getScriptAnalysisApiKey } from "@/lib/ai/config";
import { isTrustedSupabaseStorageUrl } from "@/lib/security/script-url";

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

interface SceneExtractionResponse {
  scenes?: Partial<ExtractedScene>[];
}

const LEGACY_BREAKDOWN_MAX_CHARS_PER_CHUNK = 14000;
const LEGACY_BREAKDOWN_MIN_CHARS_PER_CHUNK = 2500;
const LEGACY_MIN_SCENE_TOKENS = 1400;
const LEGACY_MAX_SCENE_TOKENS = 5000;

async function extractScenesWithChunking(
  scriptText: string,
  scriptId: string,
  kimi: KimiClient
): Promise<ExtractedScene[]> {
  const chunker = ScriptChunker.create({
    maxCharsPerChunk: LEGACY_BREAKDOWN_MAX_CHARS_PER_CHUNK,
    minCharsPerChunk: LEGACY_BREAKDOWN_MIN_CHARS_PER_CHUNK,
  });
  const { chunks } = chunker.chunk(
    scriptText,
    `legacy-breakdown-${scriptId}-${Date.now()}`,
    scriptId
  );

  const extractedScenes: ExtractedScene[] = [];

  for (const chunk of chunks) {
    const chunkFallbackScenes = buildLegacyHeuristicScenes(
      chunk,
      extractedScenes.length + 1
    );

    try {
      const response = await kimi.complete({
        messages: [
          { role: "system", content: SCENE_EXTRACTION_PROMPT },
          {
            role: "user",
            content:
              `Extract all scenes from this screenplay section. ` +
              `Keep scenes in the same order they appear in this section. ` +
              `Section ${chunk.chunkIndex + 1} of ${chunks.length} ` +
              `(estimated pages ${chunk.pageStart}-${chunk.pageEnd}).\n\n${chunk.chunkText}`,
          },
        ],
        maxTokens: estimateLegacySceneExtractionMaxTokens(chunk),
        temperature: 0.1,
      });

      const parsed = KC.extractJson<SceneExtractionResponse | BreakdownResult>(response);
      const chunkScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
      const normalizedChunkScenes: ExtractedScene[] = [];

      for (const scene of chunkScenes) {
        const normalized = normalizeExtractedScene(
          scene,
          extractedScenes.length + normalizedChunkScenes.length + 1,
          chunk.pageStart ?? 1
        );
        if (normalized) {
          normalizedChunkScenes.push(normalized);
        }
      }

      if (normalizedChunkScenes.length === 0 && chunkFallbackScenes.length > 0) {
        extractedScenes.push(...chunkFallbackScenes);
        continue;
      }

      if (shouldSupplementLegacyScenes(normalizedChunkScenes, chunkFallbackScenes)) {
        extractedScenes.push(
          ...mergeLegacySceneFallback(normalizedChunkScenes, chunkFallbackScenes)
        );
        continue;
      }

      extractedScenes.push(...normalizedChunkScenes);
    } catch (error) {
      console.error(
        `[LegacyScriptBreakdown] Failed to process chunk ${chunk.chunkIndex + 1}/${chunks.length}:`,
        error
      );

      if (chunkFallbackScenes.length > 0) {
        extractedScenes.push(...chunkFallbackScenes);
      }
    }
  }

  if (extractedScenes.length === 0) {
    throw new Error("No scenes were extracted from any script chunk");
  }

  const deduped = dedupeBySceneNumberAndSet(
    extractedScenes,
    (scene) => scene.scene_number,
    (scene) => scene.set_name
  );

  return sortByScriptPageOrder(deduped, (scene) => scene.script_page_start);
}

function estimateLegacySceneExtractionMaxTokens(
  chunk: { sceneCount?: number }
): number {
  const estimatedScenes = typeof chunk.sceneCount === "number"
    ? Math.max(chunk.sceneCount, 1)
    : 8;
  const target = estimatedScenes * 180;
  return Math.max(LEGACY_MIN_SCENE_TOKENS, Math.min(LEGACY_MAX_SCENE_TOKENS, target));
}

function buildLegacyHeuristicScenes(
  chunk: { chunkText: string; pageStart: number | null; pageEnd: number | null },
  fallbackSceneNumber: number
): ExtractedScene[] {
  const scenes = extractHeuristicScenesFromChunkText(chunk.chunkText, {
    chunkPageStart: chunk.pageStart ?? 1,
    chunkPageEnd: chunk.pageEnd ?? undefined,
    startingSceneNumber: fallbackSceneNumber - 1,
  });

  return scenes.map((scene, index) => ({
    scene_number: normalizeSceneNumber(scene.sceneNumber, fallbackSceneNumber + index),
    int_ext: scene.intExt,
    set_name: scene.setName,
    time_of_day: scene.timeOfDay,
    page_length_eighths: scene.pageLengthEighths,
    synopsis: scene.synopsis,
    characters: scene.characters,
    script_page_start: scene.scriptPageStart,
    script_page_end: scene.scriptPageEnd,
  }));
}

function shouldSupplementLegacyScenes(
  primaryScenes: ExtractedScene[],
  fallbackScenes: ExtractedScene[]
): boolean {
  if (primaryScenes.length === 0 || fallbackScenes.length < 3) {
    return false;
  }

  const coverageRatio = primaryScenes.length / fallbackScenes.length;
  return coverageRatio < 0.55;
}

function mergeLegacySceneFallback(
  primaryScenes: ExtractedScene[],
  fallbackScenes: ExtractedScene[]
): ExtractedScene[] {
  const merged = [...primaryScenes];
  const seen = new Set(
    merged.map((scene) => makeLegacySceneKey(scene.scene_number, scene.set_name))
  );

  for (const scene of fallbackScenes) {
    const key = makeLegacySceneKey(scene.scene_number, scene.set_name);
    if (!seen.has(key)) {
      merged.push(scene);
      seen.add(key);
    }
  }

  return merged;
}

function makeLegacySceneKey(sceneNumber: string, setName: string): string {
  return `${normalizeSceneNumber(sceneNumber, 0).toUpperCase()}::${setName.trim().toUpperCase()}`;
}

function normalizeExtractedScene(
  scene: Partial<ExtractedScene>,
  fallbackSceneNumber: number,
  chunkPageStart: number
): ExtractedScene | null {
  const setName = String(scene.set_name || "").trim();
  if (!setName) {
    return null;
  }

  const sceneNumber = normalizeSceneNumber(scene.scene_number, fallbackSceneNumber);
  const pageStart = adjustChunkLocalPage(scene.script_page_start, chunkPageStart);
  const pageEndRaw = adjustChunkLocalPage(scene.script_page_end, chunkPageStart);
  const pageEnd = pageEndRaw && pageStart ? Math.max(pageStart, pageEndRaw) : pageEndRaw;

  return {
    scene_number: sceneNumber,
    int_ext: normalizeIntExt(scene.int_ext),
    set_name: setName,
    time_of_day: normalizeTimeOfDay(scene.time_of_day),
    page_length_eighths: normalizePageLengthEighths(scene.page_length_eighths),
    synopsis: String(scene.synopsis || "").trim(),
    characters: normalizeCharacters(scene.characters),
    script_page_start: pageStart || chunkPageStart,
    script_page_end: pageEnd || pageStart || chunkPageStart,
  };
}

function normalizeIntExt(value: ExtractedScene["int_ext"] | undefined): ExtractedScene["int_ext"] {
  const normalized = String(value || "INT").toUpperCase();
  if (normalized === "EXT") return "EXT";
  if (
    normalized === "BOTH" ||
    normalized.includes("/") ||
    normalized === "I/E" ||
    normalized === "INT/EXT"
  ) {
    return "BOTH";
  }
  return "INT";
}

function normalizeTimeOfDay(value: string | undefined): string {
  const normalized = String(value || "").toUpperCase();
  const valid = [
    "DAY",
    "NIGHT",
    "DAWN",
    "DUSK",
    "MORNING",
    "AFTERNOON",
    "EVENING",
    "CONTINUOUS",
  ];
  const matched = valid.find((option) => normalized.includes(option));
  return matched || "DAY";
}

function normalizePageLengthEighths(value: number | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 1;
  }

  const normalized = Math.round(Number(value));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 1;
  }

  return Math.min(normalized, 64);
}

function normalizeCharacters(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((character) => String(character || "").trim().toUpperCase())
    .filter((character) => character.length > 0);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scriptId, fileName } = body as {
      scriptId?: string;
      fileName?: string;
    };

    if (!scriptId) {
      return NextResponse.json(
        { error: "scriptId is required" },
        { status: 400 }
      );
    }

    const { data: script, error: scriptError } = await supabase
      .from("Script")
      .select("id, fileUrl, fileName")
      .eq("id", scriptId)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404 }
      );
    }

    if (!script.fileUrl) {
      return NextResponse.json(
        { error: "Script file URL is missing" },
        { status: 400 }
      );
    }

    if (!isTrustedSupabaseStorageUrl(script.fileUrl)) {
      return NextResponse.json(
        { error: "Script file URL is not from trusted storage" },
        { status: 400 }
      );
    }

    const llmApiKey = getScriptAnalysisApiKey();
    if (!llmApiKey) {
      console.error("No script analysis LLM key configured");
      return NextResponse.json(
        { error: "Wrapshot Intelligence breakdown is not configured" },
        { status: 500 }
      );
    }

    // Update script status to IN_PROGRESS
    await supabase
      .from("Script")
      .update({
        breakdownStatus: "IN_PROGRESS",
        breakdownStartedAt: new Date().toISOString(),
      })
      .eq("id", script.id);

    // Fetch the script file
    let scriptBuffer: Buffer;
    try {
      const scriptResponse = await fetch(script.fileUrl);
      if (!scriptResponse.ok) {
        throw new Error(`Failed to fetch script file: ${scriptResponse.status}`);
      }
      const arrayBuffer = await scriptResponse.arrayBuffer();
      scriptBuffer = Buffer.from(arrayBuffer);
    } catch (fetchError) {
      console.error("Error fetching script file:", fetchError);
      await supabase
        .from("Script")
        .update({ breakdownStatus: "FAILED" })
        .eq("id", scriptId);
      return NextResponse.json(
        { error: "Failed to fetch script file" },
        { status: 500 }
      );
    }

    // Parse by file extension (PDF, FDX, Fountain, TXT)
    let scriptText: string;
    let pageCount: number;
    try {
      const parsed = await parseScript(
        scriptBuffer,
        fileName || script.fileName || script.fileUrl
      );
      scriptText = normalizeScriptText(parsed.text);
      pageCount = parsed.pageCount;
    } catch (parseError) {
      console.error("Error parsing script:", parseError);
      await supabase
        .from("Script")
        .update({ breakdownStatus: "FAILED" })
        .eq("id", scriptId);
      return NextResponse.json(
        { error: "Failed to parse script file" },
        { status: 500 }
      );
    }

    // Use Kimi to extract scenes in chunks so large scripts are fully processed.
    const kimi = new KimiClient();
    let breakdownResult: BreakdownResult;

    try {
      const orderedScenes = await extractScenesWithChunking(scriptText, scriptId, kimi);
      breakdownResult = {
        scenes: orderedScenes,
        total_pages: pageCount,
        total_scenes: orderedScenes.length,
      };
    } catch (aiError) {
      console.error("Error in Wrapshot Intelligence breakdown:", aiError);
      await supabase
        .from("Script")
        .update({ breakdownStatus: "FAILED" })
        .eq("id", scriptId);
      return NextResponse.json(
        { error: "Wrapshot Intelligence breakdown failed" },
        { status: 500 }
      );
    }

    // Update script with results
    await supabase
      .from("Script")
      .update({
        breakdownStatus: "COMPLETED",
        breakdownCompletedAt: new Date().toISOString(),
        parsedContent: breakdownResult,
      })
      .eq("id", scriptId);

    return NextResponse.json({
      success: true,
      data: breakdownResult,
      pageCount,
    });
  } catch (error) {
    console.error("Error in script breakdown:", error);
    return NextResponse.json(
      { error: "Failed to breakdown script" },
      { status: 500 }
    );
  }
}

// GET endpoint to check breakdown status
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get("scriptId");

    if (!scriptId) {
      return NextResponse.json(
        { error: "scriptId is required" },
        { status: 400 }
      );
    }

    const { data: script, error } = await supabase
      .from("Script")
      .select("id, breakdownStatus, breakdownStartedAt, breakdownCompletedAt, parsedContent")
      .eq("id", scriptId)
      .single();

    if (error || !script) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: script.breakdownStatus,
      startedAt: script.breakdownStartedAt,
      completedAt: script.breakdownCompletedAt,
      data: script.parsedContent,
    });
  } catch (error) {
    console.error("Error checking breakdown status:", error);
    return NextResponse.json(
      { error: "Failed to check breakdown status" },
      { status: 500 }
    );
  }
}
