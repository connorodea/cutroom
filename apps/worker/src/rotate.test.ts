import { describe, it, expect } from "vitest";
import { normalizeOrientation, rotateFilter, swapsDimensions, ORIENTATIONS } from "./rotate";

describe("ORIENTATIONS", () => {
  it("exposes the supported orientations", () => {
    expect(ORIENTATIONS).toEqual(["cw", "ccw", "180", "flip-h", "flip-v"]);
  });
});

describe("normalizeOrientation", () => {
  it("passes a valid orientation through", () => {
    expect(normalizeOrientation("ccw")).toBe("ccw");
    expect(normalizeOrientation("flip-v")).toBe("flip-v");
  });

  it("defaults an unknown / missing value to a clockwise quarter turn", () => {
    expect(normalizeOrientation("sideways")).toBe("cw");
    expect(normalizeOrientation(undefined)).toBe("cw");
    expect(normalizeOrientation(42)).toBe("cw");
  });
});

describe("rotateFilter", () => {
  it("maps each orientation to its ffmpeg filter", () => {
    expect(rotateFilter("cw")).toBe("transpose=1");
    expect(rotateFilter("ccw")).toBe("transpose=2");
    expect(rotateFilter("180")).toBe("transpose=1,transpose=1");
    expect(rotateFilter("flip-h")).toBe("hflip");
    expect(rotateFilter("flip-v")).toBe("vflip");
  });
});

describe("swapsDimensions", () => {
  it("is true only for the quarter-turn rotations", () => {
    expect(swapsDimensions("cw")).toBe(true);
    expect(swapsDimensions("ccw")).toBe(true);
    expect(swapsDimensions("180")).toBe(false);
    expect(swapsDimensions("flip-h")).toBe(false);
    expect(swapsDimensions("flip-v")).toBe(false);
  });
});
