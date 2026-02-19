interface SceneSortDecorator<T> {
  item: T;
  index: number;
  page: number | null;
}

export function normalizeSceneNumber(
  rawSceneNumber: string | null | undefined,
  fallbackIndex: number
): string {
  const cleaned = String(rawSceneNumber || "")
    .trim()
    .replace(/^SCENE\s+/i, "");

  if (cleaned.length > 0) {
    return cleaned;
  }

  return String(fallbackIndex);
}

export function adjustChunkLocalPage(
  rawPage: number | null | undefined,
  chunkPageStart: number
): number | null {
  if (rawPage === null || rawPage === undefined || Number.isNaN(rawPage)) {
    return null;
  }

  const page = Number(rawPage);
  if (!Number.isFinite(page) || page <= 0) {
    return null;
  }

  if (chunkPageStart <= 1) {
    return page;
  }

  // LLM responses for chunked prompts often restart pages at 1.
  if (page < chunkPageStart && page <= 15) {
    return chunkPageStart - 1 + page;
  }

  return page;
}

export function sortByScriptPageOrder<T>(
  items: T[],
  getScriptPageStart: (item: T) => number | null | undefined
): T[] {
  const decorated: SceneSortDecorator<T>[] = items.map((item, index) => ({
    item,
    index,
    page: getFinitePositiveNumber(getScriptPageStart(item)),
  }));

  decorated.sort((a, b) => {
    if (a.page === null && b.page === null) {
      return a.index - b.index;
    }
    if (a.page === null) return 1;
    if (b.page === null) return -1;
    if (a.page !== b.page) return a.page - b.page;
    return a.index - b.index;
  });

  return decorated.map((entry) => entry.item);
}

export function dedupeBySceneNumberAndSet<T>(
  items: T[],
  getSceneNumber: (item: T) => string | null | undefined,
  getSetName: (item: T) => string | null | undefined
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const normalizedSceneNumber = normalizeSceneNumberKey(getSceneNumber(item));
    const normalizedSet = normalizeSetName(getSetName(item));

    // Do not dedupe scenes that do not have a reliable scene number.
    if (!normalizedSceneNumber) {
      deduped.push(item);
      continue;
    }

    const key = `${normalizedSceneNumber}::${normalizedSet}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function getFinitePositiveNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

function normalizeSceneNumberKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .replace(/^SCENE\s+/i, "")
    .toUpperCase();
}

function normalizeSetName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}
