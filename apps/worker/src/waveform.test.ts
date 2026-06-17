import { describe, it, expect } from "vitest";
import {
  WAVE_MODES,
  WAVE_COLORS,
  WAVE_TARGETS,
  normalizeWaveMode,
  normalizeWaveColor,
  normalizeWaveAspect,
  waveformFilter,
} from "./waveform";

describe("normalizeWaveMode", () => {
  it("lists the modes", () => {
    expect(WAVE_MODES).toEqual(["cline", "line", "point"]);
  });

  it("accepts known modes and defaults the rest to cline", () => {
    expect(normalizeWaveMode("line")).toBe("line");
    expect(normalizeWaveMode("point")).toBe("point");
    expect(normalizeWaveMode("cline")).toBe("cline");
    expect(normalizeWaveMode("squiggle")).toBe("cline");
    expect(normalizeWaveMode(undefined)).toBe("cline");
  });
});

describe("normalizeWaveColor", () => {
  it("lists the colors and accepts them, defaulting the rest to cyan", () => {
    expect(WAVE_COLORS).toEqual(["cyan", "magenta", "lime", "white"]);
    expect(normalizeWaveColor("magenta")).toBe("magenta");
    expect(normalizeWaveColor("white")).toBe("white");
    expect(normalizeWaveColor("burnt-sienna")).toBe("cyan");
    expect(normalizeWaveColor(undefined)).toBe("cyan");
  });
});

describe("normalizeWaveAspect", () => {
  it("maps known aspects and defaults to square", () => {
    expect(normalizeWaveAspect("landscape")).toBe("landscape");
    expect(normalizeWaveAspect("portrait")).toBe("portrait");
    expect(normalizeWaveAspect("square")).toBe("square");
    expect(normalizeWaveAspect("nonsense")).toBe("square");
  });

  it("has dimensions for every target", () => {
    expect(WAVE_TARGETS.square).toEqual({ width: 720, height: 720 });
    expect(WAVE_TARGETS.landscape).toEqual({ width: 1280, height: 720 });
    expect(WAVE_TARGETS.portrait).toEqual({ width: 720, height: 1280 });
  });
});

describe("waveformFilter", () => {
  it("draws a showwaves video from the audio at the given size/mode/color", () => {
    const { filter, maps } = waveformFilter(720, 720, "cline", "cyan");
    expect(filter).toBe("[0:a]showwaves=s=720x720:mode=cline:colors=cyan:rate=25,format=yuv420p[v]");
    expect(maps).toEqual(["[v]"]);
  });

  it("threads other dims/mode/color through", () => {
    const { filter } = waveformFilter(1280, 720, "line", "magenta");
    expect(filter).toContain("showwaves=s=1280x720:mode=line:colors=magenta:rate=25");
  });
});
