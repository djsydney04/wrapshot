import { describe, expect, it, vi } from 'vitest';
import { executeTimeEstimator } from '@/lib/agents/script-analysis/time-estimator';
import type { AgentContext, ExtractedScene } from '@/lib/agents/types';
import type { ProgressTracker } from '@/lib/agents/orchestrator/progress-tracker';

function makeBaseContext(scenes: ExtractedScene[]): AgentContext {
  return {
    jobId: 'job-1',
    projectId: 'project-1',
    scriptId: 'script-1',
    userId: 'user-1',
    knownCharacters: [],
    knownLocations: [],
    lastSceneNumber: 0,
    totalPages: 120,
    extractedScenes: scenes,
    extractedElements: [],
    linkedCast: [],
    createdSceneIds: [],
    createdElementIds: [],
    createdCastIds: [],
    suggestedCrewRoles: [],
    sceneWarnings: [],
  };
}

describe('executeTimeEstimator', () => {
  it('adds setup overhead on first use of a location', async () => {
    const scenes: ExtractedScene[] = [
      {
        sceneNumber: '1',
        intExt: 'INT',
        setName: 'APARTMENT KITCHEN',
        timeOfDay: 'DAY',
        pageLengthEighths: 4,
        synopsis: 'Two characters talk through a plan.',
        characters: ['ALEX', 'SAM'],
        scriptPageStart: 1,
        scriptPageEnd: 1.5,
      },
      {
        sceneNumber: '2',
        intExt: 'INT',
        setName: 'APARTMENT KITCHEN',
        timeOfDay: 'DAY',
        pageLengthEighths: 4,
        synopsis: 'They continue the same conversation.',
        characters: ['ALEX', 'SAM'],
        scriptPageStart: 1.5,
        scriptPageEnd: 2,
      },
    ];

    const context = makeBaseContext(scenes);
    const tracker = {
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProgressTracker;

    const result = await executeTimeEstimator(context, tracker);

    expect(result.success).toBe(true);
    expect(context.extractedScenes[0]?.estimatedHours).toBeGreaterThan(
      context.extractedScenes[1]?.estimatedHours || 0
    );
  });

  it('assigns higher estimates for complex exterior night action scenes', async () => {
    const scenes: ExtractedScene[] = [
      {
        sceneNumber: '10',
        intExt: 'INT',
        setName: 'OFFICE',
        timeOfDay: 'DAY',
        pageLengthEighths: 8,
        synopsis: 'A short meeting.',
        characters: ['ALEX', 'SAM'],
        scriptPageStart: 10,
        scriptPageEnd: 11,
      },
      {
        sceneNumber: '11',
        intExt: 'EXT',
        setName: 'HIGHWAY OVERPASS',
        timeOfDay: 'NIGHT',
        pageLengthEighths: 8,
        synopsis: 'A chase ends with a fiery crash and fight.',
        characters: ['ALEX', 'SAM', 'TEAM1', 'TEAM2', 'TEAM3', 'TEAM4'],
        scriptPageStart: 11,
        scriptPageEnd: 12,
      },
    ];

    const context = makeBaseContext(scenes);
    context.extractedElements = [
      {
        category: 'STUNT',
        name: 'Car chase',
        sceneNumbers: ['11'],
      },
      {
        category: 'SFX',
        name: 'Crash fire',
        sceneNumbers: ['11'],
      },
    ];

    const tracker = {
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProgressTracker;

    await executeTimeEstimator(context, tracker);

    expect(context.extractedScenes[1]?.estimatedHours).toBeGreaterThan(
      context.extractedScenes[0]?.estimatedHours || 0
    );
  });
});
