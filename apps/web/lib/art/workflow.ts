import { mergeAutoSection, stripAutoSection } from "@/lib/post-production/workflow";
import type { DepartmentDayDependency } from "@/lib/actions/departments-readiness";

export type ArtPullItemStatus =
  | "TO_SOURCE"
  | "PULLED"
  | "ON_TRUCK"
  | "ON_SET"
  | "WRAPPED";

export type ArtReadinessStatus = "NOT_READY" | "IN_PROGRESS" | "READY";

export const ART_ALERT_SECTION_START = "[ART_ALERTS_START]";
export const ART_ALERT_SECTION_END = "[ART_ALERTS_END]";
export const ART_DEPARTMENT_NOTES_START = "[ART_AUTO_BLOCKERS]";
export const ART_DEPARTMENT_NOTES_END = "[/ART_AUTO_BLOCKERS]";

const READY_PULL_STATUSES: ArtPullItemStatus[] = ["ON_SET", "WRAPPED"];

export function isArtPullItemResolved(status: ArtPullItemStatus): boolean {
  return READY_PULL_STATUSES.includes(status);
}

export function formatUpperSnake(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
}

export function computeArtReadiness(
  totalTracked: number,
  blockerCount: number,
): ArtReadinessStatus {
  if (totalTracked <= 0) return "NOT_READY";
  if (blockerCount <= 0) return "READY";
  if (blockerCount < totalTracked) return "IN_PROGRESS";
  return "NOT_READY";
}

export function buildArtAlertSection(alerts: DepartmentDayDependency[]): string | null {
  if (alerts.length === 0) return null;
  return [
    "Art blockers (auto-synced):",
    ...alerts.map((alert) => `- [${alert.severity}] ${alert.message}`),
  ].join("\n");
}

export function mergeArtAdvanceNotes(
  existingAdvanceNotes: string | null,
  alerts: DepartmentDayDependency[],
): string | null {
  return mergeAutoSection(
    existingAdvanceNotes,
    buildArtAlertSection(alerts),
    ART_ALERT_SECTION_START,
    ART_ALERT_SECTION_END,
  );
}

export function mergeArtDepartmentNotes(
  existingNotes: string | null,
  alerts: DepartmentDayDependency[],
): string | null {
  const manualNotes = stripAutoSection(
    existingNotes,
    ART_DEPARTMENT_NOTES_START,
    ART_DEPARTMENT_NOTES_END,
  );

  if (alerts.length === 0) {
    return manualNotes || null;
  }

  const autoLines = [
    ART_DEPARTMENT_NOTES_START,
    "Open art blockers:",
    ...alerts.map((alert) => `- [${alert.severity}] ${alert.message}`),
    ART_DEPARTMENT_NOTES_END,
  ].join("\n");

  return manualNotes ? `${manualNotes}\n\n${autoLines}` : autoLines;
}

