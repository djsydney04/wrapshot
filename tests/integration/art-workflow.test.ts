import { describe, expect, it } from "vitest";
import {
  computeArtReadiness,
  isArtPullItemResolved,
  mergeArtDepartmentNotes,
} from "@/lib/art/workflow";
import type { DepartmentDayDependency } from "@/lib/actions/departments-readiness";

function createAlert(message: string): DepartmentDayDependency {
  return {
    id: `dep-${message}`,
    projectId: "project-1",
    shootingDayId: "day-1",
    department: "ART",
    sourceType: "ART_PULL_ITEM",
    sourceId: "source-1",
    status: "OPEN",
    severity: "CRITICAL",
    message,
    metadata: null,
    createdBy: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe("art workflow helpers", () => {
  it("identifies resolved pull statuses", () => {
    expect(isArtPullItemResolved("ON_SET")).toBe(true);
    expect(isArtPullItemResolved("WRAPPED")).toBe(true);
    expect(isArtPullItemResolved("TO_SOURCE")).toBe(false);
  });

  it("computes readiness from tracked and blocker counts", () => {
    expect(computeArtReadiness(0, 0)).toBe("NOT_READY");
    expect(computeArtReadiness(3, 0)).toBe("READY");
    expect(computeArtReadiness(3, 1)).toBe("IN_PROGRESS");
    expect(computeArtReadiness(3, 3)).toBe("NOT_READY");
  });

  it("merges art blocker notes without losing manual notes", () => {
    const existing = [
      "Manual crew note",
      "",
      "[ART_AUTO_BLOCKERS]",
      "Old blocker note",
      "[/ART_AUTO_BLOCKERS]",
    ].join("\n");
    const result = mergeArtDepartmentNotes(existing, [createAlert("Hero prop unresolved")]);

    expect(result).toContain("Manual crew note");
    expect(result).toContain("Hero prop unresolved");
    expect(result).not.toContain("Old blocker note");
  });

  it("removes auto blocker section when there are no open alerts", () => {
    const existing = [
      "Manual crew note",
      "",
      "[ART_AUTO_BLOCKERS]",
      "Old blocker note",
      "[/ART_AUTO_BLOCKERS]",
    ].join("\n");
    const result = mergeArtDepartmentNotes(existing, []);

    expect(result).toBe("Manual crew note");
  });
});
