export interface PageCountLike {
  pageCount?: number | null;
  pageEighths?: number | null;
}

function toSafeNumber(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value)) return 0;
  return value;
}

export function decimalPagesToEighths(pageCount: number | null | undefined): number {
  const safe = toSafeNumber(pageCount);
  return Math.max(0, Math.round(safe * 8));
}

export function resolvePageEighths(value: PageCountLike): number {
  if (typeof value.pageEighths === "number" && Number.isFinite(value.pageEighths)) {
    return Math.max(0, Math.round(value.pageEighths));
  }
  return decimalPagesToEighths(value.pageCount);
}

export function formatPageEighths(eighths: number): string {
  const safe = Math.max(0, Math.round(toSafeNumber(eighths)));
  const whole = Math.floor(safe / 8);
  const remainder = safe % 8;

  if (safe === 0) return "0";
  if (remainder === 0) return `${whole}`;
  if (whole === 0) return `${remainder}/8`;
  return `${whole} ${remainder}/8`;
}

export function formatDecimalPagesAsEighths(pageCount: number | null | undefined): string {
  return formatPageEighths(decimalPagesToEighths(pageCount));
}

export function formatScenePages(scene: PageCountLike): string {
  return formatPageEighths(resolvePageEighths(scene));
}

export function sumPageEighths(values: PageCountLike[]): number {
  return values.reduce((sum, value) => sum + resolvePageEighths(value), 0);
}
