import { describe, it, expect } from "vitest";
import { clampMusicVolume, musicFilter } from "./music";

describe("clampMusicVolume", () => {
  it("defaults non-finite to 0.3 and clamps into [0, 1] at two decimals", () => {
    expect(clampMusicVolume("nope")).toBe(0.3);
    expect(clampMusicVolume(undefined)).toBe(0.3);
    expect(clampMusicVolume(-1)).toBe(0);
    expect(clampMusicVolume(5)).toBe(1);
    expect(clampMusicVolume(0.456)).toBe(0.46);
  });
});

describe("musicFilter", () => {
  it("mixes the original audio at full with the music ducked when the clip has audio", () => {
    const { filter, maps } = musicFilter(0.3, true);
    expect(filter).toBe(
      "[0:a]volume=1[a0];[1:a]volume=0.3[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]",
    );
    expect(maps).toEqual(["[a]"]);
  });

  it("uses the music alone as the track when the clip is silent", () => {
    const { filter, maps } = musicFilter(0.5, false);
    expect(filter).toBe("[1:a]volume=0.5[a]");
    expect(maps).toEqual(["[a]"]);
  });
});
