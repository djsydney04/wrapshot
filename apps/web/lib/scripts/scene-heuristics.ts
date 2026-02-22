import { normalizeSceneNumber } from '@/lib/scripts/scene-order';

export interface HeuristicScene {
  sceneNumber: string;
  intExt: 'INT' | 'EXT' | 'BOTH';
  setName: string;
  timeOfDay: string;
  pageLengthEighths: number;
  synopsis: string;
  characters: string[];
  scriptPageStart: number;
  scriptPageEnd: number;
}

export interface HeuristicSceneOptions {
  chunkPageStart?: number;
  chunkPageEnd?: number;
  startingSceneNumber?: number;
}

const HEURISTIC_CHARS_PER_PAGE = 1500;
const HEURISTIC_SCENE_HEADER_PATTERN =
  /^(?:(\d+[A-Z]?)\s+)?((?:INT|EXT)(?:\s*\.?\s*\/\s*(?:INT|EXT))?|INT\/EXT|EXT\/INT|I\/E)\.?\s+(.+)$/i;
const VALID_TIMES_OF_DAY = [
  'DAY',
  'NIGHT',
  'DAWN',
  'DUSK',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'CONTINUOUS',
] as const;

const TIME_OF_DAY_ALIASES: Record<string, string> = {
  SUNRISE: 'DAWN',
  SUNSET: 'DUSK',
  LATER: 'CONTINUOUS',
  'MOMENTS LATER': 'CONTINUOUS',
  'SAME TIME': 'CONTINUOUS',
};

export function extractHeuristicScenesFromChunkText(
  chunkText: string,
  options: HeuristicSceneOptions = {}
): HeuristicScene[] {
  const text = String(chunkText || '');
  if (!text.trim()) {
    return [];
  }

  const lines = text.split('\n');
  let charOffset = 0;

  const headers: Array<{
    offset: number;
    sceneNumber: string | null;
    intExt: 'INT' | 'EXT' | 'BOTH';
    setName: string;
    timeOfDay: string;
  }> = [];

  for (const line of lines) {
    const parsed = parseSceneHeader(line);
    if (parsed) {
      headers.push({
        offset: charOffset,
        ...parsed,
      });
    }
    charOffset += line.length + 1;
  }

  if (headers.length === 0) {
    return [];
  }

  const chunkStartPage = typeof options.chunkPageStart === 'number'
    ? Math.max(1, options.chunkPageStart)
    : 1;
  const chunkEndPage = typeof options.chunkPageEnd === 'number'
    ? Math.max(chunkStartPage, options.chunkPageEnd)
    : chunkStartPage + Math.max(0, text.length / HEURISTIC_CHARS_PER_PAGE);
  const chunkPageSpan = Math.max(1, chunkEndPage - chunkStartPage + 1);
  const chunkLength = Math.max(1, text.length);
  let nextAutoSceneNumber = Math.max(1, (options.startingSceneNumber || 0) + 1);

  const extracted: HeuristicScene[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const nextOffset = headers[i + 1]?.offset ?? text.length;
    const sceneCharLength = Math.max(1, nextOffset - header.offset);

    const startPageEstimate = chunkStartPage + (header.offset / chunkLength) * chunkPageSpan;
    const durationPages = Math.max(1 / 8, sceneCharLength / HEURISTIC_CHARS_PER_PAGE);
    const endPageEstimate = startPageEstimate + durationPages;
    const scriptPageStart = roundToEighth(startPageEstimate);
    const scriptPageEnd = Math.max(scriptPageStart, roundToEighth(endPageEstimate));
    const pageLengthEighths = Math.max(
      1,
      Math.round((scriptPageEnd - scriptPageStart) * 8) || Math.round(durationPages * 8)
    );

    const sceneNumber = header.sceneNumber || String(nextAutoSceneNumber);
    const parsedSceneNum = parseSceneNumber(sceneNumber);
    if (parsedSceneNum > 0) {
      nextAutoSceneNumber = Math.max(nextAutoSceneNumber, parsedSceneNum + 1);
    } else {
      nextAutoSceneNumber++;
    }

    extracted.push({
      sceneNumber,
      intExt: header.intExt,
      setName: header.setName,
      timeOfDay: header.timeOfDay,
      pageLengthEighths,
      synopsis: 'Auto-detected from scene heading.',
      characters: [],
      scriptPageStart,
      scriptPageEnd,
    });
  }

  return extracted;
}

export function isLikelySceneHeaderLine(line: string): boolean {
  return parseSceneHeader(line) !== null;
}

export function parseSceneHeader(line: string): {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT' | 'BOTH';
  setName: string;
  timeOfDay: string;
} | null {
  const cleanedLine = normalizeHeaderLine(line);
  if (!cleanedLine) return null;

  const match = cleanedLine.match(HEURISTIC_SCENE_HEADER_PATTERN);
  if (!match) return null;

  const sceneNumber = match[1] ? normalizeSceneNumber(match[1], 1) : null;
  const intExt = normalizeIntExt(match[2]);
  const rest = normalizeHeaderTail(match[3] || '');
  if (!rest) return null;

  const segments = rest
    .split(/\s+-\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return null;

  const tail = segments[segments.length - 1].toUpperCase().replace(/\./g, '').trim();
  const normalizedTail = normalizeTimeAlias(tail);
  const hasTimeOfDay = VALID_TIMES_OF_DAY.some(
    (time) => normalizedTail === time || normalizedTail.startsWith(`${time} `)
  );

  const timeOfDay = hasTimeOfDay ? normalizeTimeOfDay(normalizedTail) : 'DAY';
  const setSegments = hasTimeOfDay ? segments.slice(0, -1) : segments;
  const setName = setSegments.join(' - ').trim() || rest;

  return {
    sceneNumber,
    intExt,
    setName,
    timeOfDay,
  };
}

function normalizeHeaderLine(line: string): string {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .replace(/^[\s\-–—*•.]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeaderTail(value: string): string {
  return String(value || '')
    .replace(/\s*#\d+[A-Z]?#\s*$/i, '')
    .replace(/\s*\(\s*CONT'D\s*\)\s*$/i, '')
    .trim();
}

function normalizeIntExt(value: string): 'INT' | 'EXT' | 'BOTH' {
  const upper = String(value).toUpperCase().trim();
  if (upper.includes('/') || upper === 'BOTH' || upper === 'I/E') {
    return 'BOTH';
  }
  if (upper.startsWith('EXT')) {
    return 'EXT';
  }
  return 'INT';
}

function normalizeTimeAlias(value: string): string {
  return TIME_OF_DAY_ALIASES[value] || value;
}

function normalizeTimeOfDay(value: string): string {
  const upper = String(value).toUpperCase().trim();

  for (const time of VALID_TIMES_OF_DAY) {
    if (upper.includes(time)) {
      return time;
    }
  }

  return 'DAY';
}

function roundToEighth(value: number): number {
  const safe = Number.isFinite(value) ? value : 1;
  return Math.max(1 / 8, Math.round(safe * 8) / 8);
}

function parseSceneNumber(sceneNumber: string): number {
  const match = sceneNumber.match(/^(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}
