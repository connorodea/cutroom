import { describe, it, expect } from "vitest";
import { planHighlights } from "./highlights";
import type { Word } from "./transcribe";

const w = (word: string, start: number, end: number): Word => ({ word, start, end });
const lens = (hs: { start: number; end: number }[]) => hs.map((h) => Math.round((h.end - h.start) * 100) / 100);

describe("planHighlights", () => {
  it("returns one highlight for a single gap-free run", () => {
    const hs = planHighlights([w("a", 0, 1), w("b", 1, 2), w("c", 2, 3)], 3);
    expect(hs).toEqual([{ start: 0, end: 3, text: "a b c" }]);
  });

  it("splits at a long gap and keeps both runs", () => {
    const hs = planHighlights([w("a", 0, 2), w("b", 3, 5)], 5);
    expect(hs).toHaveLength(2);
    expect(hs[0].start).toBe(0);
    expect(hs[1].start).toBe(3);
  });

  it("drops runs shorter than minLen", () => {
    const hs = planHighlights([w("a", 0, 0.5), w("b", 3, 6)], 6);
    expect(hs).toHaveLength(1);
    expect(hs[0].start).toBe(3);
  });

  it("caps a long run to maxLen", () => {
    const hs = planHighlights([w("a", 0, 10), w("b", 10, 20), w("c", 20, 30), w("d", 30, 40)], 40, { maxLen: 30 });
    expect(hs[0].end).toBe(30);
  });

  it("respects count, picking the longest runs in chronological order", () => {
    const words = [
      w("a", 0, 3), // run1: 3s
      w("b", 4, 6), // run2: 2s
      w("c", 7, 11), // run3: 4s
    ];
    const hs = planHighlights(words, 11, { count: 2 });
    expect(hs).toHaveLength(2);
    expect(lens(hs)).toEqual([3, 4]); // run1 then run3, chronological — run2 (2s) dropped
  });

  it("returns [] when there are no words", () => {
    expect(planHighlights([], 0)).toEqual([]);
  });

  it("falls back to each run's own end when no total duration is given", () => {
    // totalDur 0 (unknown) must not clamp the run end to 0 — it falls back to r.end.
    const hs = planHighlights([w("a", 0, 1), w("b", 1, 2)], 0);
    expect(hs).toEqual([{ start: 0, end: 2, text: "a b" }]);
  });
});
