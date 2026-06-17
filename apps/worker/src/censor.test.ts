import { describe, it, expect } from "vitest";
import {
  CENSOR_REGIONS,
  normalizeCensorRegion,
  clampCensorStrength,
  censorRect,
  censorFilter,
} from "./censor";

describe("normalizeCensorRegion", () => {
  it("lists the regions", () => {
    expect(CENSOR_REGIONS).toEqual(["center", "top", "bottom", "left", "right"]);
  });

  it("accepts known regions and defaults the rest to center", () => {
    expect(normalizeCensorRegion("top")).toBe("top");
    expect(normalizeCensorRegion("right")).toBe("right");
    expect(normalizeCensorRegion("center")).toBe("center");
    expect(normalizeCensorRegion("nowhere")).toBe("center");
    expect(normalizeCensorRegion(undefined)).toBe("center");
  });
});

describe("clampCensorStrength", () => {
  it("defaults non-finite to 20 and clamps into [2, 50] as an integer", () => {
    expect(clampCensorStrength("nope")).toBe(20);
    expect(clampCensorStrength(0)).toBe(2);
    expect(clampCensorStrength(999)).toBe(50);
    expect(clampCensorStrength(12.6)).toBe(13);
  });
});

describe("censorRect", () => {
  it("returns an even-aligned rect for the center region", () => {
    expect(censorRect("center", 320, 240)).toEqual({ x: 96, y: 72, w: 128, h: 96 });
  });

  it("covers a band across the top and fits within the frame", () => {
    expect(censorRect("top", 320, 240)).toEqual({ x: 0, y: 0, w: 320, h: 82 });
  });

  it("hugs the right edge without overflowing", () => {
    const r = censorRect("right", 320, 240);
    expect(r).toEqual({ x: 212, y: 0, w: 108, h: 240 });
    expect(r.x + r.w).toBeLessThanOrEqual(320);
  });
});

describe("censorFilter", () => {
  it("splits, crops the region, blurs it, and overlays it back", () => {
    const { filter, maps } = censorFilter("center", 320, 240, 20);
    expect(filter).toBe(
      "[0:v]split=2[base][reg];[reg]crop=128:96:96:72,boxblur=20[blur];[base][blur]overlay=96:72[v]",
    );
    expect(maps).toEqual(["[v]"]);
  });

  it("threads the strength + region through", () => {
    const { filter } = censorFilter("top", 320, 240, 8);
    expect(filter).toContain("crop=320:82:0:0,boxblur=8");
    expect(filter).toContain("overlay=0:0[v]");
  });
});
