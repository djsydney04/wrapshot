/**
 * Time Estimator
 *
 * Estimates shooting time for each scene based on complexity factors.
 */

import { TIME_ESTIMATION } from '../constants';
import type {
  AgentContext,
  AgentStepResult,
  ExtractedElement,
  ExtractedScene,
} from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

interface SceneHeuristicContext {
  locationSceneCount: number;
  isFirstLocationUse: boolean;
  isSameAsPreviousSet: boolean;
}

const DIALOGUE_KEYWORDS = [
  'talk',
  'discuss',
  'argue',
  'debate',
  'conversation',
  'confess',
  'question',
];
const COMPLEX_SET_KEYWORDS = [
  'rooftop',
  'highway',
  'bridge',
  'forest',
  'beach',
  'ocean',
  'boat',
  'airport',
  'warehouse',
  'hospital',
  'courtroom',
  'nightclub',
  'stadium',
  'factory',
  'underwater',
];
const SIMPLE_SET_KEYWORDS = [
  'apartment',
  'office',
  'bedroom',
  'kitchen',
  'living room',
  'classroom',
  'studio',
];
const WEATHER_KEYWORDS = ['rain', 'snow', 'wind', 'storm', 'fog', 'blizzard'];

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

  const locationFrequency = buildLocationFrequencyMap(scenes);
  const seenLocations = new Set<string>();
  let estimatedScenes = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const locationKey = normalizeLocationKey(scene.setName);
    const locationSceneCount = locationFrequency.get(locationKey) || 1;
    const isFirstLocationUse = !seenLocations.has(locationKey);
    const previousScene = i > 0 ? scenes[i - 1] : null;
    const isSameAsPreviousSet = Boolean(
      previousScene && normalizeLocationKey(previousScene.setName) === locationKey
    );

    seenLocations.add(locationKey);

    // Get elements for this scene
    const sceneElements = context.extractedElements.filter((element) =>
      element.sceneNumbers.includes(scene.sceneNumber)
    );

    // Calculate base time from page length
    const pageLength = (scene.pageLengthEighths || 4) / 8; // Convert to pages
    let estimatedHours = pageLength * (1 / TIME_ESTIMATION.BASE_HOURS_PER_PAGE);

    const heuristicContext: SceneHeuristicContext = {
      locationSceneCount,
      isFirstLocationUse,
      isSameAsPreviousSet,
    };

    // Apply multipliers based on complexity factors
    const multiplier = calculateComplexityMultiplier(scene, sceneElements, heuristicContext);
    estimatedHours *= multiplier;
    estimatedHours += calculateSetupHours(scene, heuristicContext);

    // Round to nearest quarter hour
    estimatedHours = Math.round(estimatedHours * 4) / 4;

    // Minimum 0.25 hours, maximum 8 hours per scene
    estimatedHours = Math.max(0.25, Math.min(8, estimatedHours));

    scene.estimatedHours = estimatedHours;
    estimatedScenes++;

    if (i % 10 === 0) {
      await tracker.updateProgress(
        i + 1,
        scenes.length,
        `Estimated ${i + 1} of ${scenes.length} scenes`
      );
    }
  }

  await tracker.updateProgress(
    scenes.length,
    scenes.length,
    `Estimated ${estimatedScenes} scenes`
  );

  // Calculate totals
  const totalHours = scenes.reduce((sum, scene) => sum + (scene.estimatedHours || 0), 0);
  const averageHoursPerScene = totalHours / scenes.length;

  console.log(
    `[TimeEstimator] Total: ${totalHours.toFixed(1)} hours for ${scenes.length} scenes ` +
      `(avg: ${averageHoursPerScene.toFixed(2)} hrs/scene)`
  );

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
  elements: ExtractedElement[],
  context: SceneHeuristicContext
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
  const elementCategories = new Set(elements.map((element) => element.category));

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
    const bgElement = elements.find((element) => element.category === 'BACKGROUND');
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
    const cameraElement = elements.find((element) => element.category === 'CAMERA');
    if (cameraElement) {
      const desc = cameraElement.description?.toLowerCase() || cameraElement.name.toLowerCase();
      if (desc.includes('crane') || desc.includes('aerial') || desc.includes('underwater')) {
        multiplier *= 1.5;
      }
    }
  }

  // Synopsis + set-name heuristics
  const synopsis = scene.synopsis?.toLowerCase() || '';
  const setContext = `${scene.setName || ''} ${synopsis}`.toLowerCase();

  if (synopsis.includes('fight') || synopsis.includes('chase') || synopsis.includes('action')) {
    multiplier *= TIME_ESTIMATION.ACTION_MULTIPLIER;
  }

  if (synopsis.includes('explosion') || synopsis.includes('crash') || synopsis.includes('fire')) {
    multiplier *= 1.5;
  }

  if (setContainsAny(setContext, COMPLEX_SET_KEYWORDS)) {
    multiplier *= 1.2;
  } else if (setContainsAny(setContext, SIMPLE_SET_KEYWORDS)) {
    multiplier *= 0.9;
  }

  if (scene.intExt !== 'INT' && setContainsAny(setContext, WEATHER_KEYWORDS)) {
    multiplier *= 1.2;
  }

  if (context.isFirstLocationUse) {
    multiplier *= 1.1;
  } else if (context.locationSceneCount >= 3) {
    multiplier *= 0.9;
  }

  if (context.isSameAsPreviousSet) {
    multiplier *= 0.9;
  }

  const hasHighComplexityElements =
    elementCategories.has('VFX') ||
    elementCategories.has('STUNT') ||
    elementCategories.has('SFX') ||
    elementCategories.has('MECHANICAL_EFFECTS');
  const dialogueLikely = castCount <= 3 && setContainsAny(setContext, DIALOGUE_KEYWORDS);
  if (dialogueLikely && !hasHighComplexityElements) {
    multiplier *= 0.85;
  }

  return multiplier;
}

function calculateSetupHours(
  scene: ExtractedScene,
  context: SceneHeuristicContext
): number {
  let setupHours = 0;
  const setContext = `${scene.setName || ''} ${scene.synopsis || ''}`.toLowerCase();

  if (context.isFirstLocationUse) {
    setupHours += 0.5;
  }

  if (scene.intExt !== 'INT' && context.isFirstLocationUse) {
    setupHours += 0.25;
  }

  if (setContainsAny(setContext, COMPLEX_SET_KEYWORDS)) {
    setupHours += 0.25;
  }

  if (scene.characters.length > 12) {
    setupHours += 0.5;
  }

  return setupHours;
}

function setContainsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeLocationKey(setName: string): string {
  return String(setName || '').trim().toLowerCase();
}

function buildLocationFrequencyMap(scenes: ExtractedScene[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const scene of scenes) {
    const key = normalizeLocationKey(scene.setName);
    frequency.set(key, (frequency.get(key) || 0) + 1);
  }

  return frequency;
}
