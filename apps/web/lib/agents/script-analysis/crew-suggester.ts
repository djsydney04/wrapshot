/**
 * Crew Suggester
 *
 * Analyzes extracted elements and scenes to suggest crew roles
 * that the production will likely need. Uses rule-based mapping
 * from element categories to crew departments/roles.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { AgentContext, AgentStepResult, SuggestedCrewRole, ExtractedElement } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

// Mapping from element categories to suggested crew roles
const ELEMENT_TO_CREW_MAP: Record<string, { role: string; department: string; priority: 'high' | 'medium' | 'low' }[]> = {
  STUNT: [
    { role: 'Stunt Coordinator', department: 'STUNTS', priority: 'high' },
    { role: 'Stunt Performer', department: 'STUNTS', priority: 'medium' },
  ],
  VFX: [
    { role: 'VFX Supervisor', department: 'VFX', priority: 'high' },
    { role: 'VFX Artist', department: 'VFX', priority: 'medium' },
  ],
  SFX: [
    { role: 'Special Effects Coordinator', department: 'ART', priority: 'high' },
  ],
  ANIMAL: [
    { role: 'Animal Wrangler', department: 'PRODUCTION', priority: 'high' },
  ],
  ANIMAL_WRANGLER: [
    { role: 'Animal Wrangler', department: 'PRODUCTION', priority: 'high' },
  ],
  VEHICLE: [
    { role: 'Transportation Coordinator', department: 'TRANSPORTATION', priority: 'medium' },
    { role: 'Picture Car Coordinator', department: 'TRANSPORTATION', priority: 'medium' },
  ],
  MAKEUP: [
    { role: 'Makeup Department Head', department: 'HAIR_MAKEUP', priority: 'high' },
    { role: 'Prosthetics Artist', department: 'HAIR_MAKEUP', priority: 'medium' },
  ],
  HAIR: [
    { role: 'Hair Department Head', department: 'HAIR_MAKEUP', priority: 'medium' },
  ],
  WARDROBE: [
    { role: 'Costume Designer', department: 'COSTUME', priority: 'high' },
    { role: 'Wardrobe Supervisor', department: 'COSTUME', priority: 'medium' },
  ],
  MECHANICAL_EFFECTS: [
    { role: 'Mechanical Effects Supervisor', department: 'ART', priority: 'high' },
  ],
  VIDEO_PLAYBACK: [
    { role: 'Video Playback Operator', department: 'CAMERA', priority: 'medium' },
  ],
  BACKGROUND: [
    { role: 'Extras Casting Director', department: 'PRODUCTION', priority: 'medium' },
    { role: 'Background PA', department: 'DIRECTION', priority: 'low' },
  ],
  SOUND: [
    { role: 'Sound Mixer', department: 'SOUND', priority: 'high' },
    { role: 'Boom Operator', department: 'SOUND', priority: 'medium' },
  ],
  MUSIC: [
    { role: 'Music Supervisor', department: 'POST_PRODUCTION', priority: 'medium' },
  ],
  GREENERY: [
    { role: 'Greens Person', department: 'ART', priority: 'low' },
  ],
  SET_DRESSING: [
    { role: 'Set Decorator', department: 'ART', priority: 'medium' },
    { role: 'Leadperson', department: 'ART', priority: 'low' },
  ],
  SPECIAL_EQUIPMENT: [
    { role: 'Special Equipment Operator', department: 'CAMERA', priority: 'medium' },
  ],
  SECURITY: [
    { role: 'Security Coordinator', department: 'PRODUCTION', priority: 'medium' },
  ],
};

export async function executeCrewSuggester(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  try {
    await tracker.updateProgress(0, 1, 'Analyzing elements for crew needs...');

    const suggestions = generateCrewSuggestions(context);

    if (suggestions.length === 0) {
      await tracker.updateProgress(1, 1, 'No specific crew suggestions based on script elements');
      return { success: true, shouldContinue: true };
    }

    // Store suggestions in context
    context.suggestedCrewRoles = suggestions;

    await tracker.updateProgress(0, suggestions.length, `Saving ${suggestions.length} crew suggestions...`);

    // Save to database
    const supabase = createAdminClient();
    const records = suggestions.map((s) => ({
      projectId: context.projectId,
      jobId: context.jobId,
      role: s.role,
      department: s.department,
      reason: s.reason,
      priority: s.priority,
    }));

    const { error } = await supabase
      .from('CrewSuggestion')
      .insert(records);

    if (error) {
      console.error('[CrewSuggester] Failed to save suggestions:', error);
      // Non-blocking: return success even if DB save fails
      return { success: true, shouldContinue: true };
    }

    await tracker.updateProgress(suggestions.length, suggestions.length, `Suggested ${suggestions.length} crew roles`);

    return { success: true };
  } catch (error) {
    console.error('[CrewSuggester] Error:', error);
    // Non-blocking: pipeline completes even if this step fails
    return { success: true, shouldContinue: true };
  }
}

function generateCrewSuggestions(context: AgentContext): SuggestedCrewRole[] {
  const suggestions = new Map<string, SuggestedCrewRole>();
  const elementCounts = new Map<string, number>();

  // Count occurrences of each element category
  for (const element of context.extractedElements) {
    const count = elementCounts.get(element.category) || 0;
    elementCounts.set(element.category, count + 1);
  }

  // Generate suggestions based on element categories
  for (const [category, count] of elementCounts) {
    const crewMappings = ELEMENT_TO_CREW_MAP[category];
    if (!crewMappings) continue;

    for (const mapping of crewMappings) {
      const key = `${mapping.department}-${mapping.role}`;
      if (suggestions.has(key)) continue;

      // Build reason from actual elements
      const relevantElements = context.extractedElements
        .filter((e) => e.category === category)
        .slice(0, 3)
        .map((e) => e.name);

      const elementList = relevantElements.join(', ');
      const reason = `Script contains ${count} ${category.toLowerCase().replace(/_/g, ' ')} element${count > 1 ? 's' : ''} (${elementList}${count > 3 ? '...' : ''})`;

      // Boost priority if there are many elements of this type
      let priority = mapping.priority;
      if (count >= 5 && priority === 'medium') priority = 'high';
      if (count >= 10 && priority === 'low') priority = 'medium';

      suggestions.set(key, {
        role: mapping.role,
        department: mapping.department,
        reason,
        priority,
      });
    }
  }

  // Check for exterior/night scenes that may need specialized crew
  const exteriorScenes = context.extractedScenes.filter(
    (s) => s.intExt === 'EXT' || s.intExt === 'BOTH'
  );
  if (exteriorScenes.length > 5) {
    const key = 'LOCATIONS-Location Manager';
    if (!suggestions.has(key)) {
      suggestions.set(key, {
        role: 'Location Manager',
        department: 'LOCATIONS',
        reason: `Script has ${exteriorScenes.length} exterior scenes requiring location management`,
        priority: 'high',
      });
    }
  }

  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return Array.from(suggestions.values()).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}
