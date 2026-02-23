import { describe, expect, it } from 'vitest';
import {
  normalizeGeneratedSynopsis,
  shouldRegenerateSceneSynopsis,
} from '@/lib/agents/script-analysis/synopsis-generator';

const BASE_SCENE = {
  synopsis: '',
  setName: 'APARTMENT KITCHEN',
  timeOfDay: 'NIGHT',
  intExt: 'INT' as const,
  characters: ['ALEX', 'SAM'],
};

describe('synopsis-generator', () => {
  it('marks placeholder synopses for regeneration', () => {
    expect(
      shouldRegenerateSceneSynopsis({
        ...BASE_SCENE,
        synopsis: 'Auto-detected from scene heading.',
      })
    ).toBe(true);

    expect(
      shouldRegenerateSceneSynopsis({
        ...BASE_SCENE,
        synopsis: 'ALEX confronts SAM about the missing footage in the kitchen.',
      })
    ).toBe(false);
  });

  it('normalizes generated text and limits to two sentences', () => {
    const cleaned = normalizeGeneratedSynopsis(
      'Synopsis: Scene 12: Alex storms into the apartment. Sam refuses to answer. They leave.',
      BASE_SCENE
    );

    expect(cleaned).toBe(
      'Alex storms into the apartment. Sam refuses to answer.'
    );
  });

  it('falls back to deterministic scene context when generation is empty', () => {
    const cleaned = normalizeGeneratedSynopsis('N/A', BASE_SCENE);

    expect(cleaned).toContain('APARTMENT KITCHEN');
    expect(cleaned).toContain('NIGHT');
  });
});
