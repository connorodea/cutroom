import { describe, it, expect } from "vitest";
import { normalizeCrop, cropFilter, CROP_PRESETS, CROP_PRESET_NAMES } from "./crop";

describe("CROP_PRESETS", () => {
  it("exposes the named regions", () => {
    expect(CROP_PRESET_NAMES).toEqual(["center", "top", "bottom", "left", "right"]);
    expect(CROP_PRESETS.center).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });
});

describe("normalizeCrop", () => {
  it("resolves a named preset", () => {
    expect(normalizeCrop({ preset: "top" })).toEqual({ x: 0, y: 0, w: 1, h: 0.5 });
    expect(normalizeCrop({ preset: "right" })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });

  it("falls back to the center punch-in for an unknown / missing preset", () => {
    expect(normalizeCrop({ preset: "zoomzoom" })).toEqual(CROP_PRESETS.center);
    expect(normalizeCrop({})).toEqual(CROP_PRESETS.center);
  });

  it("applies clamped custom overrides on top of the preset", () => {
    expect(normalizeCrop({ preset: "center", w: "0.4" })).toEqual({ x: 0.25, y: 0.25, w: 0.4, h: 0.5 });
    expect(normalizeCrop({ x: 2 }).x).toBe(0.99);
    expect(normalizeCrop({ w: 0 }).w).toBe(0.01);
  });

  it("shrinks width/height so the region never overruns the frame", () => {
    expect(normalizeCrop({ x: 0.8, w: 0.5 })).toMatchObject({ x: 0.8, w: 0.2 });
    expect(normalizeCrop({ y: 0.7, h: 0.6 })).toMatchObject({ y: 0.7, h: 0.3 });
  });
});

describe("cropFilter", () => {
  it("builds an even-dimensioned crop expression from fractions", () => {
    expect(cropFilter({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toBe(
      "crop=floor(iw*0.5/2)*2:floor(ih*0.5/2)*2:floor(iw*0.25):floor(ih*0.25)",
    );
  });
});
