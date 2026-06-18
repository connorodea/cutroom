import { describe, it, expect } from "vitest";
import { normalizeLoopCount, loopFilter } from "./loop";

describe("normalizeLoopCount", () => {
  it("passes a valid count through and parses strings", () => {
    expect(normalizeLoopCount(3)).toBe(3);
    expect(normalizeLoopCount("5")).toBe(5);
  });

  it("rounds, clamps to [2, 10], and defaults non-finite input to 2", () => {
    expect(normalizeLoopCount(3.7)).toBe(4);
    expect(normalizeLoopCount(99)).toBe(10);
    expect(normalizeLoopCount(1)).toBe(2); // looping once is a no-op
    expect(normalizeLoopCount("x")).toBe(2);
  });
});

describe("loopFilter", () => {
  it("splits and concatenates video + audio for an audio clip", () => {
    expect(loopFilter(2, true)).toEqual({
      filter: "[0:v]split=2[v0][v1];[0:a]asplit=2[a0][a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
      maps: ["[v]", "[a]"],
    });
  });

  it("loops video only when there is no audio track", () => {
    expect(loopFilter(2, false)).toEqual({
      filter: "[0:v]split=2[v0][v1];[v0][v1]concat=n=2:v=1:a=0[v]",
      maps: ["[v]"],
    });
  });

  it("interleaves N video/audio pairs for a 3x loop", () => {
    expect(loopFilter(3, true)).toEqual({
      filter:
        "[0:v]split=3[v0][v1][v2];[0:a]asplit=3[a0][a1][a2];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]",
      maps: ["[v]", "[a]"],
    });
  });
});
