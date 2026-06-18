import { describe, it, expect } from "vitest";
import { normalizeColor, colorFilter, COLOR_PRESETS, COLOR_PRESET_NAMES } from "./color";

describe("COLOR_PRESETS", () => {
  it("exposes the named looks", () => {
    expect(COLOR_PRESET_NAMES).toEqual(["none", "vivid", "warm", "cool", "bw", "cinematic"]);
    expect(COLOR_PRESETS.none).toEqual({ brightness: 0, contrast: 1, saturation: 1, gamma: 1, gammaR: 1, gammaB: 1 });
  });
});

describe("normalizeColor", () => {
  it("resolves a named preset", () => {
    expect(normalizeColor({ preset: "vivid" })).toEqual({ brightness: 0, contrast: 1.12, saturation: 1.35, gamma: 1, gammaR: 1, gammaB: 1 });
  });

  it("falls back to the neutral 'none' look for an unknown / missing preset", () => {
    expect(normalizeColor({ preset: "explode" })).toEqual(COLOR_PRESETS.none);
    expect(normalizeColor({})).toEqual(COLOR_PRESETS.none);
  });

  it("applies custom overrides on top of the chosen preset", () => {
    expect(normalizeColor({ preset: "bw", brightness: 0.2 })).toEqual({ brightness: 0.2, contrast: 1.05, saturation: 0, gamma: 1, gammaR: 1, gammaB: 1 });
  });

  it("parses string overrides and clamps to safe ranges", () => {
    expect(normalizeColor({ contrast: "2" }).contrast).toBe(2);
    expect(normalizeColor({ saturation: 9 }).saturation).toBe(3);
    expect(normalizeColor({ brightness: -5 }).brightness).toBe(-1);
    expect(normalizeColor({ gamma: 0 }).gamma).toBe(0.1);
  });
});

describe("colorFilter", () => {
  it("builds the eq filter for a neutral look", () => {
    expect(colorFilter(normalizeColor({ preset: "none" }))).toBe(
      "eq=brightness=0:contrast=1:saturation=1:gamma=1:gamma_r=1:gamma_b=1",
    );
  });

  it("builds the eq filter for a B&W look (saturation 0)", () => {
    expect(colorFilter(normalizeColor({ preset: "bw" }))).toBe(
      "eq=brightness=0:contrast=1.05:saturation=0:gamma=1:gamma_r=1:gamma_b=1",
    );
  });

  it("builds the eq filter for the cinematic look", () => {
    expect(colorFilter(normalizeColor({ preset: "cinematic" }))).toBe(
      "eq=brightness=-0.02:contrast=1.15:saturation=0.9:gamma=0.95:gamma_r=1:gamma_b=1",
    );
  });

  it("rounds noisy float overrides to 3 decimals", () => {
    expect(colorFilter(normalizeColor({ saturation: 1.23456 }))).toContain("saturation=1.235");
  });
});
