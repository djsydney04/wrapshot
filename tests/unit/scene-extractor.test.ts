import { describe, expect, it } from 'vitest';
import { normalizeExtractedSceneForChunk } from '@/lib/agents/script-analysis/scene-extractor';

describe('scene-extractor normalization', () => {
  it('normalizes snake_case scene payloads', () => {
    const normalized = normalizeExtractedSceneForChunk(
      {
        scene_number: '12A',
        int_ext: 'INT/EXT',
        set_name: 'CITY STREET',
        time_of_day: 'night',
        page_length_eighths: 6,
        synopsis: 'A chase erupts.',
        characters: ['alex', 'sam'],
        script_page_start: 3,
        script_page_end: 3.75,
      },
      1,
      1
    );

    expect(normalized).not.toBeNull();
    expect(normalized?.sceneNumber).toBe('12A');
    expect(normalized?.intExt).toBe('BOTH');
    expect(normalized?.setName).toBe('CITY STREET');
    expect(normalized?.timeOfDay).toBe('NIGHT');
    expect(normalized?.characters).toEqual(['ALEX', 'SAM']);
  });

  it('drops placeholder synopsis text and flags missing synopsis', () => {
    const normalized = normalizeExtractedSceneForChunk(
      {
        sceneNumber: '4',
        intExt: 'INT',
        setName: 'OFFICE',
        synopsis: 'Auto-detected from scene heading.',
        characters: ['MAYA'],
      },
      1,
      4
    );

    expect(normalized?.synopsis).toBe('');
    expect(normalized?.warnings).toContain('missing_synopsis');
  });
});
