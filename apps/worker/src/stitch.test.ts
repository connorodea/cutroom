import { describe, it, expect } from "vitest";
import { buildStitchFilter } from "./stitch";

const vbranch = (i: number) =>
  `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`;
const abranch = (i: number) => `[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`;

describe("buildStitchFilter", () => {
  it("normalizes two clips and concatenates video + audio when all have audio", () => {
    expect(buildStitchFilter(2, 1280, 720, true)).toEqual({
      filter: [vbranch(0), vbranch(1), abranch(0), abranch(1), "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"].join(";"),
      maps: ["[v]", "[a]"],
    });
  });

  it("concatenates video only when any clip lacks audio", () => {
    expect(buildStitchFilter(2, 1280, 720, false)).toEqual({
      filter: [vbranch(0), vbranch(1), "[v0][v1]concat=n=2:v=1:a=0[v]"].join(";"),
      maps: ["[v]"],
    });
  });

  it("handles three clips with audio", () => {
    expect(buildStitchFilter(3, 1280, 720, true)).toEqual({
      filter: [
        vbranch(0), vbranch(1), vbranch(2),
        abranch(0), abranch(1), abranch(2),
        "[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]",
      ].join(";"),
      maps: ["[v]", "[a]"],
    });
  });
});
