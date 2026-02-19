import { describe, expect, it } from "vitest";
import {
  adjustChunkLocalPage,
  dedupeBySceneNumberAndSet,
  normalizeSceneNumber,
  sortByScriptPageOrder,
} from "@/lib/scripts/scene-order";

describe("scene-order helpers", () => {
  it("normalizes scene numbers with fallback for missing values", () => {
    expect(normalizeSceneNumber(" 12A ", 9)).toBe("12A");
    expect(normalizeSceneNumber("", 9)).toBe("9");
    expect(normalizeSceneNumber(null, 9)).toBe("9");
  });

  it("adjusts local chunk pages to global script pages", () => {
    expect(adjustChunkLocalPage(1, 21)).toBe(21);
    expect(adjustChunkLocalPage(3, 21)).toBe(23);
    expect(adjustChunkLocalPage(27, 21)).toBe(27);
    expect(adjustChunkLocalPage(null, 21)).toBe(null);
  });

  it("sorts by script page while preserving stable order for ties", () => {
    const scenes = [
      { id: "c", page: 3 },
      { id: "a", page: 1 },
      { id: "b", page: 1 },
      { id: "missing", page: null as number | null },
    ];

    const sorted = sortByScriptPageOrder(scenes, (scene) => scene.page);
    expect(sorted.map((scene) => scene.id)).toEqual(["a", "b", "c", "missing"]);
  });

  it("dedupes numbered scene/set duplicates but preserves unnumbered scenes", () => {
    const scenes = [
      { sceneNumber: "10", setName: "Kitchen", id: "first" },
      { sceneNumber: "10", setName: "Kitchen", id: "duplicate" },
      { sceneNumber: "", setName: "Hallway", id: "unnumbered-1" },
      { sceneNumber: "", setName: "Hallway", id: "unnumbered-2" },
    ];

    const deduped = dedupeBySceneNumberAndSet(
      scenes,
      (scene) => scene.sceneNumber,
      (scene) => scene.setName
    );

    expect(deduped.map((scene) => scene.id)).toEqual([
      "first",
      "unnumbered-1",
      "unnumbered-2",
    ]);
  });
});
