/**
 * Element Extractor
 *
 * Extracts production elements from scenes using the LLM.
 */

import { KimiClient } from '@/lib/ai/kimi-client';
import { getFireworksApiKey } from '@/lib/ai/config';
import { JsonParser } from '../utils/json-parser';
import { RetryHandler } from '../utils/retry-handler';
import { LLM_CONFIG } from '../constants';
import type { AgentContext, AgentStepResult, ExtractedElement, ExtractedScene, ElementCategory } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

const ELEMENT_EXTRACTION_PROMPT = `You are a professional assistant director breaking down script scenes for production. Analyze the provided scenes and extract all production elements.

Extract elements into these categories:
- PROP: Props used or mentioned (objects characters interact with)
- WARDROBE: Specific costume requirements
- VEHICLE: Vehicles mentioned or needed
- ANIMAL: Any animals
- VFX: Visual effects shots needed
- SFX: Practical special effects (explosions, fire, rain, smoke)
- STUNT: Stunt requirements
- MAKEUP: Special makeup requirements (wounds, aging, prosthetics)
- HAIR: Special hair requirements (wigs, period styles)
- CAMERA: Special camera equipment or shots (crane, steadicam, underwater)
- GRIP: Grip/rigging requirements
- ELECTRIC: Special lighting requirements
- SET_DRESSING: Set decoration elements
- SOUND: Special sound requirements (playback, effects)
- MUSIC: Music cues or requirements
- GREENERY: Plants/landscaping
- BACKGROUND: Background actors/extras needed
- MECHANICAL_EFFECTS: Mechanical effects (rain machines, wind, breakaways)
- VIDEO_PLAYBACK: Screens/monitors needing playback
- SPECIAL_EQUIPMENT: Other special equipment
- SAFETY_NOTES: Safety considerations
- LOCATION_NOTES: Location requirements

For each element, provide:
- category: One of the categories above
- name: Short descriptive name
- description: Optional additional details
- sceneNumbers: Array of scene numbers where this element appears

Return a JSON object:
{
  "elements": [
    {
      "category": "PROP",
      "name": "Mysterious letter",
      "description": "Period-appropriate envelope with wax seal",
      "sceneNumbers": ["1", "5", "12"]
    },
    {
      "category": "WARDROBE",
      "name": "John's pajamas",
      "description": "Worn, comfortable look",
      "sceneNumbers": ["1"]
    }
  ]
}

Important:
- Be thorough - every prop, costume piece, and effect matters for production
- Include implied elements (e.g., if someone "pours coffee", include coffee pot, mug, coffee)
- Consolidate similar items across scenes (one entry with multiple sceneNumbers)
- Return ONLY valid JSON, no other text`;

interface ElementExtractionResponse {
  elements: Array<{
    category: string;
    name: string;
    description?: string;
    sceneNumbers: string[];
  }>;
}

// Valid element categories
const VALID_CATEGORIES: ElementCategory[] = [
  'NAME', 'PROP', 'WARDROBE', 'VEHICLE', 'ANIMAL', 'SPECIAL_EQUIPMENT',
  'VFX', 'SFX', 'STUNT', 'MAKEUP', 'HAIR', 'GREENERY', 'ART_DEPARTMENT',
  'SOUND', 'MUSIC', 'BACKGROUND', 'OTHER', 'CAMERA', 'GRIP', 'ELECTRIC',
  'SET_DRESSING', 'ADDITIONAL_LABOR', 'ANIMAL_WRANGLER', 'MECHANICAL_EFFECTS',
  'VIDEO_PLAYBACK', 'LOCATION_NOTES', 'SAFETY_NOTES', 'SECURITY',
  'QUESTIONS', 'COMMENTS', 'MISCELLANEOUS'
];

export async function executeElementExtractor(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  const apiKey = getFireworksApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Fireworks API key not configured',
    };
  }

  if (context.extractedScenes.length === 0) {
    return {
      success: false,
      error: 'No scenes available for element extraction',
    };
  }

  const kimi = new KimiClient(apiKey);
  const retry = new RetryHandler();

  // Process scenes in batches to avoid token limits
  const batchSize = 10;
  const batches = batchScenes(context.extractedScenes, batchSize);
  const totalBatches = batches.length;
  let processedBatches = 0;
  const allElements: ExtractedElement[] = [];

  for (const batch of batches) {
    await tracker.updateProgress(
      processedBatches,
      totalBatches,
      `Analyzing scenes ${batch[0].sceneNumber} - ${batch[batch.length - 1].sceneNumber}`
    );

    try {
      // Format scenes for the prompt
      const scenesText = formatScenesForPrompt(batch);

      const response = await retry.execute(
        () => kimi.complete({
          messages: [
            { role: 'system', content: ELEMENT_EXTRACTION_PROMPT },
            {
              role: 'user',
              content: `Please analyze these scenes and extract all production elements:\n\n${scenesText}`,
            },
          ],
          maxTokens: LLM_CONFIG.MAX_TOKENS_ELEMENT_EXTRACTION,
          temperature: LLM_CONFIG.TEMPERATURE_EXTRACTION,
        }),
        `ElementExtraction-batch-${processedBatches}`
      );

      const parseResult = JsonParser.parseWithValidation<ElementExtractionResponse>(
        response,
        (data): data is ElementExtractionResponse =>
          JsonParser.isObject(data) && 'elements' in data && Array.isArray(data.elements)
      );

      if (!parseResult.success) {
        console.error(`[ElementExtractor] Failed to parse response for batch ${processedBatches}:`, parseResult.error);
        processedBatches++;
        continue;
      }

      // Normalize and add elements
      for (const element of parseResult.data.elements) {
        // Skip elements with missing required fields
        if (!element.name || typeof element.name !== 'string') continue;
        if (!element.category || typeof element.category !== 'string') continue;

        const normalizedCategory = normalizeCategory(element.category);
        if (!normalizedCategory) {
          continue;
        }

        const normalizedElement: ExtractedElement = {
          category: normalizedCategory,
          name: element.name.trim(),
          description: element.description?.trim(),
          sceneNumbers: Array.isArray(element.sceneNumbers)
            ? element.sceneNumbers.map(s => String(s).trim()).filter(Boolean)
            : [],
        };

        // Check for duplicates
        const existing = allElements.find(
          e => e.category === normalizedElement.category &&
               e.name.toLowerCase() === normalizedElement.name.toLowerCase()
        );

        if (existing) {
          // Merge scene numbers
          const allSceneNumbers = new Set([...existing.sceneNumbers, ...normalizedElement.sceneNumbers]);
          existing.sceneNumbers = Array.from(allSceneNumbers).sort((a, b) => {
            const aNum = parseInt(a) || 0;
            const bNum = parseInt(b) || 0;
            return aNum - bNum;
          });
        } else {
          allElements.push(normalizedElement);
        }
      }

      console.log(`[ElementExtractor] Extracted ${parseResult.data.elements.length} elements from batch ${processedBatches + 1}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ElementExtractor] Error processing batch ${processedBatches}:`, errorMessage);
      // Continue with other batches
    }

    processedBatches++;
  }

  // Sort elements by category and name
  allElements.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  context.extractedElements = allElements;

  await tracker.updateProgress(totalBatches, totalBatches, `Found ${allElements.length} elements`);

  console.log(`[ElementExtractor] Total: ${allElements.length} elements across ${categoryCounts(allElements)} categories`);

  return {
    success: true,
    data: {
      elementsExtracted: allElements.length,
      categories: categoryCounts(allElements),
    },
    // Continue even if we found no elements (optional step)
    shouldContinue: true,
  };
}

function batchScenes(scenes: ExtractedScene[], batchSize: number): ExtractedScene[][] {
  const batches: ExtractedScene[][] = [];
  for (let i = 0; i < scenes.length; i += batchSize) {
    batches.push(scenes.slice(i, i + batchSize));
  }
  return batches;
}

function formatScenesForPrompt(scenes: ExtractedScene[]): string {
  return scenes.map(scene => {
    const header = `SCENE ${scene.sceneNumber} - ${scene.intExt}. ${scene.setName} - ${scene.timeOfDay}`;
    const chars = scene.characters.length > 0 ? `Characters: ${scene.characters.join(', ')}` : '';
    const synopsis = scene.synopsis || '';
    return `${header}\n${chars}\n${synopsis}`;
  }).join('\n\n---\n\n');
}

function normalizeCategory(category: string): ElementCategory | null {
  const upper = String(category).toUpperCase().trim().replace(/\s+/g, '_');

  // Direct match
  if (VALID_CATEGORIES.includes(upper as ElementCategory)) {
    return upper as ElementCategory;
  }

  // Handle common variations
  const mappings: Record<string, ElementCategory> = {
    'PROPS': 'PROP',
    'COSTUME': 'WARDROBE',
    'COSTUMES': 'WARDROBE',
    'CLOTHING': 'WARDROBE',
    'VEHICLES': 'VEHICLE',
    'CAR': 'VEHICLE',
    'CARS': 'VEHICLE',
    'ANIMALS': 'ANIMAL',
    'VISUAL_EFFECTS': 'VFX',
    'SPECIAL_EFFECTS': 'SFX',
    'PRACTICAL_EFFECTS': 'SFX',
    'STUNTS': 'STUNT',
    'LIGHTING': 'ELECTRIC',
    'LIGHTS': 'ELECTRIC',
    'AUDIO': 'SOUND',
    'EXTRAS': 'BACKGROUND',
    'BG': 'BACKGROUND',
    'CAST': 'NAME',
    'CHARACTER': 'NAME',
    'CHARACTERS': 'NAME',
    'SET': 'SET_DRESSING',
    'DECORATION': 'SET_DRESSING',
    'SAFETY': 'SAFETY_NOTES',
    'LOCATION': 'LOCATION_NOTES',
  };

  if (mappings[upper]) {
    return mappings[upper];
  }

  // Default to OTHER for unrecognized
  return 'OTHER';
}

function categoryCounts(elements: ExtractedElement[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const element of elements) {
    counts[element.category] = (counts[element.category] || 0) + 1;
  }
  return counts;
}
