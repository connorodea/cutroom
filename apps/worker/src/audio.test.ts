import { describe, it, expect } from "vitest";
import { normalizeAudioMode, normalizeLevel, audioFilter, AUDIO_MODES } from "./audio";

describe("AUDIO_MODES", () => {
  it("exposes the supported modes", () => {
    expect(AUDIO_MODES).toEqual(["volume", "mute", "normalize"]);
  });
});

describe("normalizeAudioMode", () => {
  it("passes a valid mode through", () => {
    expect(normalizeAudioMode("mute")).toBe("mute");
    expect(normalizeAudioMode("normalize")).toBe("normalize");
  });

  it("defaults an unknown / missing mode to volume", () => {
    expect(normalizeAudioMode("boost")).toBe("volume");
    expect(normalizeAudioMode(undefined)).toBe("volume");
  });
});

describe("normalizeLevel", () => {
  it("passes a valid multiplier through", () => {
    expect(normalizeLevel(0.5)).toBe(0.5);
    expect(normalizeLevel("2")).toBe(2);
  });

  it("clamps to [0, 4] and defaults non-finite input to 1", () => {
    expect(normalizeLevel(99)).toBe(4);
    expect(normalizeLevel(-1)).toBe(0);
    expect(normalizeLevel("loud")).toBe(1);
    expect(normalizeLevel(undefined)).toBe(1);
  });
});

describe("audioFilter", () => {
  it("mutes with volume=0", () => {
    expect(audioFilter("mute", 1)).toBe("volume=0");
  });

  it("normalizes loudness to broadcast targets", () => {
    expect(audioFilter("normalize", 1)).toBe("loudnorm=I=-16:TP=-1.5:LRA=11");
  });

  it("scales the volume by the level", () => {
    expect(audioFilter("volume", 0.5)).toBe("volume=0.5");
    expect(audioFilter("volume", 2)).toBe("volume=2");
  });
});
