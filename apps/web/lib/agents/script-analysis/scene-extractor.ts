/**
 * Scene Extractor
 *
 * Extracts scenes from script chunks using the LLM.
 */

import { KimiClient } from '@/lib/ai/kimi-client';
import { getScriptAnalysisApiKey } from '@/lib/ai/config';
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
- Include all scenes, even very short ones
- For pageLengthEighths, estimate based on the text length (8 eighths = 1 full page)
- Only include characters who have dialogue or are specifically mentioned in action
- Use UPPERCASE for all character names
- Return ONLY valid JSON, no other text`;

interface SceneExtractionResponse {
  scenes: ExtractedScene[];
}

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

  const kimi = new KimiClient(apiKey);
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

  for (const chunk of chunksToProcess) {
    if (chunk.processed) {
      processedChunks++;
      continue;
    }

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
          maxTokens: LLM_CONFIG.MAX_TOKENS_SCENE_EXTRACTION,
          temperature: LLM_CONFIG.TEMPERATURE_EXTRACTION,
        }),
        `SceneExtraction-chunk-${chunk.chunkIndex}`
      );

      const parseResult = JsonParser.parseWithValidation<SceneExtractionResponse>(
        response,
        isSceneExtractionResponse
      );

      if (!parseResult.success) {
        console.error(`[SceneExtractor] Failed to parse response for chunk ${chunk.chunkIndex}:`, parseResult.error);
        // Continue with partial results
        processedChunks++;
        continue;
      }

      const chunkScenes = parseResult.data.scenes;

      // Normalize and validate scenes
      for (const scene of chunkScenes) {
        // Ensure required fields
        if (!scene.sceneNumber || !scene.setName) {
          continue;
        }

        // Normalize intExt
        scene.intExt = normalizeIntExt(scene.intExt);

        // Normalize timeOfDay
        scene.timeOfDay = normalizeTimeOfDay(scene.timeOfDay);

        // Normalize characters to uppercase, filtering out nulls/empties
        scene.characters = (scene.characters || [])
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          .map(c => c.toUpperCase().trim());

        // Update known characters
        for (const charName of scene.characters) {
          const existing = context.knownCharacters.find(
            c => c.name === charName || c.aliases.includes(charName)
          );
          if (existing) {
            existing.sceneCount++;
          } else {
            context.knownCharacters.push({
              name: charName,
              aliases: [],
              firstAppearance: parseInt(scene.sceneNumber) || context.lastSceneNumber + 1,
              sceneCount: 1,
            });
          }
        }

        // Update known locations
        updateKnownLocations(context.knownLocations, scene);

        // Update last scene number
        const sceneNum = parseInt(scene.sceneNumber);
        if (!isNaN(sceneNum) && sceneNum > context.lastSceneNumber) {
          context.lastSceneNumber = sceneNum;
        }

        allScenes.push(scene);
      }

      console.log(`[SceneExtractor] Extracted ${chunkScenes.length} scenes from chunk ${chunk.chunkIndex}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SceneExtractor] Error processing chunk ${chunk.chunkIndex}:`, errorMessage);
      // Continue with other chunks - partial failure is acceptable
    }

    processedChunks++;
  }

  if (allScenes.length === 0) {
    return {
      success: false,
      error: 'No scenes could be extracted from the script',
      errorDetails: { chunksProcessed: processedChunks, totalChunks },
    };
  }

  // Sort scenes by scene number
  allScenes.sort((a, b) => {
    const aNum = parseSceneNumber(a.sceneNumber);
    const bNum = parseSceneNumber(b.sceneNumber);
    return aNum - bNum;
  });

  // Remove duplicates (same scene number)
  allScenes = deduplicateScenes(allScenes);

  context.extractedScenes = allScenes;

  await tracker.updateProgress(totalChunks, totalChunks, `Extracted ${allScenes.length} scenes`);

  console.log(`[SceneExtractor] Total: ${allScenes.length} scenes, ${context.knownCharacters.length} characters`);

  return {
    success: true,
    data: {
      scenesExtracted: allScenes.length,
      charactersFound: context.knownCharacters.length,
      locationsFound: context.knownLocations.length,
    },
  };
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

function parseSceneNumber(sceneNumber: string): number {
  // Handle scene numbers like "1", "2A", "45B", "10.1"
  const match = sceneNumber.match(/^(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  return 0;
}

function deduplicateScenes(scenes: ExtractedScene[]): ExtractedScene[] {
  const seen = new Set<string>();
  return scenes.filter(scene => {
    const key = `${scene.sceneNumber}-${scene.setName}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
