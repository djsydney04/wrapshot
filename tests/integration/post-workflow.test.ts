import { describe, expect, it } from "vitest";
import {
  buildPostAlertSection,
  deriveIngestBatchStatus,
  mergeAutoSection,
  normalizeRolls,
  stripAutoSection,
} from "@/lib/post-production/workflow";

describe("post-production workflow helpers", () => {
  it("normalizes and de-duplicates roll codes", () => {
    expect(normalizeRolls([" a001 ", "A001", "b002", ""]))
      .toEqual(["A001", "B002"]);
  });

  it("derives blocked ingest status when failed or missing media exists", () => {
    const result = deriveIngestBatchStatus({
      expectedRollCount: 10,
      receivedRollCount: 9,
      qcPassedCount: 7,
      qcFailedCount: 1,
      missingRollCount: 1,
    });

    expect(result).toEqual({
      status: "BLOCKED",
      blockerCount: 2,
    });
  });

  it("merges auto-synced post blockers without losing manual notes", () => {
    const section = buildPostAlertSection(["Roll A003 missing", "Checksum mismatch on B002"]);
    const existing = [
      "Keep generators fueled.",
      "",
      "[POST_ALERTS_START]",
      "Old auto section",
      "[POST_ALERTS_END]",
    ].join("\n");

    const merged = mergeAutoSection(
      existing,
      section,
      "[POST_ALERTS_START]",
      "[POST_ALERTS_END]"
    );

    expect(merged).toContain("Keep generators fueled.");
    expect(merged).toContain("Roll A003 missing");
    expect(merged).not.toContain("Old auto section");
  });

  it("strips auto section when no blockers remain", () => {
    const existing = [
      "Manual note",
      "",
      "[POST_ALERTS_START]",
      "Auto note",
      "[POST_ALERTS_END]",
    ].join("\n");

    expect(
      stripAutoSection(existing, "[POST_ALERTS_START]", "[POST_ALERTS_END]")
    ).toBe("Manual note");
  });
});
