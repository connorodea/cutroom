import { describe, it, expect } from "vitest";
import {
  VIGNETTE_STRENGTHS,
  VIGNETTE_ANGLES,
  normalizeVignetteStrength,
  vignetteFilter,
} from "./vignette";

describe("normalizeVignetteStrength", () => {
  it("lists the strengths and their angles", () => {
    expect(VIGNETTE_STRENGTHS).toEqual(["subtle", "medium", "strong"]);
    expect(VIGNETTE_ANGLES.subtle).toBe("PI/8");
    expect(VIGNETTE_ANGLES.medium).toBe("PI/5");
    expect(VIGNETTE_ANGLES.strong).toBe("PI/3");
  });

  it("accepts known strengths and defaults the rest to medium", () => {
    expect(normalizeVignetteStrength("subtle")).toBe("subtle");
    expect(normalizeVignetteStrength("strong")).toBe("strong");
    expect(normalizeVignetteStrength("medium")).toBe("medium");
    expect(normalizeVignetteStrength("extreme")).toBe("medium");
    expect(normalizeVignetteStrength(undefined)).toBe("medium");
  });
});

describe("vignetteFilter", () => {
  it("builds the vignette filter at the strength's angle", () => {
    expect(vignetteFilter("medium")).toBe("vignette=angle=PI/5");
    expect(vignetteFilter("strong")).toBe("vignette=angle=PI/3");
    expect(vignetteFilter("subtle")).toBe("vignette=angle=PI/8");
  });
});
