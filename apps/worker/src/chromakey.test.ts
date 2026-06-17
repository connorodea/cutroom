import { describe, it, expect } from "vitest";
import {
  CHROMA_COLORS,
  normalizeChromaColor,
  clampSimilarity,
  clampBlend,
  chromaKeyFilter,
} from "./chromakey";

describe("normalizeChromaColor", () => {
  it("maps the named screen colors to ffmpeg hex", () => {
    expect(CHROMA_COLORS.green).toBe("0x00FF00");
    expect(CHROMA_COLORS.blue).toBe("0x0000FF");
    expect(normalizeChromaColor("green")).toBe("0x00FF00");
    expect(normalizeChromaColor("blue")).toBe("0x0000FF");
  });

  it("passes through a valid 0xRRGGBB hex (upper-cased)", () => {
    expect(normalizeChromaColor("0xab12cd")).toBe("0xAB12CD");
  });

  it("defaults garbage to green", () => {
    expect(normalizeChromaColor("magenta")).toBe("0x00FF00");
    expect(normalizeChromaColor("0x123")).toBe("0x00FF00");
    expect(normalizeChromaColor(undefined)).toBe("0x00FF00");
  });
});

describe("clampSimilarity", () => {
  it("defaults non-finite to 0.3 and clamps into [0.01, 1]", () => {
    expect(clampSimilarity("nope")).toBe(0.3);
    expect(clampSimilarity(0)).toBe(0.01);
    expect(clampSimilarity(5)).toBe(1);
    expect(clampSimilarity(0.456)).toBe(0.46);
  });
});

describe("clampBlend", () => {
  it("defaults non-finite to 0.1 and clamps into [0, 1]", () => {
    expect(clampBlend("nope")).toBe(0.1);
    expect(clampBlend(-1)).toBe(0);
    expect(clampBlend(5)).toBe(1);
    expect(clampBlend(0.234)).toBe(0.23);
  });
});

describe("chromaKeyFilter", () => {
  it("scales the foreground to fill the background, keys the color, and overlays", () => {
    const { filter, maps } = chromaKeyFilter("0x00FF00", 0.3, 0.1, 320, 240);
    expect(filter).toBe(
      "[1:v]scale=320:240:force_original_aspect_ratio=increase,crop=320:240,colorkey=0x00FF00:0.3:0.1[fg];" +
        "[0:v][fg]overlay=0:0[v]",
    );
    expect(maps).toEqual(["[v]"]);
  });

  it("threads the color/similarity/blend and background dims through", () => {
    const { filter } = chromaKeyFilter("0x0000FF", 0.5, 0, 1280, 720);
    expect(filter).toContain("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720");
    expect(filter).toContain("colorkey=0x0000FF:0.5:0");
  });
});
