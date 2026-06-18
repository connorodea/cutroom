import { describe, it, expect } from "vitest";
import {
  RGB_STRENGTHS,
  RGB_SHIFTS,
  normalizeRgbStrength,
  rgbSplitFilter,
} from "./rgbsplit";

describe("normalizeRgbStrength", () => {
  it("lists the strengths and their pixel shifts", () => {
    expect(RGB_STRENGTHS).toEqual(["light", "medium", "heavy"]);
    expect(RGB_SHIFTS.light).toBe(4);
    expect(RGB_SHIFTS.medium).toBe(10);
    expect(RGB_SHIFTS.heavy).toBe(20);
  });

  it("accepts known strengths and defaults the rest to medium", () => {
    expect(normalizeRgbStrength("light")).toBe("light");
    expect(normalizeRgbStrength("heavy")).toBe("heavy");
    expect(normalizeRgbStrength("medium")).toBe("medium");
    expect(normalizeRgbStrength("nuclear")).toBe("medium");
    expect(normalizeRgbStrength(undefined)).toBe("medium");
  });
});

describe("rgbSplitFilter", () => {
  it("shifts the red channel right and the blue channel left by the same amount", () => {
    expect(rgbSplitFilter(10)).toBe("rgbashift=rh=10:bh=-10");
    expect(rgbSplitFilter(4)).toBe("rgbashift=rh=4:bh=-4");
    expect(rgbSplitFilter(20)).toBe("rgbashift=rh=20:bh=-20");
  });
});
