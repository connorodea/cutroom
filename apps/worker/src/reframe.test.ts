import { describe, it, expect } from "vitest";
import { buildReframeFilter, REFRAME_TARGETS, normalizeAspect, normalizeMode } from "./reframe";

describe("REFRAME_TARGETS", () => {
  it("maps portrait to 720x1280 (default 9:16)", () => {
    expect(REFRAME_TARGETS.portrait).toEqual({ width: 720, height: 1280, ratio: "9:16" });
  });

  it("maps square to 1080x1080 (1:1)", () => {
    expect(REFRAME_TARGETS.square).toEqual({ width: 1080, height: 1080, ratio: "1:1" });
  });

  it("maps landscape to 1280x720 (16:9)", () => {
    expect(REFRAME_TARGETS.landscape).toEqual({ width: 1280, height: 720, ratio: "16:9" });
  });
});

describe("buildReframeFilter — crop mode", () => {
  it("produces a simple -vf scale=increase + crop chain at the target dims", () => {
    const { args, mode } = buildReframeFilter(720, 1280, "crop");
    expect(mode).toBe("crop");
    expect(args[0]).toBe("-vf");
    const vf = args[1];
    expect(vf).toContain("scale=720:1280:force_original_aspect_ratio=increase");
    expect(vf).toContain("crop=720:1280");
    expect(vf).toContain("setsar=1");
    // crop mode uses -vf, never -filter_complex
    expect(args).not.toContain("-filter_complex");
  });

  it("substitutes dimensions for a landscape target (1280x720)", () => {
    const { args } = buildReframeFilter(1280, 720, "crop");
    expect(args[1]).toContain("scale=1280:720:force_original_aspect_ratio=increase");
    expect(args[1]).toContain("crop=1280:720");
  });

  it("substitutes dimensions for a square target (1080x1080)", () => {
    const { args } = buildReframeFilter(1080, 1080, "crop");
    expect(args[1]).toContain("crop=1080:1080");
  });
});

describe("buildReframeFilter — blur mode", () => {
  it("produces a -filter_complex with split, boxblur and a centered overlay at the target dims", () => {
    const { args, mode } = buildReframeFilter(720, 1280, "blur");
    expect(mode).toBe("blur");
    expect(args[0]).toBe("-filter_complex");
    const fc = args[1];
    expect(fc).toContain("split");
    expect(fc).toContain("boxblur");
    expect(fc).toContain("overlay=");
    // background fills the frame (scale=increase + crop), foreground fits inside (scale=decrease)
    expect(fc).toContain("force_original_aspect_ratio=increase");
    expect(fc).toContain("force_original_aspect_ratio=decrease");
    expect(fc).toContain("crop=720:1280");
    // centered overlay
    expect(fc).toContain("overlay=(W-w)/2:(H-h)/2");
    // blur mode maps a labeled output, not raw -vf
    expect(args).toContain("-map");
  });

  it("substitutes dimensions for a landscape target (1280x720)", () => {
    const { args } = buildReframeFilter(1280, 720, "blur");
    expect(args[1]).toContain("crop=1280:720");
  });
});

describe("normalizeAspect / normalizeMode", () => {
  it("keeps known aspects and defaults the rest to portrait", () => {
    expect(normalizeAspect("square")).toBe("square");
    expect(normalizeAspect("landscape")).toBe("landscape");
    expect(normalizeAspect("portrait")).toBe("portrait");
    expect(normalizeAspect("nonsense")).toBe("portrait");
    expect(normalizeAspect(undefined)).toBe("portrait");
  });

  it("keeps crop and defaults everything else to blur", () => {
    expect(normalizeMode("crop")).toBe("crop");
    expect(normalizeMode("blur")).toBe("blur");
    expect(normalizeMode("weird")).toBe("blur");
  });
});
