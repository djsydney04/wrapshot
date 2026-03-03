/**
 * Cast Linker
 *
 * Creates or matches CastMember records from extracted character names
 * and links them to scenes.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { extractCharacterCuesFromSceneText } from '@/lib/scripts/scene-heuristics';
import { nanoid } from 'nanoid';
import type { AgentContext, AgentStepResult, LinkedCastMember } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

interface ExistingCastMember {
  id: string;
  characterName: string;
  actorName: string | null;
}

const CHARACTER_STOP_WORDS = new Set([
  'INT',
  'EXT',
  'DAY',
  'NIGHT',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'CONTINUOUS',
  'CUT TO',
  'FADE IN',
  'FADE OUT',
  'CAMERA',
  'SFX',
  'VFX',
]);

export async function executeCastLinker(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  const supabase = createAdminClient();

  if (context.extractedScenes.length === 0) {
    return {
      success: false,
      error: 'No scenes available for cast linking',
    };
  }

  // Get all unique character names from scenes
  const characterNames = new Set<string>();
  for (const scene of context.extractedScenes) {
    if (scene.characters.length === 0 && scene.sourceText) {
      scene.characters = mergeCharacterNames(
        scene.characters,
        extractCharacterCuesFromSceneText(scene.sourceText)
      );
      if (scene.characters.length === 0 && !(scene.warnings || []).includes('missing_characters')) {
        scene.warnings = [...(scene.warnings || []), 'missing_characters'];
      }
    }

    for (const char of scene.characters) {
      const normalized = normalizeCharacterName(char);
      if (!normalized) continue;
      characterNames.add(normalized);
    }
  }

  if (characterNames.size === 0) {
    console.log('[CastLinker] No characters found in scenes');
    return {
      success: true,
      data: { castCreated: 0, castLinked: 0 },
      shouldContinue: true,
    };
  }

  await tracker.updateProgress(0, 3, 'Fetching existing cast members');

  // Get existing cast members for the project
  const { data: existingCast, error: castError } = await supabase
    .from('CastMember')
    .select('id, characterName, actorName')
    .eq('projectId', context.projectId);

  if (castError) {
    console.error('[CastLinker] Error fetching existing cast:', castError);
    return {
      success: false,
      error: `Failed to fetch existing cast: ${castError.message}`,
    };
  }

  const existingCastMap = new Map<string, ExistingCastMember>();
  for (const member of existingCast || []) {
    if (member.characterName) {
      const normalized = normalizeCharacterName(member.characterName);
      if (normalized) {
        existingCastMap.set(normalized, member);
      }
    }
  }

  await tracker.updateProgress(1, 3, 'Creating new cast members');

  // Create cast members for new characters
  const linkedCast: LinkedCastMember[] = [];
  const newCastMembers: Array<{
    id: string;
    projectId: string;
    characterName: string;
    castNumber: number;
    workStatus: string;
    createdAt: string;
  }> = [];

  let castNumber = (existingCast?.length || 0) + 1;

  for (const charName of characterNames) {
    const existing = existingCastMap.get(charName);

    if (existing) {
      // Use existing cast member
      linkedCast.push({
        characterName: charName,
        castMemberId: existing.id,
        isNew: false,
        sceneIds: [], // Will be populated later
      });
    } else {
      // Create new cast member
      const castMemberId = nanoid();
      newCastMembers.push({
        id: castMemberId,
        projectId: context.projectId,
        characterName: charName,
        castNumber,
        workStatus: 'ON_HOLD',
        createdAt: new Date().toISOString(),
      });

      linkedCast.push({
        characterName: charName,
        castMemberId,
        isNew: true,
        sceneIds: [],
      });

      castNumber++;
    }
  }

  // Bulk insert new cast members
  if (newCastMembers.length > 0) {
    const { error: insertError } = await supabase
      .from('CastMember')
      .insert(newCastMembers);

    if (insertError) {
      console.error('[CastLinker] Error creating cast members:', insertError);
      return {
        success: false,
        error: `Failed to create cast members: ${insertError.message}`,
      };
    }

    console.log(`[CastLinker] Created ${newCastMembers.length} new cast members`);
  }

  await tracker.updateProgress(2, 3, 'Linking cast to scenes');

  // Build character name to cast member ID mapping
  const charToCastId = new Map<string, string>();
  for (const linked of linkedCast) {
    charToCastId.set(linked.characterName, linked.castMemberId);
  }

  // Store in context for later use
  context.linkedCast = linkedCast;
  context.createdCastIds = newCastMembers.map(c => c.id);

  await tracker.updateProgress(3, 3, `Linked ${linkedCast.length} cast members`);

  console.log(`[CastLinker] Total: ${linkedCast.length} cast (${newCastMembers.length} new, ${linkedCast.length - newCastMembers.length} existing)`);

  return {
    success: true,
    data: {
      castCreated: newCastMembers.length,
      castLinked: linkedCast.length,
      characters: Array.from(characterNames),
    },
  };
}

function normalizeCharacterName(value: string): string {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[^A-Z0-9 '\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (CHARACTER_STOP_WORDS.has(normalized)) return '';
  if (normalized.length < 2) return '';

  return normalized;
}

function mergeCharacterNames(existing: string[], incoming: string[]): string[] {
  const merged = new Set<string>();
  for (const name of [...existing, ...incoming]) {
    const normalized = normalizeCharacterName(name);
    if (!normalized) continue;
    merged.add(normalized);
  }
  return Array.from(merged);
}
