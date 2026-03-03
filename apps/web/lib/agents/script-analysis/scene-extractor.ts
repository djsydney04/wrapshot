/**
 * Scene Extractor
 *
 * Extracts scenes from script chunks using the LLM.
 */

import { KimiClient } from '@/lib/ai/kimi-client';
import { getScriptAnalysisApiKey } from '@/lib/ai/config';
import {
  adjustChunkLocalPage,
  dedupeBySceneNumberAndSet,
  normalizeSceneNumber,
  sortByScriptPageOrder,
} from '@/lib/scripts/scene-order';
import { extractHeuristicScenesFromChunkText } from '@/lib/scripts/scene-heuristics';
import { JsonParser } from '../utils/json-parser';
import { RetryHandler } from '../utils/retry-handler';
import { LLM_CONFIG } from '../constants';
import type { AgentContext, AgentStepResult, ExtractedScene, ScriptChunk, CharacterReference, LocationReference } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

const SCENE_EXTRACTION_PROMPT = `You are a professional script supervisor analyzing a film/TV script. Extract all scenes from the provided script text.

For each scene, extract:
- sceneNumber: The scene number as written (e.g., "1", "2A", "45")
- intExt: Either "INT" for interior, "EXT" for exterior, or "BOTH" for INT/EXT
- setName: The location/set name from the slugline (e.g., "JOHN'S APARTMENT - LIVING ROOM")
- timeOfDay: One of: DAY, NIGHT, DAWN, DUSK, MORNING, AFTERNOON, EVENING, CONTINUOUS
- pageLengthEighths: The scene length in 1/8ths of a page (1-8 for each full page)
- synopsis: A brief 1-2 sentence description of what happens in the scene
- characters: Array of character names who appear in the scene (speaking roles only, use uppercase)
- scriptPageStart: The starting page number
- scriptPageEnd: The ending page number

Return a JSON object with this structure:
{
  "scenes": [
    {
      "sceneNumber": "1",
      "intExt": "INT",
      "setName": "JOHN'S APARTMENT - LIVING ROOM",
      "timeOfDay": "DAY",
      "pageLengthEighths": 4,
      "synopsis": "John wakes up and discovers the mysterious letter.",
      "characters": ["JOHN", "MARY"],
      "scriptPageStart": 1,
      "scriptPageEnd": 1.5
    }
  ]
}

Important:
- Scene numbers should match exactly as written in the script
- If the script does not print scene numbers, assign sequential scene numbers in appearance order
- Include all scenes, even very short ones
- Preserve the same scene order as it appears in the script text
- For pageLengthEighths, estimate based on the text length (8 eighths = 1 full page)
- Only include characters who have dialogue or are specifically mentioned in action
- Use UPPERCASE for all character names
- Return ONLY valid JSON, no other text`;

interface SceneExtractionResponse {
  scenes: unknown[];
}

const PLACEHOLDER_SYNOPSIS_PATTERNS: RegExp[] = [
  /^auto[-\s]?detected from scene heading\.?$/i,
  /^no synopsis available\.?$/i,
  /^scene heading only\.?$/i,
  /^n\/a\.?$/i,
  /^tbd\.?$/i,
  /^unknown\.?$/i,
];

function isSceneExtractionResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'scenes' in obj && Array.isArray(obj.scenes);
}

export async function executeSceneExtractor(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  const apiKey = getScriptAnalysisApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'No script analysis LLM API key configured',
    };
  }

  const kimi = new KimiClient();
  const retry = new RetryHandler();
  const chunks = context.chunks || [];

  // If no chunks, use full script text as single chunk
  const chunksToProcess = chunks.length > 0
    ? chunks
    : [{
        id: 'single',
        chunkText: context.scriptText || '',
        chunkIndex: 0,
        processed: false,
      }] as Partial<ScriptChunk>[];

  const totalChunks = chunksToProcess.length;
  let processedChunks = 0;
  let allScenes: ExtractedScene[] = [];
  let failedChunks = 0;
  let parseFailures = 0;
  let usedSluglineFallback = false;

  console.log(
    `[SceneExtractor] Using provider=${kimi.getActiveProvider()} model=${kimi.getActiveModel()} for ${totalChunks} chunks`
  );

  for (const chunk of chunksToProcess) {
    if (chunk.processed) {
      processedChunks++;
      continue;
    }

    const chunkFallbackScenes = buildHeuristicScenesForChunk(chunk, context.lastSceneNumber);

    await tracker.updateProgress(
      processedChunks,
      totalChunks,
      `Processing chunk ${chunk.chunkIndex! + 1} of ${totalChunks}`
    );

    try {
      // Build context from previous chunks
      const knownCharactersStr = context.knownCharacters.length > 0
        ? `\n\nKnown characters from previous scenes: ${context.knownCharacters.map(c => c.name).join(', ')}`
        : '';

      const lastSceneStr = context.lastSceneNumber > 0
        ? `\n\nThe last scene number processed was: ${context.lastSceneNumber}`
        : '';

      const response = await retry.execute(
        () => kimi.complete({
          messages: [
            { role: 'system', content: SCENE_EXTRACTION_PROMPT },
            {
              role: 'user',
              content: `Please analyze this screenplay section and extract all scenes:${knownCharactersStr}${lastSceneStr}\n\n${chunk.chunkText}`,
            },
          ],
          maxTokens: estimateSceneExtractionMaxTokens(chunk),
          temperature: LLM_CONFIG.TEMPERATURE_EXTRACTION,
        }),
        `SceneExtraction-chunk-${chunk.chunkIndex}`
      );

      const parseResult = JsonParser.parseWithValidation<SceneExtractionResponse>(
        response,
        isSceneExtractionResponse
      );
      const chunkPageStart = typeof chunk.pageStart === 'number' ? chunk.pageStart : 1;
      let scenesToApply: ExtractedScene[] = [];

      if (!parseResult.success) {
        parseFailures++;
        console.error(
          `[SceneExtractor] Failed to parse response for chunk ${chunk.chunkIndex}:`,
          parseResult.error
        );

        if (chunkFallbackScenes.length > 0) {
          scenesToApply = chunkFallbackScenes;
          usedSluglineFallback = true;
        } else {
          processedChunks++;
          continue;
        }
      } else {
        const llmScenes = parseResult.data.scenes;
        const normalizedLlmScenes = llmScenes
          .map((scene, index) =>
            normalizeExtractedSceneForChunk(scene, chunkPageStart, allScenes.length + index + 1)
          )
          .filter((scene): scene is ExtractedScene => scene !== null);

        const llmScenesWithSource = attachHeuristicSourceText(normalizedLlmScenes, chunkFallbackScenes);

        if (llmScenesWithSource.length === 0 && chunkFallbackScenes.length > 0) {
          scenesToApply = chunkFallbackScenes;
          usedSluglineFallback = true;
        } else if (shouldSupplementWithHeuristicScenes(llmScenesWithSource, chunkFallbackScenes)) {
          scenesToApply = mergeScenesWithHeuristicFallback(llmScenesWithSource, chunkFallbackScenes);
          usedSluglineFallback = scenesToApply.length > llmScenesWithSource.length || usedSluglineFallback;
        } else {
          scenesToApply = llmScenesWithSource;
        }
      }

      for (const scene of scenesToApply) {
        applySceneToContext(scene, context.knownCharacters, context.knownLocations, context);
        allScenes.push(scene);
      }

      console.log(
        `[SceneExtractor] Extracted ${scenesToApply.length} scenes from chunk ${chunk.chunkIndex}` +
          (scenesToApply === chunkFallbackScenes ? ' (heuristic fallback)' : '')
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SceneExtractor] Error processing chunk ${chunk.chunkIndex}:`, errorMessage);
      failedChunks++;

      if (chunkFallbackScenes.length > 0) {
        for (const scene of chunkFallbackScenes) {
          applySceneToContext(scene, context.knownCharacters, context.knownLocations, context);
          allScenes.push(scene);
        }
        usedSluglineFallback = true;
      }
      // Continue with other chunks - partial failure is acceptable
    }

    processedChunks++;
  }

  if (allScenes.length === 0) {
    return {
      success: false,
      error: 'No scenes could be extracted from the script',
      errorDetails: {
        chunksProcessed: processedChunks,
        totalChunks,
        failedChunks,
        parseFailures,
      },
    };
  }

  const orderedScenes = sortByScriptPageOrder(allScenes, (scene) => scene.scriptPageStart);
  const dedupedScenes = dedupeBySceneNumberAndSet(
    orderedScenes,
    (scene) => scene.sceneNumber,
    (scene) => scene.setName
  );

  context.extractedScenes = dedupedScenes;
  context.sceneWarnings = dedupedScenes
    .filter((scene) => (scene.warnings?.length || 0) > 0 || (scene.confidence || 0) < 0.6)
    .map((scene) => ({
      sceneNumber: scene.sceneNumber,
      warnings: scene.warnings || [],
      confidence: scene.confidence || 0,
    }));

  await tracker.updateProgress(totalChunks, totalChunks, `Extracted ${dedupedScenes.length} scenes`);

  console.log(
    `[SceneExtractor] Total: ${dedupedScenes.length} scenes, ${context.knownCharacters.length} characters` +
      (usedSluglineFallback ? ' (slugline fallback)' : ''),
  );

  return {
    success: true,
    data: {
      scenesExtracted: dedupedScenes.length,
      charactersFound: context.knownCharacters.length,
      locationsFound: context.knownLocations.length,
      failedChunks,
      parseFailures,
      usedSluglineFallback,
      lowConfidenceScenes: context.sceneWarnings.length,
    },
  };
}

function estimateSceneExtractionMaxTokens(chunk: Partial<ScriptChunk>): number {
  const estimatedScenes = typeof chunk.sceneCount === 'number' ? Math.max(chunk.sceneCount, 1) : 8;
  const targetBySceneDensity = estimatedScenes * 180;

  return Math.max(
    1200,
    Math.min(LLM_CONFIG.MAX_TOKENS_SCENE_EXTRACTION, targetBySceneDensity)
  );
}

function normalizeIntExt(value: string): 'INT' | 'EXT' | 'BOTH' {
  const upper = String(value).toUpperCase().trim();
  if (upper.includes('/') || upper === 'BOTH' || upper === 'I/E') {
    return 'BOTH';
  }
  if (upper.startsWith('EXT')) {
    return 'EXT';
  }
  return 'INT';
}

function normalizeTimeOfDay(value: string): string {
  const upper = String(value).toUpperCase().trim();
  const validTimes = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'AFTERNOON', 'EVENING', 'CONTINUOUS'];

  for (const time of validTimes) {
    if (upper.includes(time)) {
      return time;
    }
  }

  return 'DAY'; // Default
}

function updateKnownLocations(locations: LocationReference[], scene: ExtractedScene): void {
  const existing = locations.find(
    l => l.name === scene.setName || l.aliases.includes(scene.setName)
  );

  if (existing) {
    existing.sceneCount++;
    // Update intExt if different
    if (existing.intExt !== scene.intExt && existing.intExt !== 'BOTH') {
      existing.intExt = 'BOTH';
    }
  } else {
    locations.push({
      name: scene.setName,
      intExt: scene.intExt,
      aliases: [],
      sceneCount: 1,
    });
  }
}

export function normalizeExtractedSceneForChunk(
  scene: unknown,
  chunkPageStart: number,
  fallbackSceneNumber: number
): ExtractedScene | null {
  const setName = getSceneStringField(scene, ['setName', 'set_name', 'location', 'sceneHeading']);
  if (!setName) {
    return null;
  }

  const rawCharacters = getSceneArrayField(scene, ['characters', 'characterNames', 'character_names']);
  const rawSynopsis = getSceneStringField(scene, ['synopsis', 'summary', 'description']) || '';
  const sanitizedSynopsis = sanitizeSceneSynopsis(rawSynopsis);
  const sourceText = getSceneStringField(scene, ['sourceText', 'source_text', 'sceneText', 'scene_text']);

  const warnings: string[] = [];
  if (!sanitizedSynopsis) {
    warnings.push('missing_synopsis');
  }
  if (rawCharacters.length === 0) {
    warnings.push('missing_characters');
  }

  const normalized: ExtractedScene = {
    sceneNumber: normalizeSceneNumber(
      getSceneStringField(scene, ['sceneNumber', 'scene_number']),
      fallbackSceneNumber
    ),
    intExt: normalizeIntExt(getSceneStringField(scene, ['intExt', 'int_ext']) || 'INT'),
    setName: setName.trim(),
    timeOfDay: normalizeTimeOfDay(getSceneStringField(scene, ['timeOfDay', 'time_of_day']) || 'DAY'),
    pageLengthEighths: normalizePageLengthEighths(getSceneNumberField(scene, ['pageLengthEighths', 'page_length_eighths'])),
    synopsis: sanitizedSynopsis,
    characters: rawCharacters
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.toUpperCase().trim()),
    scriptPageStart: chunkPageStart,
    scriptPageEnd: chunkPageStart,
    sourceText: sourceText || undefined,
    warnings,
    confidence: calculateSceneConfidence({
      synopsis: sanitizedSynopsis,
      characters: rawCharacters,
      sourceText,
      warnings,
    }),
  };

  const adjustedPageStart = adjustChunkLocalPage(
    getSceneNumberField(scene, ['scriptPageStart', 'script_page_start']),
    chunkPageStart
  );
  const adjustedPageEnd = adjustChunkLocalPage(
    getSceneNumberField(scene, ['scriptPageEnd', 'script_page_end']),
    chunkPageStart
  );
  normalized.scriptPageStart = adjustedPageStart || chunkPageStart;
  normalized.scriptPageEnd =
    (adjustedPageEnd && adjustedPageStart
      ? Math.max(adjustedPageStart, adjustedPageEnd)
      : adjustedPageEnd) || normalized.scriptPageStart;

  return normalized;
}

type SceneConfidenceInput = {
  synopsis: string;
  characters: string[];
  sourceText?: string;
  warnings: string[];
};

function calculateSceneConfidence(input: SceneConfidenceInput): number {
  let score = 0.55;
  if (input.synopsis.length >= 24) score += 0.2;
  if (input.characters.length > 0) score += 0.15;
  if (input.characters.length >= 2) score += 0.05;
  if ((input.sourceText || '').length >= 120) score += 0.08;
  if (input.warnings.includes('missing_synopsis')) score -= 0.15;
  if (input.warnings.includes('missing_characters')) score -= 0.12;
  return clamp(score, 0.1, 0.98);
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

function getSceneRecord(scene: unknown): Record<string, unknown> {
  if (!scene || typeof scene !== 'object') {
    return {};
  }
  return scene as Record<string, unknown>;
}

function getSceneStringField(scene: unknown, keys: string[]): string {
  const record = getSceneRecord(scene);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function getSceneNumberField(scene: unknown, keys: string[]): number | undefined {
  const record = getSceneRecord(scene);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function getSceneArrayField(scene: unknown, keys: string[]): string[] {
  const record = getSceneRecord(scene);
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0);
    }
  }
  return [];
}

function sanitizeSceneSynopsis(value: string): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  if (PLACEHOLDER_SYNOPSIS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return '';
  }
  return normalized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildHeuristicScenesForChunk(
  chunk: Partial<ScriptChunk>,
  startingSceneNumber: number
): ExtractedScene[] {
  const chunkText = typeof chunk.chunkText === 'string' ? chunk.chunkText : '';
  if (!chunkText.trim()) {
    return [];
  }

  const scenes = extractHeuristicScenesFromChunkText(chunkText, {
    chunkPageStart: typeof chunk.pageStart === 'number' ? chunk.pageStart : 1,
    chunkPageEnd: typeof chunk.pageEnd === 'number' ? chunk.pageEnd : undefined,
    startingSceneNumber,
  });

  return scenes.map((scene) => ({
    ...scene,
    sceneNumber: normalizeSceneNumber(scene.sceneNumber, startingSceneNumber + 1),
    synopsis: sanitizeSceneSynopsis(scene.synopsis),
    confidence: 0.35,
    warnings: ['heuristic_fallback', 'missing_synopsis'],
    sourceText: scene.sourceText || undefined,
  }));
}

function mergeScenesWithHeuristicFallback(
  primaryScenes: ExtractedScene[],
  heuristicScenes: ExtractedScene[]
): ExtractedScene[] {
  if (heuristicScenes.length === 0) {
    return primaryScenes;
  }

  const merged = [...primaryScenes];
  const seen = new Set(
    merged.map((scene) => makeSceneKey(scene.sceneNumber, scene.setName))
  );

  for (const scene of heuristicScenes) {
    const key = makeSceneKey(scene.sceneNumber, scene.setName);
    if (!seen.has(key)) {
      merged.push(scene);
      seen.add(key);
    }
  }

  return merged;
}

function attachHeuristicSourceText(
  primaryScenes: ExtractedScene[],
  heuristicScenes: ExtractedScene[]
): ExtractedScene[] {
  if (primaryScenes.length === 0 || heuristicScenes.length === 0) {
    return primaryScenes;
  }

  const heuristicMap = new Map(
    heuristicScenes.map((scene) => [makeSceneKey(scene.sceneNumber, scene.setName), scene])
  );

  return primaryScenes.map((scene) => {
    const match = heuristicMap.get(makeSceneKey(scene.sceneNumber, scene.setName));
    const warnings = new Set(scene.warnings || []);

    if (!scene.sourceText && match?.sourceText) {
      scene.sourceText = match.sourceText;
    }

    if (!scene.synopsis) {
      warnings.add('missing_synopsis');
    }

    if (scene.characters.length === 0 && (match?.characters.length || 0) > 0) {
      scene.characters = match?.characters || [];
      warnings.add('characters_from_heuristic');
      scene.confidence = clamp((scene.confidence || 0.6) - 0.08, 0.1, 0.98);
    }

    scene.warnings = Array.from(warnings);
    return scene;
  });
}

function shouldSupplementWithHeuristicScenes(
  primaryScenes: ExtractedScene[],
  heuristicScenes: ExtractedScene[]
): boolean {
  if (primaryScenes.length === 0 || heuristicScenes.length === 0) {
    return false;
  }

  if (heuristicScenes.length < 3) {
    return false;
  }

  const coverageRatio = primaryScenes.length / heuristicScenes.length;
  return coverageRatio < 0.55;
}

function makeSceneKey(sceneNumber: string, setName: string): string {
  return `${normalizeSceneNumber(sceneNumber, 0).toUpperCase()}::${String(setName).trim().toUpperCase()}`;
}

function applySceneToContext(
  scene: ExtractedScene,
  knownCharacters: CharacterReference[],
  knownLocations: LocationReference[],
  context: AgentContext
): void {
  for (const charName of scene.characters) {
    const existing = knownCharacters.find(
      (character) => character.name === charName || character.aliases.includes(charName)
    );
    if (existing) {
      existing.sceneCount++;
    } else {
      knownCharacters.push({
        name: charName,
        aliases: [],
        firstAppearance: parseInt(scene.sceneNumber, 10) || context.lastSceneNumber + 1,
        sceneCount: 1,
      });
    }
  }

  updateKnownLocations(knownLocations, scene);

  const sceneNum = parseInt(scene.sceneNumber, 10);
  if (!Number.isNaN(sceneNum) && sceneNum > context.lastSceneNumber) {
    context.lastSceneNumber = sceneNum;
  }
}
