/**
 * Synopsis Generator
 *
 * Generates or enhances synopses for scenes that are missing them.
 */

import { KimiClient } from '@/lib/ai/kimi-client';
import { getScriptAnalysisApiKey } from '@/lib/ai/config';
import { JsonParser } from '../utils/json-parser';
import { RetryHandler } from '../utils/retry-handler';
import { LLM_CONFIG } from '../constants';
import type { AgentContext, AgentStepResult, ExtractedScene } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

const SYNOPSIS_GENERATION_PROMPT = `You are a professional script supervisor writing scene synopses for a production breakdown sheet.

For each scene, write a concise 1-2 sentence synopsis that captures:
- The main action or event that occurs
- Key character interactions
- Any significant story beats

Keep synopses professional and factual - they should help production understand what happens in each scene.

Given the scene information, generate improved synopses.

Return a JSON object:
{
  "synopses": [
    {
      "sceneNumber": "1",
      "synopsis": "John discovers a mysterious letter on his doorstep and reads it with growing concern."
    }
  ]
}

Important:
- Keep synopses to 1-2 sentences
- Focus on action and story, not technical details
- Use present tense
- Return ONLY valid JSON`;

interface SynopsisResponse {
  synopses: Array<{
    sceneNumber: string;
    synopsis: string;
  }>;
}

export async function executeSynopsisGenerator(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  // Find scenes needing synopses
  const scenesNeedingSynopsis = context.extractedScenes.filter(
    scene => !scene.synopsis || scene.synopsis.trim().length < 10
  );

  if (scenesNeedingSynopsis.length === 0) {
    console.log('[SynopsisGenerator] All scenes already have synopses');
    return {
      success: true,
      data: { synopsesGenerated: 0 },
    };
  }

  const apiKey = getScriptAnalysisApiKey();
  if (!apiKey) {
    console.log('[SynopsisGenerator] No API key, skipping synopsis generation');
    return {
      success: true,
      data: { synopsesGenerated: 0, skipped: 'No API key' },
      shouldContinue: true,
    };
  }

  const kimi = new KimiClient();
  const retry = new RetryHandler();

  // Process in batches
  const batchSize = 15;
  const batches = batchScenes(scenesNeedingSynopsis, batchSize);
  const totalBatches = batches.length;
  let processedBatches = 0;
  let synopsesGenerated = 0;

  for (const batch of batches) {
    await tracker.updateProgress(
      processedBatches,
      totalBatches,
      `Generating synopses for scenes ${batch[0].sceneNumber} - ${batch[batch.length - 1].sceneNumber}`
    );

    try {
      const scenesText = formatScenesForSynopsis(batch);

      const response = await retry.execute(
        () => kimi.complete({
          messages: [
            { role: 'system', content: SYNOPSIS_GENERATION_PROMPT },
            {
              role: 'user',
              content: `Please generate synopses for these scenes:\n\n${scenesText}`,
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
          JsonParser.isObject(data) && 'synopses' in data && Array.isArray(data.synopses)
      );

      if (!parseResult.success) {
        console.error(`[SynopsisGenerator] Failed to parse response for batch ${processedBatches}`);
        processedBatches++;
        continue;
      }

      // Update scenes with new synopses
      for (const synopsisData of parseResult.data.synopses) {
        const scene = context.extractedScenes.find(
          s => s.sceneNumber === synopsisData.sceneNumber
        );
        if (scene && synopsisData.synopsis) {
          scene.synopsis = synopsisData.synopsis.trim();
          synopsesGenerated++;
        }
      }

      console.log(`[SynopsisGenerator] Generated ${parseResult.data.synopses.length} synopses for batch ${processedBatches + 1}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SynopsisGenerator] Error processing batch ${processedBatches}:`, errorMessage);
      // Continue with other batches
    }

    processedBatches++;
  }

  await tracker.updateProgress(totalBatches, totalBatches, `Generated ${synopsesGenerated} synopses`);

  console.log(`[SynopsisGenerator] Total: ${synopsesGenerated} synopses generated`);

  return {
    success: true,
    data: {
      synopsesGenerated,
      scenesProcessed: scenesNeedingSynopsis.length,
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
  return scenes.map(scene => {
    const header = `SCENE ${scene.sceneNumber} - ${scene.intExt}. ${scene.setName} - ${scene.timeOfDay}`;
    const chars = scene.characters.length > 0 ? `Characters: ${scene.characters.join(', ')}` : '';
    const pages = `Pages: ${scene.scriptPageStart} - ${scene.scriptPageEnd}`;
    const existingSynopsis = scene.synopsis ? `Current synopsis: ${scene.synopsis}` : '';
    return `${header}\n${chars}\n${pages}\n${existingSynopsis}`.trim();
  }).join('\n\n---\n\n');
}
