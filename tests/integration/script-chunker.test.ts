import { describe, expect, it } from 'vitest';
import { ScriptChunker } from '@/lib/agents/script-analysis/chunker';
import { isLikelySceneHeaderLine } from '@/lib/scripts/scene-heuristics';

function buildLongSceneScript(sceneCount: number): string {
  const sections: string[] = [];

  for (let i = 1; i <= sceneCount; i++) {
    sections.push(`INT. LOCATION ${i} - DAY`);
    sections.push(`Scene ${i} action starts.`);
    sections.push('Action line. '.repeat(80));
    sections.push('');
  }

  return sections.join('\n');
}

describe('ScriptChunker', () => {
  it('splits feature-length scripts at scene boundaries', () => {
    const scriptText = buildLongSceneScript(12);
    const chunker = ScriptChunker.create({
      maxCharsPerChunk: 1300,
      minCharsPerChunk: 400,
    });

    const { chunks } = chunker.chunk(scriptText, 'job-1', 'script-1');

    expect(chunks.length).toBeGreaterThan(1);

    const chunksWithEarlyHeaders = chunks.filter((chunk) => {
      expect(chunk.chunkText.length).toBeGreaterThan(100);

      const firstLines = chunk.chunkText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 12);
      return firstLines.some((line) => isLikelySceneHeaderLine(line));
    });

    expect(chunksWithEarlyHeaders.length).toBeGreaterThanOrEqual(
      Math.ceil(chunks.length * 0.6)
    );
  });

  it('creates stable fallback chunks when no scene headings are present', () => {
    const scriptText = 'Dialogue and action. '.repeat(3000);
    const chunker = ScriptChunker.create({
      maxCharsPerChunk: 2000,
      minCharsPerChunk: 600,
    });

    const { chunks } = chunker.chunk(scriptText, 'job-2', 'script-2');

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.chunkText.length > 0)).toBe(true);
    expect(chunks.every((chunk) => chunk.chunkText.length <= 2800)).toBe(true);
  });
});
