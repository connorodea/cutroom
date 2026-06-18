import { describe, it, expect } from "vitest";
import {
  LETTERBOX_PRESETS,
  LETTERBOX_RATIOS,
  normalizeLetterboxPreset,
  letterboxBarHeight,
  letterboxFilter,
} from "./letterbox";

describe("normalizeLetterboxPreset", () => {
  it("lists the presets and their ratios", () => {
    expect(LETTERBOX_PRESETS).toEqual(["cinema", "wide", "classic"]);
    expect(LETTERBOX_RATIOS.cinema).toBeCloseTo(2.39);
    expect(LETTERBOX_RATIOS.wide).toBeCloseTo(2.0);
    expect(LETTERBOX_RATIOS.classic).toBeCloseTo(1.85);
  });

  it("accepts known presets and defaults the rest to cinema", () => {
    expect(normalizeLetterboxPreset("wide")).toBe("wide");
    expect(normalizeLetterboxPreset("classic")).toBe("classic");
    expect(normalizeLetterboxPreset("cinema")).toBe("cinema");
    expect(normalizeLetterboxPreset("imax")).toBe("cinema");
    expect(normalizeLetterboxPreset(undefined)).toBe("cinema");
  });
});

describe("letterboxBarHeight", () => {
  it("computes an even bar height for the target ratio", () => {
    expect(letterboxBarHeight(1920, 1080, 2.39)).toBe(138);
    expect(letterboxBarHeight(320, 240, 2.0)).toBe(40);
  });

  it("returns 0 when the clip is already wider than the target", () => {
    expect(letterboxBarHeight(640, 240, 2.39)).toBe(0);
  });
});

describe("letterboxFilter", () => {
  it("draws a black bar at the top and bottom", () => {
    const { vf, bar } = letterboxFilter(320, 240, 2.39);
    expect(bar).toBe(54);
    expect(vf).toBe(
      "drawbox=x=0:y=0:w=320:h=54:color=black:t=fill,drawbox=x=0:y=186:w=320:h=54:color=black:t=fill",
    );
  });

  it("is a no-op when no bars are needed", () => {
    const { vf, bar } = letterboxFilter(640, 240, 2.39);
    expect(bar).toBe(0);
    expect(vf).toBe("null");
  });
});
