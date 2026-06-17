import { describe, it, expect } from "vitest";
import { normalizeGifOpts, gifFilter, GIF_DEFAULT_FPS, GIF_DEFAULT_WIDTH } from "./gif";

describe("normalizeGifOpts", () => {
  it("defaults to 12fps / 480px wide", () => {
    expect(normalizeGifOpts({})).toEqual({ fps: GIF_DEFAULT_FPS, width: GIF_DEFAULT_WIDTH });
  });

  it("parses strings and rounds to whole numbers", () => {
    expect(normalizeGifOpts({ fps: "12.7", width: "500" })).toEqual({ fps: 13, width: 500 });
  });

  it("clamps fps to [5, 30] and width to [120, 1080]", () => {
    expect(normalizeGifOpts({ fps: 60 }).fps).toBe(30);
    expect(normalizeGifOpts({ fps: 1 }).fps).toBe(5);
    expect(normalizeGifOpts({ width: 2000 }).width).toBe(1080);
    expect(normalizeGifOpts({ width: 50 }).width).toBe(120);
  });

  it("falls back to defaults for non-finite input", () => {
    expect(normalizeGifOpts({ fps: "x", width: "y" })).toEqual({ fps: GIF_DEFAULT_FPS, width: GIF_DEFAULT_WIDTH });
  });
});

describe("gifFilter", () => {
  it("builds a two-pass palettegen/paletteuse chain", () => {
    expect(gifFilter({ fps: 12, width: 480 })).toBe(
      "fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
    );
  });
});
