import { describe, expect, it } from 'vitest';
import {
  extractHeuristicScenesFromChunkText,
  isLikelySceneHeaderLine,
} from '@/lib/scripts/scene-heuristics';

describe('scene heuristics', () => {
  it('extracts scene headings and normalizes time-of-day aliases', () => {
    const chunkText = `
INT. OFFICE - DAY
John flips through notes.

EXT. BEACH - SUNSET #12#
Waves crash while Maya walks.

I/E CAR - NIGHT
They argue while driving.
`.trim();

    const scenes = extractHeuristicScenesFromChunkText(chunkText, {
      chunkPageStart: 10,
      chunkPageEnd: 13,
      startingSceneNumber: 20,
    });

    expect(scenes).toHaveLength(3);
    expect(scenes.map((scene) => scene.intExt)).toEqual(['INT', 'EXT', 'BOTH']);
    expect(scenes[1]?.timeOfDay).toBe('DUSK');
    expect(scenes[0]?.sceneNumber).toBe('21');
    expect(scenes[0]?.synopsis).toBe('');
    expect(scenes[0]?.scriptPageStart).toBeGreaterThanOrEqual(10);
    expect(scenes[2]?.scriptPageEnd).toBeGreaterThanOrEqual(
      scenes[2]?.scriptPageStart || 0
    );
  });

  it('extracts likely character cues from scene text', () => {
    const chunkText = `
INT. WAREHOUSE - NIGHT
MAYA
I heard footsteps.

JONAH (V.O.)
Keep moving.
`.trim();

    const scenes = extractHeuristicScenesFromChunkText(chunkText, {
      chunkPageStart: 1,
      startingSceneNumber: 0,
    });

    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.characters).toContain('MAYA');
    expect(scenes[0]?.characters).toContain('JONAH');
  });

  it('detects likely scene headers', () => {
    expect(isLikelySceneHeaderLine('INT. APARTMENT - NIGHT')).toBe(true);
    expect(isLikelySceneHeaderLine('EXT/INT. TRUCK - DAY')).toBe(true);
    expect(isLikelySceneHeaderLine('John sits and thinks.')).toBe(false);
  });
});
