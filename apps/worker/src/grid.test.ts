import { describe, it, expect } from "vitest";
import { gridFilter } from "./grid";

const cell = (i: number, w: number, h: number) =>
  `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`;

describe("gridFilter", () => {
  it("scales four inputs into equal cells and 2x2-stacks them", () => {
    const { filter, maps } = gridFilter(160, 120);
    const expected = [
      cell(0, 160, 120),
      cell(1, 160, 120),
      cell(2, 160, 120),
      cell(3, 160, 120),
      "[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]",
    ].join(";");
    expect(filter).toBe(expected);
    expect(maps).toEqual(["[v]"]);
  });

  it("threads other cell sizes through", () => {
    const { filter } = gridFilter(360, 640);
    expect(filter).toContain("scale=360:640:force_original_aspect_ratio=decrease,pad=360:640");
    expect(filter).toContain("xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]");
  });
});
