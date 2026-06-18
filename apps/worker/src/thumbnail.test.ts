import { describe, it, expect } from "vitest";
import { normalizeThumbTime, thumbArgs } from "./thumbnail";

describe("normalizeThumbTime", () => {
  it("passes a valid time through and parses strings", () => {
    expect(normalizeThumbTime(3, 10)).toBe(3);
    expect(normalizeThumbTime("5", 10)).toBe(5);
  });

  it("defaults a missing/invalid time to the midpoint of the clip", () => {
    expect(normalizeThumbTime(undefined, 10)).toBe(5);
    expect(normalizeThumbTime("nope", 8)).toBe(4);
  });

  it("clamps to [0, duration - 0.05]", () => {
    expect(normalizeThumbTime(99, 10)).toBe(9.95);
    expect(normalizeThumbTime(-2, 10)).toBe(0);
  });

  it("works without a known duration (no clamp; missing → 0)", () => {
    expect(normalizeThumbTime(3, 0)).toBe(3);
    expect(normalizeThumbTime(undefined, 0)).toBe(0);
  });
});

describe("thumbArgs", () => {
  it("builds ffmpeg args to grab a single frame at the time", () => {
    expect(thumbArgs("in.mp4", "out.png", 3)).toEqual([
      "-y", "-i", "in.mp4", "-ss", "3.00", "-frames:v", "1", "out.png",
    ]);
  });
});
