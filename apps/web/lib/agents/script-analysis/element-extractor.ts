/**
 * Element Extractor
 *
 * Extracts production elements from scenes using the LLM.
 */

import { KimiClient } from '@/lib/ai/kimi-client';
import { getScriptAnalysisApiKey } from '@/lib/ai/config';
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
  elements: unknown[];
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
  const apiKey = getScriptAnalysisApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'No script analysis LLM API key configured',
    };
  }

  if (context.extractedScenes.length === 0) {
    return {
      success: false,
      error: 'No scenes available for element extraction',
    };
  }

  const kimi = new KimiClient();
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
        mergeElements(
          allElements,
          extractHeuristicElementsFromBatch(batch)
        );
        processedBatches++;
        continue;
      }

      // Normalize and add elements
      const normalizedElements = parseResult.data.elements
        .map((candidate) => normalizeElementCandidate(candidate))
        .filter((element): element is ExtractedElement => element !== null);

      mergeElements(allElements, normalizedElements);

      if (normalizedElements.length === 0) {
        mergeElements(allElements, extractHeuristicElementsFromBatch(batch));
      }

      console.log(`[ElementExtractor] Extracted ${normalizedElements.length} elements from batch ${processedBatches + 1}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ElementExtractor] Error processing batch ${processedBatches}:`, errorMessage);
      mergeElements(
        allElements,
        extractHeuristicElementsFromBatch(batch)
      );
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
    const sourceText = scene.sourceText
      ? `Scene text:\n${scene.sourceText.slice(0, 1400)}`
      : '';
    return `${header}\n${chars}\n${synopsis}\n${sourceText}`.trim();
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

function normalizeElementCandidate(candidate: unknown): ExtractedElement | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const category = String(record.category || record.type || '').trim();
  const name = String(record.name || record.element || '').trim();
  if (!category || !name) {
    return null;
  }

  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    return null;
  }

  const sceneNumbersValue = record.sceneNumbers ?? record.scene_numbers ?? record.scenes;
  const sceneNumbers = Array.isArray(sceneNumbersValue)
    ? sceneNumbersValue.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  return {
    category: normalizedCategory,
    name,
    description: String(record.description || record.notes || '').trim() || undefined,
    sceneNumbers,
  };
}

function mergeElements(target: ExtractedElement[], source: ExtractedElement[]): void {
  for (const element of source) {
    const existing = target.find(
      (entry) =>
        entry.category === element.category &&
        entry.name.toLowerCase() === element.name.toLowerCase()
    );

    if (!existing) {
      target.push(element);
      continue;
    }

    const mergedScenes = new Set([...existing.sceneNumbers, ...element.sceneNumbers]);
    existing.sceneNumbers = Array.from(mergedScenes).sort((a, b) => {
      const aNum = parseInt(a, 10) || 0;
      const bNum = parseInt(b, 10) || 0;
      return aNum - bNum;
    });

    if (!existing.description && element.description) {
      existing.description = element.description;
    }
  }
}

function extractHeuristicElementsFromBatch(batch: ExtractedScene[]): ExtractedElement[] {
  const extracted: ExtractedElement[] = [];

  for (const scene of batch) {
    const text = `${scene.synopsis || ''}\n${scene.sourceText || ''}`.toLowerCase();
    if (!text.trim()) continue;

    addElementIfMatch(extracted, text, {
      category: 'VEHICLE',
      name: 'Vehicle',
      sceneNumber: scene.sceneNumber,
      patterns: [/\bcar\b/, /\btruck\b/, /\bvan\b/, /\bmotorcycle\b/, /\btaxi\b/],
    });

    addElementIfMatch(extracted, text, {
      category: 'ANIMAL',
      name: 'Animal',
      sceneNumber: scene.sceneNumber,
      patterns: [/\bdog\b/, /\bcat\b/, /\bhorse\b/, /\bbird\b/],
    });

    addElementIfMatch(extracted, text, {
      category: 'SFX',
      name: 'Practical effects',
      sceneNumber: scene.sceneNumber,
      patterns: [/\bexplosion\b/, /\bfire\b/, /\bsmoke\b/, /\brain\b/, /\bfog\b/],
    });

    addElementIfMatch(extracted, text, {
      category: 'STUNT',
      name: 'Stunt action',
      sceneNumber: scene.sceneNumber,
      patterns: [/\bfight\b/, /\bchase\b/, /\bstunt\b/, /\bfall\b/],
    });

    addElementIfMatch(extracted, text, {
      category: 'BACKGROUND',
      name: 'Background performers',
      sceneNumber: scene.sceneNumber,
      patterns: [/\bextras?\b/, /\bcrowd\b/, /\bbackground\b/],
    });

    addElementIfMatch(extracted, text, {
      category: 'PROP',
      name: 'Hand props',
      sceneNumber: scene.sceneNumber,
      patterns: [/\bgun\b/, /\bphone\b/, /\bletter\b/, /\bglass\b/, /\bkey\b/, /\bbook\b/],
    });
  }

  return extracted;
}

function addElementIfMatch(
  elements: ExtractedElement[],
  text: string,
  config: {
    category: ElementCategory;
    name: string;
    sceneNumber: string;
    patterns: RegExp[];
  }
): void {
  const hasMatch = config.patterns.some((pattern) => pattern.test(text));
  if (!hasMatch) {
    return;
  }

  const existing = elements.find(
    (element) =>
      element.category === config.category &&
      element.name.toLowerCase() === config.name.toLowerCase()
  );

  if (!existing) {
    elements.push({
      category: config.category,
      name: config.name,
      sceneNumbers: [config.sceneNumber],
    });
    return;
  }

  if (!existing.sceneNumbers.includes(config.sceneNumber)) {
    existing.sceneNumbers.push(config.sceneNumber);
  }
}

function categoryCounts(elements: ExtractedElement[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const element of elements) {
    counts[element.category] = (counts[element.category] || 0) + 1;
  }
  return counts;
}
