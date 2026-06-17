import { describe, it, expect } from "vitest";
import { planCuts, planCutsFromRemovedWords, buildAss } from "./edit";
import type { Word } from "./transcribe";

const w = (word: string, start: number, end: number): Word => ({ word, start, end });
const names = (words: Word[]) => words.map((x) => x.word);

describe("planCuts", () => {
  it("keeps one full span when there are no fillers or gaps", () => {
    const words = [w("the", 0, 0.3), w("cat", 0.3, 0.6), w("sat", 0.6, 0.9)];
    const plan = planCuts(words, 0.9);
    expect(plan.segments).toEqual([{ start: 0, end: 0.9 }]);
    expect(names(plan.remapped)).toEqual(["the", "cat", "sat"]);
    expect(plan.removedDur).toBeCloseTo(0, 5);
  });

  it("removes a filler word and drops it from the remapped transcript", () => {
    const words = [w("So", 0, 0.3), w("um", 0.35, 0.5), w("yeah", 0.7, 1.0)];
    const plan = planCuts(words, 1.0);
    expect(names(plan.remapped)).toEqual(["So", "yeah"]);
    expect(plan.removedDur).toBeGreaterThan(0);
    expect(plan.segments.length).toBe(2);
  });

  it("cuts a long silent gap between words", () => {
    const plan = planCuts([w("a", 0, 0.3), w("b", 2.0, 2.3)], 2.3);
    expect(plan.segments.length).toBe(2);
    expect(plan.removedDur).toBeGreaterThan(1);
    expect(names(plan.remapped)).toEqual(["a", "b"]);
  });

  it("keeps filler words when removeFillers is false", () => {
    const plan = planCuts([w("um", 0, 0.3), w("ok", 0.3, 0.6)], 0.6, { removeFillers: false });
    expect(names(plan.remapped)).toEqual(["um", "ok"]);
    expect(plan.segments).toEqual([{ start: 0, end: 0.6 }]);
  });

  it("remaps the first kept word to near zero", () => {
    const plan = planCuts([w("a", 0, 0.3), w("b", 2.0, 2.3)], 2.3);
    expect(plan.remapped[0].start).toBeCloseTo(0, 5);
  });
});

describe("planCutsFromRemovedWords", () => {
  it("removes the spans of the given indices and remaps the rest", () => {
    const words = [w("w0", 0, 0.3), w("w1", 0.4, 0.7), w("w2", 0.8, 1.1)];
    const plan = planCutsFromRemovedWords(words, [1], 1.1);
    expect(names(plan.remapped)).toEqual(["w0", "w2"]);
    expect(plan.segments.length).toBe(2);
    expect(plan.removedDur).toBeGreaterThan(0);
  });

  it("keeps everything in one segment when nothing is removed", () => {
    const words = [w("w0", 0, 0.3), w("w1", 0.4, 0.7)];
    const plan = planCutsFromRemovedWords(words, [], 0.7);
    expect(plan.segments).toEqual([{ start: 0, end: 0.7 }]);
    expect(names(plan.remapped)).toEqual(["w0", "w1"]);
    expect(plan.removedDur).toBeCloseTo(0, 5);
  });

  it("falls back to a single full segment when the only word is removed", () => {
    const plan = planCutsFromRemovedWords([w("only", 0, 0.7)], [0], 0.7);
    expect(plan.segments).toEqual([{ start: 0, end: 0.7 }]);
    expect(plan.remapped).toHaveLength(0);
  });
});

describe("buildAss", () => {
  it("emits a valid header with PlayRes and a Cap style", () => {
    const ass = buildAss([w("hi", 0, 1)], 1280, 720);
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1280");
    expect(ass).toContain("PlayResY: 720");
    expect(ass).toContain("Style: Cap");
  });

  it("groups words into cues of wordsPerCue", () => {
    const words = [w("a", 0, 0.3), w("b", 0.3, 0.6), w("c", 0.6, 0.9), w("d", 0.9, 1.2), w("e", 1.2, 1.5)];
    const ass = buildAss(words, 1280, 720, 2);
    expect((ass.match(/Dialogue:/g) ?? [])).toHaveLength(3); // 2 + 2 + 1
  });

  it("formats the cue start timestamp as H:MM:SS.cs", () => {
    const ass = buildAss([w("hi", 0, 1)], 1280, 720);
    expect(ass).toContain("Dialogue: 0,0:00:00.00,");
  });

  it("joins a cue's words with spaces", () => {
    const ass = buildAss([w("Hello", 0, 0.5), w("world", 0.5, 1)], 1280, 720, 4);
    expect(ass).toContain(",Hello world");
  });
});
