/**
 * Crew Suggester
 *
 * Analyzes extracted elements and scenes to suggest crew roles
 * that the production will likely need. Uses rule-based mapping
 * from element categories to crew departments/roles.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { AgentContext, AgentStepResult, SuggestedCrewRole } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

type CrewPriority = 'high' | 'medium' | 'low';
type CrewDepartment =
  | 'PRODUCTION'
  | 'DIRECTION'
  | 'CAMERA'
  | 'SOUND'
  | 'LIGHTING'
  | 'ART'
  | 'COSTUME'
  | 'HAIR_MAKEUP'
  | 'LOCATIONS'
  | 'STUNTS'
  | 'VFX'
  | 'TRANSPORTATION'
  | 'CATERING'
  | 'ACCOUNTING'
  | 'POST_PRODUCTION';

interface CrewMapping {
  role: string;
  department: CrewDepartment;
  priority: CrewPriority;
}

const PRIORITY_ORDER: Record<CrewPriority, number> = { high: 0, medium: 1, low: 2 };

// Mapping from element categories to suggested crew roles
const ELEMENT_TO_CREW_MAP: Record<string, CrewMapping[]> = {
  PROP: [
    { role: 'Prop Master', department: 'ART', priority: 'high' },
    { role: 'Set Dresser', department: 'ART', priority: 'medium' },
  ],
  CAMERA: [
    { role: 'Director of Photography', department: 'CAMERA', priority: 'high' },
    { role: '1st AC', department: 'CAMERA', priority: 'medium' },
  ],
  GRIP: [
    { role: 'Key Grip', department: 'LIGHTING', priority: 'medium' },
  ],
  ELECTRIC: [
    { role: 'Gaffer', department: 'LIGHTING', priority: 'high' },
    { role: 'Best Boy Electric', department: 'LIGHTING', priority: 'medium' },
  ],
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
  LOCATION_NOTES: [
    { role: 'Location Manager', department: 'LOCATIONS', priority: 'high' },
  ],
  SECURITY: [
    { role: 'Security Coordinator', department: 'PRODUCTION', priority: 'medium' },
  ],
};

const SMALL_PRODUCTION_BASELINE: CrewMapping[] = [
  { role: 'Director', department: 'DIRECTION', priority: 'high' },
  { role: 'Producer', department: 'PRODUCTION', priority: 'high' },
  { role: '1st Assistant Director', department: 'DIRECTION', priority: 'high' },
  { role: 'Director of Photography', department: 'CAMERA', priority: 'high' },
  { role: 'Production Sound Mixer', department: 'SOUND', priority: 'medium' },
  { role: 'Production Designer', department: 'ART', priority: 'medium' },
  { role: 'Gaffer', department: 'LIGHTING', priority: 'medium' },
  { role: 'Key Grip', department: 'LIGHTING', priority: 'medium' },
  { role: 'Script Supervisor', department: 'DIRECTION', priority: 'medium' },
  { role: 'Location Manager', department: 'LOCATIONS', priority: 'medium' },
  { role: 'Costume Designer', department: 'COSTUME', priority: 'medium' },
  { role: 'Makeup Department Head', department: 'HAIR_MAKEUP', priority: 'medium' },
];

const LARGE_PRODUCTION_ADDITIONS: CrewMapping[] = [
  { role: 'Line Producer', department: 'PRODUCTION', priority: 'high' },
  { role: 'Unit Production Manager', department: 'PRODUCTION', priority: 'high' },
  { role: 'Production Coordinator', department: 'PRODUCTION', priority: 'medium' },
  { role: '2nd Assistant Director', department: 'DIRECTION', priority: 'medium' },
  { role: 'Transportation Coordinator', department: 'TRANSPORTATION', priority: 'medium' },
  { role: 'Accounting Manager', department: 'ACCOUNTING', priority: 'low' },
  { role: 'Catering Coordinator', department: 'CATERING', priority: 'low' },
];

const STUNT_AND_SAFETY_ADDITIONS: CrewMapping[] = [
  { role: 'Stunt Coordinator', department: 'STUNTS', priority: 'high' },
  { role: 'Safety Coordinator', department: 'PRODUCTION', priority: 'high' },
  { role: 'Security Coordinator', department: 'PRODUCTION', priority: 'high' },
];

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

    await tracker.updateProgress(0, suggestions.length, `Creating ${suggestions.length} crew suggestions...`);

    // Save to database + auto-create crew members so suggestions are immediately actionable.
    const supabase = createAdminClient();
    const { data: existingCrew } = await supabase
      .from('CrewMember')
      .select('id, role, department')
      .eq('projectId', context.projectId);

    const crewByRoleDepartment = new Map<string, string>();
    for (const member of existingCrew || []) {
      const key = `${member.department}::${member.role.toLowerCase().trim()}`;
      crewByRoleDepartment.set(key, member.id);
    }

    const records = [];
    for (const suggestion of suggestions) {
      const roleKey = `${suggestion.department}::${suggestion.role.toLowerCase().trim()}`;
      let crewMemberId = crewByRoleDepartment.get(roleKey) || null;

      if (!crewMemberId) {
        const { data: newCrewMember, error: crewError } = await supabase
          .from('CrewMember')
          .insert({
            projectId: context.projectId,
            name: `TBD - ${suggestion.role}`,
            role: suggestion.role,
            department: suggestion.department,
            isHead: false,
          })
          .select('id')
          .single();

        if (!crewError && newCrewMember?.id) {
          crewMemberId = newCrewMember.id;
          crewByRoleDepartment.set(roleKey, newCrewMember.id);
        }
      }

      records.push({
        projectId: context.projectId,
        jobId: context.jobId,
        role: suggestion.role,
        department: suggestion.department,
        reason: suggestion.reason,
        priority: suggestion.priority,
        accepted: crewMemberId ? true : null,
        crewMemberId,
      });
    }

    const { error } = await supabase.from('CrewSuggestion').insert(records);

    if (error) {
      console.error('[CrewSuggester] Failed to save suggestions:', error);
      // Non-blocking: return success even if DB save fails
      return { success: true, shouldContinue: true };
    }

    await tracker.updateProgress(
      suggestions.length,
      suggestions.length,
      `Suggested ${suggestions.length} crew roles`
    );

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

  const productionScope = inferProductionScope(context, elementCounts);
  addBaselineCrewSuggestions(suggestions, productionScope, elementCounts);

  // Generate suggestions based on element categories
  for (const [category, count] of elementCounts) {
    const crewMappings = ELEMENT_TO_CREW_MAP[category];
    if (!crewMappings) continue;

    for (const mapping of crewMappings) {
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

      upsertSuggestion(
        suggestions,
        {
          role: mapping.role,
          department: mapping.department,
          reason,
          priority,
        },
        true
      );
    }
  }

  // Check for exterior/night scenes that may need specialized crew
  const exteriorScenes = context.extractedScenes.filter(
    (s) => s.intExt === 'EXT' || s.intExt === 'BOTH'
  );
  if (exteriorScenes.length > 5) {
    upsertSuggestion(
      suggestions,
      {
        role: 'Location Manager',
        department: 'LOCATIONS',
        reason: `Script has ${exteriorScenes.length} exterior scenes requiring location management`,
        priority: 'high',
      },
      true
    );
  }

  // Sort by priority (high first)
  return Array.from(suggestions.values()).sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

function normalizeCrewKey(department: string, role: string): string {
  return `${department}::${role.toLowerCase().trim()}`;
}

function upsertSuggestion(
  suggestions: Map<string, SuggestedCrewRole>,
  suggestion: SuggestedCrewRole,
  replaceBaseline = false
): void {
  const key = normalizeCrewKey(suggestion.department, suggestion.role);
  const existing = suggestions.get(key);

  if (!existing) {
    suggestions.set(key, suggestion);
    return;
  }

  const higherPriority =
    PRIORITY_ORDER[suggestion.priority] < PRIORITY_ORDER[existing.priority];
  const existingIsBaseline = existing.reason.startsWith('Baseline crew');

  if (higherPriority) {
    suggestions.set(key, suggestion);
    return;
  }

  if (replaceBaseline && existingIsBaseline) {
    suggestions.set(key, {
      ...suggestion,
      priority: existing.priority,
    });
  }
}

function inferProductionScope(
  context: AgentContext,
  elementCounts: Map<string, number>
): 'small' | 'large' {
  const sceneCount = context.extractedScenes.length;
  const elementCount = context.extractedElements.length;
  const backgroundCount = elementCounts.get('BACKGROUND') || 0;
  const locationNotesCount = elementCounts.get('LOCATION_NOTES') || 0;
  const stuntCount = elementCounts.get('STUNT') || 0;

  if (
    sceneCount >= 45 ||
    elementCount >= 180 ||
    backgroundCount >= 6 ||
    locationNotesCount >= 8 ||
    stuntCount >= 3
  ) {
    return 'large';
  }

  return 'small';
}

function addBaselineCrewSuggestions(
  suggestions: Map<string, SuggestedCrewRole>,
  productionScope: 'small' | 'large',
  elementCounts: Map<string, number>
): void {
  const baselineReason =
    productionScope === 'large'
      ? 'Baseline crew for a larger production scope inferred from script complexity'
      : 'Baseline crew for a lean production scope inferred from script complexity';

  for (const template of SMALL_PRODUCTION_BASELINE) {
    upsertSuggestion(suggestions, {
      role: template.role,
      department: template.department,
      priority: template.priority,
      reason: baselineReason,
    });
  }

  if (productionScope === 'large') {
    for (const template of LARGE_PRODUCTION_ADDITIONS) {
      upsertSuggestion(suggestions, {
        role: template.role,
        department: template.department,
        priority: template.priority,
        reason: 'Script complexity indicates a larger-unit production team',
      });
    }
  }

  const hasStuntRisk =
    (elementCounts.get('STUNT') || 0) > 0 ||
    (elementCounts.get('SAFETY_NOTES') || 0) > 0 ||
    (elementCounts.get('SECURITY') || 0) > 0;

  if (hasStuntRisk) {
    for (const template of STUNT_AND_SAFETY_ADDITIONS) {
      upsertSuggestion(suggestions, {
        role: template.role,
        department: template.department,
        priority: template.priority,
        reason: 'Stunt/safety indicators in script require dedicated safety and security coverage',
      });
    }
  }
}
