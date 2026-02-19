export type PostIngestBatchStatus = "QUEUED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED";

export interface IngestCounters {
  expectedRollCount: number;
  receivedRollCount: number;
  qcPassedCount: number;
  qcFailedCount: number;
  missingRollCount: number;
}

export function normalizeRolls(rolls: string[]): string[] {
  const normalized = rolls
    .map((roll) => roll.trim())
    .filter((roll) => roll.length > 0)
    .map((roll) => roll.toUpperCase());

  return Array.from(new Set(normalized));
}

export function deriveIngestBatchStatus(counters: IngestCounters): {
  status: PostIngestBatchStatus;
  blockerCount: number;
} {
  const blockerCount = counters.qcFailedCount + counters.missingRollCount;

  if (counters.receivedRollCount === 0) {
    return { status: "QUEUED", blockerCount };
  }

  if (blockerCount > 0) {
    return { status: "BLOCKED", blockerCount };
  }

  if (counters.receivedRollCount < counters.expectedRollCount) {
    return { status: "IN_PROGRESS", blockerCount };
  }

  return { status: "COMPLETE", blockerCount };
}

export function stripAutoSection(
  existing: string | null,
  startMarker: string,
  endMarker: string
): string {
  if (!existing) return "";

  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "g");

  return existing.replace(regex, "").trim();
}

export function buildPostAlertSection(lines: string[]): string | null {
  if (lines.length === 0) return null;

  return ["Post blockers (auto-synced):", ...lines.map((line) => `- ${line}`)].join("\n");
}

export function mergeAutoSection(
  existing: string | null,
  sectionBody: string | null,
  startMarker: string,
  endMarker: string
): string | null {
  const manualText = stripAutoSection(existing, startMarker, endMarker);

  if (!sectionBody) {
    return manualText || null;
  }

  const autoSection = [startMarker, sectionBody, endMarker].join("\n");
  return manualText ? `${manualText}\n\n${autoSection}` : autoSection;
}
