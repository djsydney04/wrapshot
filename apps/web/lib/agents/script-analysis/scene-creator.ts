/**
 * Scene Creator
 *
 * Creates Scene, Element, and SceneCastMember records in the database
 * from extracted data.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';
import { normalizeElementCategoryForStorage } from '@/lib/constants/elements';
import type { AgentContext, AgentStepResult, ExtractedScene, ExtractedElement } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

interface SceneRecord {
  id: string;
  projectId: string;
  sceneNumber: string;
  intExt: string;
  dayNight: string;
  locationId: string | null;
  setName: string;
  synopsis: string | null;
  scriptPageStart: number | null;
  scriptPageEnd: number | null;
  pageEighths: number | null;
  estimatedHours: number | null;
  sortOrder: number;
  status: string;
  breakdownStatus: string;
  createdAt: string;
}

interface ElementRecord {
  id: string;
  projectId: string;
  category: string;
  name: string;
  description: string | null;
  createdAt: string;
}

interface SceneElementRecord {
  sceneId: string;
  elementId: string;
  quantity: number;
  createdAt: string;
}

interface SceneCastMemberRecord {
  sceneId: string;
  castMemberId: string;
  createdAt: string;
}

type DbDayNight =
  | 'DAY'
  | 'NIGHT'
  | 'DAWN'
  | 'DUSK'
  | 'MORNING'
  | 'AFTERNOON'
  | 'EVENING';

function normalizeIntExtForDb(value: string): 'INT' | 'EXT' | 'BOTH' {
  const upper = String(value || '').toUpperCase().trim();
  if (upper === 'EXT') return 'EXT';
  if (upper === 'BOTH' || upper === 'I/E' || upper.includes('/')) return 'BOTH';
  return 'INT';
}

function normalizeDayNightForDb(value: string): DbDayNight {
  const upper = String(value || '').toUpperCase().trim();

  if (upper.includes('NIGHT')) return 'NIGHT';
  if (upper.includes('DAWN')) return 'DAWN';
  if (upper.includes('DUSK')) return 'DUSK';
  if (upper.includes('MORNING')) return 'MORNING';
  if (upper.includes('AFTERNOON')) return 'AFTERNOON';
  if (upper.includes('EVENING')) return 'EVENING';

  // "CONTINUOUS" is returned by the extractor but not supported by the DB enum.
  return 'DAY';
}

function normalizeSceneNumberKey(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^SCENE\s+/i, '')
    .toUpperCase();
}

function normalizeElementNameKey(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function buildElementKey(category: string, name: string): string {
  return `${normalizeElementCategoryForStorage(category)}-${normalizeElementNameKey(name)}`;
}

export async function executeSceneCreator(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  const supabase = createAdminClient();

  if (context.extractedScenes.length === 0) {
    return {
      success: false,
      error: 'No scenes available to create',
    };
  }

  await tracker.updateProgress(0, 4, 'Preparing scene records');

  // Build character name to cast ID mapping
  const charToCastId = new Map<string, string>();
  for (const linked of context.linkedCast) {
    charToCastId.set(linked.characterName, linked.castMemberId);
  }

  // Get existing scenes to avoid duplicates
  const { data: existingScenes } = await supabase
    .from('Scene')
    .select('id, sceneNumber, sortOrder')
    .eq('projectId', context.projectId);

  const existingSceneNumbers = new Set(
    (existingScenes || []).map(s => normalizeSceneNumberKey(s.sceneNumber))
  );

  // Filter out scenes that already exist
  const newScenes = context.extractedScenes.filter(
    scene => !existingSceneNumbers.has(normalizeSceneNumberKey(scene.sceneNumber))
  );

  const maxSortOrder = (existingScenes || []).reduce((max, scene) => {
    const sortOrder = typeof scene.sortOrder === 'number' ? scene.sortOrder : 0;
    return Math.max(max, sortOrder);
  }, -1);

  await tracker.updateProgress(
    1,
    4,
    newScenes.length > 0
      ? `Creating ${newScenes.length} scenes`
      : 'No new scenes to create; linking elements and cast to existing scenes'
  );

  const sceneIdMap = new Map<string, string>(); // normalized sceneNumber -> sceneId
  for (const existingScene of existingScenes || []) {
    sceneIdMap.set(normalizeSceneNumberKey(existingScene.sceneNumber), existingScene.id);
  }

  // Build or create locations from scene set names so location tracking stays in sync.
  const sceneLocationByNumber = new Map<string, string | null>();
  if (newScenes.length > 0) {
    const { data: existingLocations } = await supabase
      .from('Location')
      .select('id, name')
      .eq('projectId', context.projectId);

    const locationIdByName = new Map<string, string>();
    for (const location of existingLocations || []) {
      locationIdByName.set(location.name.trim().toLowerCase(), location.id);
    }

    for (const scene of newScenes) {
      const normalizedSetName = scene.setName?.trim();
      if (!normalizedSetName) {
        sceneLocationByNumber.set(scene.sceneNumber, null);
        continue;
      }

      const key = normalizedSetName.toLowerCase();
      const existingLocationId = locationIdByName.get(key);
      if (existingLocationId) {
        sceneLocationByNumber.set(scene.sceneNumber, existingLocationId);
        continue;
      }

      const { data: createdLocation, error: createLocationError } = await supabase
        .from('Location')
        .insert({
          projectId: context.projectId,
          name: normalizedSetName,
          interiorExterior: normalizeIntExtForDb(scene.intExt),
        })
        .select('id, name')
        .single();

      if (createLocationError || !createdLocation) {
        console.warn('[SceneCreator] Failed to auto-create location:', createLocationError?.message);
        sceneLocationByNumber.set(scene.sceneNumber, null);
        continue;
      }

      locationIdByName.set(createdLocation.name.trim().toLowerCase(), createdLocation.id);
      sceneLocationByNumber.set(scene.sceneNumber, createdLocation.id);
    }
  }

  // Create scene records
  const sceneRecords: SceneRecord[] = [];

  for (let i = 0; i < newScenes.length; i++) {
    const scene = newScenes[i];
    const sceneId = nanoid();
    sceneIdMap.set(normalizeSceneNumberKey(scene.sceneNumber), sceneId);

    sceneRecords.push({
      id: sceneId,
      projectId: context.projectId,
      sceneNumber: scene.sceneNumber,
      intExt: normalizeIntExtForDb(scene.intExt),
      dayNight: normalizeDayNightForDb(scene.timeOfDay),
      locationId: sceneLocationByNumber.get(scene.sceneNumber) || null,
      setName: scene.setName,
      synopsis: scene.synopsis || null,
      scriptPageStart: scene.scriptPageStart || null,
      scriptPageEnd: scene.scriptPageEnd || null,
      pageEighths: scene.pageLengthEighths || null,
      estimatedHours: scene.estimatedHours || null,
      sortOrder: maxSortOrder + i + 1,
      status: 'NOT_SCHEDULED',
      breakdownStatus: 'COMPLETED',
      createdAt: new Date().toISOString(),
    });
  }

  if (sceneRecords.length > 0) {
    // Insert scenes
    const { error: sceneError } = await supabase
      .from('Scene')
      .insert(sceneRecords);

    if (sceneError) {
      console.error('[SceneCreator] Error creating scenes:', sceneError);
      return {
        success: false,
        error: `Failed to create scenes: ${sceneError.message}`,
      };
    }

    console.log(`[SceneCreator] Created ${sceneRecords.length} scenes`);
  } else {
    console.log('[SceneCreator] All scenes already exist; skipping scene creation');
  }

  context.createdSceneIds = sceneRecords.map(s => s.id);

  await tracker.updateProgress(2, 4, 'Creating elements');

  // Create element records (if we have elements)
  const elementIdMap = new Map<string, string>(); // "category-name" -> elementId

  if (context.extractedElements.length > 0) {
    // Check for existing elements
    const { data: existingElements } = await supabase
      .from('Element')
      .select('id, category, name')
      .eq('projectId', context.projectId);

    const existingElementKeys = new Set(
      (existingElements || []).map(e => buildElementKey(e.category, e.name))
    );

    // Build map of existing elements
    for (const el of existingElements || []) {
      elementIdMap.set(buildElementKey(el.category, el.name), el.id);
    }

    // Filter new elements
    const newElements = context.extractedElements.filter(
      el => !existingElementKeys.has(buildElementKey(el.category, el.name))
    );

    if (newElements.length > 0) {
      const elementRecords: ElementRecord[] = newElements.map(element => {
        const elementId = nanoid();
        elementIdMap.set(buildElementKey(element.category, element.name), elementId);
        return {
          id: elementId,
          projectId: context.projectId,
          category: normalizeElementCategoryForStorage(element.category),
          name: String(element.name || '').trim(),
          description: element.description || null,
          createdAt: new Date().toISOString(),
        };
      });

      const { error: elementError } = await supabase
        .from('Element')
        .insert(elementRecords);

      if (elementError) {
        console.error('[SceneCreator] Error creating elements:', elementError);
        // Continue - elements are optional
      } else {
        context.createdElementIds = elementRecords.map(e => e.id);
        console.log(`[SceneCreator] Created ${elementRecords.length} elements`);
      }
    }

    // Create scene-element links
    const sceneElementRecords: SceneElementRecord[] = [];

    for (const element of context.extractedElements) {
      const elementId = elementIdMap.get(buildElementKey(element.category, element.name));
      if (!elementId) continue;

      for (const sceneNumber of element.sceneNumbers) {
        const sceneId = sceneIdMap.get(normalizeSceneNumberKey(sceneNumber));
        if (!sceneId) continue;

        sceneElementRecords.push({
          sceneId,
          elementId,
          quantity: element.quantity || 1,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (sceneElementRecords.length > 0) {
      const { error: linkError } = await supabase
        .from('SceneElement')
        .upsert(sceneElementRecords, { onConflict: 'sceneId,elementId' });

      if (linkError) {
        console.error('[SceneCreator] Error linking elements to scenes:', linkError);
      } else {
        console.log(`[SceneCreator] Created ${sceneElementRecords.length} scene-element links`);
      }
    }
  }

  await tracker.updateProgress(3, 4, 'Linking cast to scenes');

  // Create scene-cast links
  const sceneCastRecords: SceneCastMemberRecord[] = [];

  for (const scene of newScenes) {
    const sceneId = sceneIdMap.get(normalizeSceneNumberKey(scene.sceneNumber));
    if (!sceneId) continue;

    for (const charName of scene.characters) {
      const castMemberId = charToCastId.get(charName.toUpperCase());
      if (!castMemberId) continue;

      sceneCastRecords.push({
        sceneId,
        castMemberId,
        createdAt: new Date().toISOString(),
      });

      // Update linked cast with scene IDs
      const linkedCast = context.linkedCast.find(c => c.castMemberId === castMemberId);
      if (linkedCast) {
        linkedCast.sceneIds.push(sceneId);
      }
    }
  }

  if (sceneCastRecords.length > 0) {
    const { error: castLinkError } = await supabase
      .from('SceneCastMember')
      .upsert(sceneCastRecords, { onConflict: 'sceneId,castMemberId' });

    if (castLinkError) {
      console.error('[SceneCreator] Error linking cast to scenes:', castLinkError);
    } else {
      console.log(`[SceneCreator] Created ${sceneCastRecords.length} scene-cast links`);
    }
  }

  await tracker.updateProgress(4, 4, 'Database records created');

  return {
    success: true,
    data: {
      scenesCreated: sceneRecords.length,
      elementsCreated: context.createdElementIds.length,
      sceneElementLinks: context.extractedElements.reduce((sum, e) => sum + e.sceneNumbers.length, 0),
      sceneCastLinks: sceneCastRecords.length,
    },
  };
}
