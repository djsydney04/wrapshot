/**
 * Synopsis Generator
 *
 * Generates or enhances synopses for scenes that are missing them.
 */

import { KimiClient } from '@/lib/ai/kimi-client';
import { getScriptAnalysisApiKey } from '@/lib/ai/config';
import { extractCharacterCuesFromSceneText } from '@/lib/scripts/scene-heuristics';
import { JsonParser } from '../utils/json-parser';
import { RetryHandler } from '../utils/retry-handler';
import { LLM_CONFIG } from '../constants';
import type { AgentContext, AgentStepResult, ExtractedScene } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

const SCENE_ENRICHMENT_PROMPT = `You are a professional script supervisor completing missing breakdown fields.

For each scene, fill missing values using only the provided scene text and heading context:
- synopsis: concise 1-2 sentence summary of what happens
- characters: speaking or clearly present characters, uppercase names
- confidence: numeric 0.0-1.0 for this update quality
- evidence: brief quote or phrase from scene text that supports the update

Return a JSON object:
{
  "scenes": [
    {
      "sceneNumber": "12A",
      "synopsis": "Maya confronts Jonah in the warehouse and demands the key.",
      "characters": ["MAYA", "JONAH"],
      "confidence": 0.87,
      "evidence": "MAYA: Give me the key."
    }
  ]
}

Important:
- Do NOT invent details not supported by scene text
- Keep synopsis factual and present tense
- If uncertain, return lower confidence and omit weak character guesses
- Return ONLY valid JSON`;

interface SynopsisResponse {
  scenes?: Array<{
    sceneNumber: string;
    synopsis?: string;
    characters?: string[];
    confidence?: number;
    evidence?: string;
  }>;
  synopses?: Array<{
    sceneNumber: string;
    synopsis: string;
  }>;
}

type SynopsisSceneContext = Pick<
  ExtractedScene,
  'synopsis' | 'setName' | 'timeOfDay' | 'intExt' | 'characters' | 'sourceText' | 'warnings'
>;

const PLACEHOLDER_SYNOPSIS_PATTERNS: RegExp[] = [
  /^auto[-\s]?detected from scene heading\.?$/i,
  /^no synopsis available\.?$/i,
  /^scene heading only\.?$/i,
  /^n\/a\.?$/i,
  /^tbd\.?$/i,
  /^unknown\.?$/i,
];

export async function executeSynopsisGenerator(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  // Find scenes needing enrichment (synopsis and/or characters)
  const scenesNeedingEnrichment = context.extractedScenes.filter(
    (scene) => shouldRegenerateSceneSynopsis(scene) || scene.characters.length === 0
  );

  if (scenesNeedingEnrichment.length === 0) {
    console.log('[SynopsisGenerator] All scenes already have synopsis/character coverage');
    return {
      success: true,
      data: { synopsesGenerated: 0, charactersCompleted: 0 },
    };
  }

  const apiKey = getScriptAnalysisApiKey();
  if (!apiKey) {
    console.log('[SynopsisGenerator] No API key, skipping synopsis generation');
    const deterministicResult = applyDeterministicSceneCompletion(scenesNeedingEnrichment);
    return {
      success: true,
      data: {
        synopsesGenerated: deterministicResult.synopsesGenerated,
        charactersCompleted: deterministicResult.charactersCompleted,
        skipped: 'No API key',
      },
      shouldContinue: true,
    };
  }

  const kimi = new KimiClient();
  const retry = new RetryHandler();

  // Process in batches
  const batchSize = 15;
  const batches = batchScenes(scenesNeedingEnrichment, batchSize);
  const totalBatches = batches.length;
  let processedBatches = 0;
  let synopsesGenerated = 0;
  let charactersCompleted = 0;

  for (const batch of batches) {
    await tracker.updateProgress(
      processedBatches,
      totalBatches,
      `Completing scene fields ${batch[0].sceneNumber} - ${batch[batch.length - 1].sceneNumber}`
    );

    try {
      const scenesText = formatScenesForSynopsis(batch);

      const response = await retry.execute(
        () => kimi.complete({
          messages: [
            { role: 'system', content: SCENE_ENRICHMENT_PROMPT },
            {
              role: 'user',
              content: `Complete missing synopsis/character fields for these scenes:\n\n${scenesText}`,
            },
          ],
          maxTokens: LLM_CONFIG.MAX_TOKENS_SYNOPSIS,
          temperature: LLM_CONFIG.TEMPERATURE_SYNOPSIS,
        }),
        `SynopsisGeneration-batch-${processedBatches}`
      );

      const parseResult = JsonParser.parseWithValidation<SynopsisResponse>(
        response,
        (data): data is SynopsisResponse =>
          JsonParser.isObject(data) &&
          (
            ('scenes' in data && Array.isArray(data.scenes)) ||
            ('synopses' in data && Array.isArray(data.synopses))
          )
      );

      if (!parseResult.success) {
        console.error(`[SynopsisGenerator] Failed to parse response for batch ${processedBatches}`);
        const deterministicResult = applyDeterministicSceneCompletion(batch);
        synopsesGenerated += deterministicResult.synopsesGenerated;
        charactersCompleted += deterministicResult.charactersCompleted;
        processedBatches++;
        continue;
      }

      const updates = normalizeSynopsisUpdates(parseResult.data);
      if (updates.length === 0) {
        const deterministicResult = applyDeterministicSceneCompletion(batch);
        synopsesGenerated += deterministicResult.synopsesGenerated;
        charactersCompleted += deterministicResult.charactersCompleted;
      }

      // Update scenes with enriched fields
      for (const updateData of updates) {
        const scene = context.extractedScenes.find(
          (s) => s.sceneNumber === updateData.sceneNumber
        );
        if (!scene) continue;

        if (updateData.synopsis) {
          const normalizedSynopsis = normalizeGeneratedSynopsis(updateData.synopsis, scene);
          if (normalizedSynopsis && normalizedSynopsis !== scene.synopsis) {
            scene.synopsis = normalizedSynopsis;
            synopsesGenerated++;
          }
        }

        const beforeCount = scene.characters.length;
        const mergedCharacters = mergeCharacters(scene.characters, updateData.characters || []);
        if (mergedCharacters.length > beforeCount) {
          scene.characters = mergedCharacters;
          charactersCompleted += mergedCharacters.length - beforeCount;
        }

        if ((updateData.evidence || '').trim()) {
          scene.analysisEvidence = [
            ...(scene.analysisEvidence || []),
            updateData.evidence!.trim(),
          ].slice(0, 5);
        }

        if (typeof updateData.confidence === 'number' && Number.isFinite(updateData.confidence)) {
          const currentConfidence = scene.confidence ?? 0.5;
          scene.confidence = Math.max(currentConfidence, clamp(updateData.confidence, 0.1, 0.99));
        }

        scene.warnings = (scene.warnings || []).filter(
          (warning) => warning !== 'missing_synopsis' && warning !== 'missing_characters'
        );
        if (!scene.synopsis || scene.synopsis.length < 12) {
          scene.warnings.push('missing_synopsis');
        }
        if (scene.characters.length === 0) {
          scene.warnings.push('missing_characters');
        }
        scene.warnings = Array.from(new Set(scene.warnings));
      }

      console.log(`[SynopsisGenerator] Completed ${updates.length} scene updates for batch ${processedBatches + 1}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SynopsisGenerator] Error processing batch ${processedBatches}:`, errorMessage);
      const deterministicResult = applyDeterministicSceneCompletion(batch);
      synopsesGenerated += deterministicResult.synopsesGenerated;
      charactersCompleted += deterministicResult.charactersCompleted;
      // Continue with other batches
    }

    processedBatches++;
  }

  await tracker.updateProgress(
    totalBatches,
    totalBatches,
    `Completed ${synopsesGenerated} synopses + ${charactersCompleted} character fills`
  );

  console.log(`[SynopsisGenerator] Total: ${synopsesGenerated} synopses generated, ${charactersCompleted} character fills`);

  return {
    success: true,
    data: {
      synopsesGenerated,
      charactersCompleted,
      scenesProcessed: scenesNeedingEnrichment.length,
    },
  };
}

function batchScenes(scenes: ExtractedScene[], batchSize: number): ExtractedScene[][] {
  const batches: ExtractedScene[][] = [];
  for (let i = 0; i < scenes.length; i += batchSize) {
    batches.push(scenes.slice(i, i + batchSize));
  }
  return batches;
}

function formatScenesForSynopsis(scenes: ExtractedScene[]): string {
  return scenes.map((scene) => {
    const header = `SCENE ${scene.sceneNumber} - ${scene.intExt}. ${scene.setName} - ${scene.timeOfDay}`;
    const chars = scene.characters.length > 0 ? `Characters: ${scene.characters.join(', ')}` : '';
    const pages = `Pages: ${scene.scriptPageStart} - ${scene.scriptPageEnd}`;
    const sourceText = scene.sourceText
      ? `Scene text:\n${scene.sourceText.slice(0, 1200)}`
      : '';
    const existingSynopsis =
      scene.synopsis && !isPlaceholderSynopsis(scene.synopsis)
        ? `Current synopsis: ${scene.synopsis}`
        : '';
    return `${header}\n${chars}\n${pages}\n${sourceText}\n${existingSynopsis}`.trim();
  }).join('\n\n---\n\n');
}

function normalizeSynopsisUpdates(response: SynopsisResponse): Array<{
  sceneNumber: string;
  synopsis?: string;
  characters?: string[];
  confidence?: number;
  evidence?: string;
}> {
  if (Array.isArray(response.scenes)) {
    return response.scenes
      .map((scene) => ({
        sceneNumber: String(scene.sceneNumber || '').trim(),
        synopsis: typeof scene.synopsis === 'string' ? scene.synopsis : undefined,
        characters: Array.isArray(scene.characters)
          ? scene.characters.map((character) => String(character || '').trim()).filter(Boolean)
          : undefined,
        confidence: typeof scene.confidence === 'number' ? scene.confidence : undefined,
        evidence: typeof scene.evidence === 'string' ? scene.evidence : undefined,
      }))
      .filter((scene) => scene.sceneNumber.length > 0);
  }

  if (Array.isArray(response.synopses)) {
    return response.synopses
      .map((scene) => ({
        sceneNumber: String(scene.sceneNumber || '').trim(),
        synopsis: typeof scene.synopsis === 'string' ? scene.synopsis : undefined,
      }))
      .filter((scene) => scene.sceneNumber.length > 0);
  }

  return [];
}

function applyDeterministicSceneCompletion(scenes: ExtractedScene[]): {
  synopsesGenerated: number;
  charactersCompleted: number;
} {
  let synopsesGenerated = 0;
  let charactersCompleted = 0;

  for (const scene of scenes) {
    if (scene.characters.length === 0 && scene.sourceText) {
      const inferredCharacters = extractCharacterCuesFromSceneText(scene.sourceText);
      if (inferredCharacters.length > 0) {
        const beforeCount = scene.characters.length;
        scene.characters = mergeCharacters(scene.characters, inferredCharacters);
        charactersCompleted += scene.characters.length - beforeCount;
      }
    }

    if (shouldRegenerateSceneSynopsis(scene) && scene.sourceText) {
      const inferredSynopsis = buildDeterministicSynopsis(scene.sourceText);
      if (inferredSynopsis) {
        scene.synopsis = inferredSynopsis;
        synopsesGenerated++;
      }
    }

    scene.warnings = (scene.warnings || []).filter(
      (warning) => warning !== 'missing_synopsis' && warning !== 'missing_characters'
    );
    if (!scene.synopsis || scene.synopsis.length < 12) {
      scene.warnings.push('missing_synopsis');
    }
    if (scene.characters.length === 0) {
      scene.warnings.push('missing_characters');
    }
    scene.warnings = Array.from(new Set(scene.warnings));
  }

  return { synopsesGenerated, charactersCompleted };
}

function mergeCharacters(existing: string[], incoming: string[]): string[] {
  const merged = new Set(existing.map((character) => normalizeCharacterName(character)));
  for (const character of incoming) {
    const normalized = normalizeCharacterName(character);
    if (normalized) {
      merged.add(normalized);
    }
  }
  return Array.from(merged);
}

function normalizeCharacterName(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[^A-Z0-9 '\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDeterministicSynopsis(sourceText: string): string {
  const cleaned = String(sourceText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line, index) => !(index === 0 && /^(?:\d+[A-Z]?\s+)?(?:INT|EXT|I\/E|INT\/EXT|EXT\/INT)\b/i.test(line)))
    .filter((line) => !/^[A-Z0-9 .'\-()]{2,40}$/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [];
  const summary = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20)
    .slice(0, 2)
    .join(' ')
    .trim();

  if (!summary || summary.length < 20) {
    return '';
  }

  return /[.!?]$/.test(summary) ? summary : `${summary}.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shouldRegenerateSceneSynopsis(scene: SynopsisSceneContext): boolean {
  const normalized = normalizeSynopsisText(scene.synopsis);
  if (!normalized || normalized.length < 12) {
    return true;
  }

  return isPlaceholderSynopsis(normalized);
}

export function normalizeGeneratedSynopsis(
  generatedSynopsis: string,
  scene: SynopsisSceneContext
): string {
  const normalizedInput = normalizeSynopsisText(generatedSynopsis)
    .replace(/^(?:synopsis|summary)\s*[:\-]\s*/i, '')
    .replace(/^scene\s+[a-z0-9.-]+\s*[:\-]\s*/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  const sentences = splitIntoSentences(normalizedInput).slice(0, 2);
  let cleaned = sentences.join(' ').trim();

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned = `${cleaned}.`;
  }

  if (!cleaned || cleaned.length < 12 || isPlaceholderSynopsis(cleaned)) {
    return '';
  }

  return cleaned;
}

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]?/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((sentence) => normalizeSynopsisText(sentence))
    .filter((sentence) => sentence.length > 0);
}

function normalizeSynopsisText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isPlaceholderSynopsis(value: string): boolean {
  const normalized = normalizeSynopsisText(value);
  if (!normalized) {
    return true;
  }

  return PLACEHOLDER_SYNOPSIS_PATTERNS.some((pattern) => pattern.test(normalized));
}
