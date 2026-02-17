/**
 * Scene Creator
 *
 * Creates Scene, Element, and SceneCastMember records in the database
 * from extracted data.
 */

import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';
import type { AgentContext, AgentStepResult, ExtractedScene, ExtractedElement } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

interface SceneRecord {
  id: string;
  projectId: string;
  sceneNumber: string;
  intExt: string;
  dayNight: string;
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

export async function executeSceneCreator(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  const supabase = await createClient();

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
    .select('sceneNumber')
    .eq('projectId', context.projectId);

  const existingSceneNumbers = new Set(
    (existingScenes || []).map(s => s.sceneNumber)
  );

  // Filter out scenes that already exist
  const newScenes = context.extractedScenes.filter(
    scene => !existingSceneNumbers.has(scene.sceneNumber)
  );

  if (newScenes.length === 0) {
    console.log('[SceneCreator] All scenes already exist');
    return {
      success: true,
      data: { scenesCreated: 0, reason: 'All scenes already exist' },
    };
  }

  await tracker.updateProgress(1, 4, `Creating ${newScenes.length} scenes`);

  // Create scene records
  const sceneRecords: SceneRecord[] = [];
  const sceneIdMap = new Map<string, string>(); // sceneNumber -> sceneId

  for (let i = 0; i < newScenes.length; i++) {
    const scene = newScenes[i];
    const sceneId = nanoid();
    sceneIdMap.set(scene.sceneNumber, sceneId);

    sceneRecords.push({
      id: sceneId,
      projectId: context.projectId,
      sceneNumber: scene.sceneNumber,
      intExt: scene.intExt,
      dayNight: scene.timeOfDay,
      setName: scene.setName,
      synopsis: scene.synopsis || null,
      scriptPageStart: scene.scriptPageStart || null,
      scriptPageEnd: scene.scriptPageEnd || null,
      pageEighths: scene.pageLengthEighths || null,
      estimatedHours: scene.estimatedHours || null,
      sortOrder: i,
      status: 'NOT_SCHEDULED',
      breakdownStatus: 'COMPLETED',
      createdAt: new Date().toISOString(),
    });
  }

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

  context.createdSceneIds = sceneRecords.map(s => s.id);
  console.log(`[SceneCreator] Created ${sceneRecords.length} scenes`);

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
      (existingElements || []).map(e => `${e.category}-${e.name.toLowerCase()}`)
    );

    // Build map of existing elements
    for (const el of existingElements || []) {
      elementIdMap.set(`${el.category}-${el.name.toLowerCase()}`, el.id);
    }

    // Filter new elements
    const newElements = context.extractedElements.filter(
      el => !existingElementKeys.has(`${el.category}-${el.name.toLowerCase()}`)
    );

    if (newElements.length > 0) {
      const elementRecords: ElementRecord[] = newElements.map(element => {
        const elementId = nanoid();
        elementIdMap.set(`${element.category}-${element.name.toLowerCase()}`, elementId);
        return {
          id: elementId,
          projectId: context.projectId,
          category: element.category,
          name: element.name,
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
      const elementId = elementIdMap.get(`${element.category}-${element.name.toLowerCase()}`);
      if (!elementId) continue;

      for (const sceneNumber of element.sceneNumbers) {
        const sceneId = sceneIdMap.get(sceneNumber);
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
    const sceneId = sceneIdMap.get(scene.sceneNumber);
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
