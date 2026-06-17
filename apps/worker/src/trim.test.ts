import { describe, it, expect } from "vitest";
import { normalizeTrim, trimArgs } from "./trim";

describe("normalizeTrim", () => {
  it("passes a valid window through", () => {
    expect(normalizeTrim(5, 12, 30)).toEqual({ start: 5, end: 12 });
  });

  it("parses string inputs", () => {
    expect(normalizeTrim("3.5", "9", 30)).toEqual({ start: 3.5, end: 9 });
  });

  it("clamps a negative start to 0", () => {
    expect(normalizeTrim(-4, 10, 30)).toEqual({ start: 0, end: 10 });
  });

  it("clamps an end past the duration", () => {
    expect(normalizeTrim(5, 99, 30)).toEqual({ start: 5, end: 30 });
  });

  it("falls back to the end of the clip when end <= start", () => {
    expect(normalizeTrim(10, 4, 30)).toEqual({ start: 10, end: 30 });
  });

  it("defaults a missing/invalid end to the duration", () => {
    expect(normalizeTrim(8, "nope", 30)).toEqual({ start: 8, end: 30 });
  });

  it("rounds to centiseconds", () => {
    expect(normalizeTrim(1.111, 2.666, 30)).toEqual({ start: 1.11, end: 2.67 });
  });

  it("works without a known duration (end defaults to start + 1s)", () => {
    expect(normalizeTrim(3, 8, 0)).toEqual({ start: 3, end: 8 });
    expect(normalizeTrim(3, undefined, 0)).toEqual({ start: 3, end: 4 });
  });
});

describe("trimArgs", () => {
  it("builds frame-accurate re-encoding ffmpeg args for the window", () => {
    const args = trimArgs("in.mp4", "out.mp4", { start: 5, end: 12 });
    expect(args[0]).toBe("-y");
    // -ss / -to come AFTER -i for accurate, absolute-timestamp trimming.
    const i = args.indexOf("-i");
    expect(args[i + 1]).toBe("in.mp4");
    expect(args.slice(i + 2, i + 6)).toEqual(["-ss", "5.00", "-to", "12.00"]);
    expect(args).toContain("libx264");
    expect(args[args.length - 1]).toBe("out.mp4");
  });
});
