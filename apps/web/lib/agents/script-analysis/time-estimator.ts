/**
 * Time Estimator
 *
 * Estimates shooting time for each scene based on complexity factors.
 */

import { TIME_ESTIMATION } from '../constants';
import type { AgentContext, AgentStepResult, ExtractedScene, ExtractedElement } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

export async function executeTimeEstimator(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  const scenes = context.extractedScenes;

  if (scenes.length === 0) {
    return {
      success: false,
      error: 'No scenes available for time estimation',
    };
  }

  await tracker.updateProgress(0, scenes.length, 'Calculating time estimates');

  let estimatedScenes = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Get elements for this scene
    const sceneElements = context.extractedElements.filter(
      e => e.sceneNumbers.includes(scene.sceneNumber)
    );

    // Calculate base time from page length
    const pageLength = (scene.pageLengthEighths || 4) / 8; // Convert to pages
    let estimatedHours = pageLength * (1 / TIME_ESTIMATION.BASE_HOURS_PER_PAGE);

    // Apply multipliers based on complexity factors
    const multiplier = calculateComplexityMultiplier(scene, sceneElements);
    estimatedHours *= multiplier;

    // Round to nearest quarter hour
    estimatedHours = Math.round(estimatedHours * 4) / 4;

    // Minimum 0.25 hours, maximum 8 hours per scene
    estimatedHours = Math.max(0.25, Math.min(8, estimatedHours));

    scene.estimatedHours = estimatedHours;
    estimatedScenes++;

    if (i % 10 === 0) {
      await tracker.updateProgress(i + 1, scenes.length, `Estimated ${i + 1} of ${scenes.length} scenes`);
    }
  }

  await tracker.updateProgress(scenes.length, scenes.length, `Estimated ${estimatedScenes} scenes`);

  // Calculate totals
  const totalHours = scenes.reduce((sum, s) => sum + (s.estimatedHours || 0), 0);
  const averageHoursPerScene = totalHours / scenes.length;

  console.log(`[TimeEstimator] Total: ${totalHours.toFixed(1)} hours for ${scenes.length} scenes (avg: ${averageHoursPerScene.toFixed(2)} hrs/scene)`);

  return {
    success: true,
    data: {
      scenesEstimated: estimatedScenes,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHoursPerScene: Math.round(averageHoursPerScene * 100) / 100,
    },
  };
}

function calculateComplexityMultiplier(
  scene: ExtractedScene,
  elements: ExtractedElement[]
): number {
  let multiplier = 1.0;

  // Location type
  if (scene.intExt === 'EXT') {
    multiplier *= TIME_ESTIMATION.EXTERIOR_MULTIPLIER;
  } else if (scene.intExt === 'BOTH') {
    multiplier *= (TIME_ESTIMATION.EXTERIOR_MULTIPLIER + 1) / 2; // Average
  }

  // Time of day
  const timeOfDay = scene.timeOfDay.toUpperCase();
  if (timeOfDay === 'NIGHT' || timeOfDay === 'EVENING') {
    multiplier *= TIME_ESTIMATION.NIGHT_MULTIPLIER;
  }

  // Cast size
  const castCount = scene.characters.length;
  if (castCount > 5) {
    multiplier *= 1.2; // More coverage needed
  }
  if (castCount > 10) {
    multiplier *= 1.3; // Significantly more complex
  }

  // Element-based complexity
  const elementCategories = new Set(elements.map(e => e.category));

  if (elementCategories.has('VFX')) {
    multiplier *= TIME_ESTIMATION.VFX_MULTIPLIER;
  }

  if (elementCategories.has('STUNT')) {
    multiplier *= TIME_ESTIMATION.STUNT_MULTIPLIER;
  }

  if (elementCategories.has('SFX') || elementCategories.has('MECHANICAL_EFFECTS')) {
    multiplier *= 1.5;
  }

  if (elementCategories.has('BACKGROUND')) {
    const bgElement = elements.find(e => e.category === 'BACKGROUND');
    if (bgElement) {
      // Check for large crowd
      const desc = bgElement.description?.toLowerCase() || bgElement.name.toLowerCase();
      if (desc.includes('crowd') || desc.includes('large') || desc.includes('many')) {
        multiplier *= TIME_ESTIMATION.CROWD_MULTIPLIER;
      }
    }
  }

  if (elementCategories.has('ANIMAL')) {
    multiplier *= 1.3;
  }

  if (elementCategories.has('VEHICLE')) {
    multiplier *= 1.2;
  }

  // Special camera requirements
  if (elementCategories.has('CAMERA')) {
    const cameraElement = elements.find(e => e.category === 'CAMERA');
    if (cameraElement) {
      const desc = cameraElement.description?.toLowerCase() || cameraElement.name.toLowerCase();
      if (desc.includes('crane') || desc.includes('aerial') || desc.includes('underwater')) {
        multiplier *= 1.5;
      }
    }
  }

  // Synopsis-based heuristics
  const synopsis = scene.synopsis?.toLowerCase() || '';

  if (synopsis.includes('fight') || synopsis.includes('chase') || synopsis.includes('action')) {
    multiplier *= TIME_ESTIMATION.ACTION_MULTIPLIER;
  }

  if (synopsis.includes('explosion') || synopsis.includes('crash') || synopsis.includes('fire')) {
    multiplier *= 1.5;
  }

  return multiplier;
}
