import { describe, it, expect } from "vitest";
import { normalizeSplitLayout, splitFilter, SPLIT_LAYOUTS } from "./splitscreen";

const vbranch = (i: number, w: number, h: number) =>
  `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`;

describe("SPLIT_LAYOUTS", () => {
  it("exposes the two layouts", () => {
    expect(SPLIT_LAYOUTS).toEqual(["horizontal", "vertical"]);
  });
});

describe("normalizeSplitLayout", () => {
  it("passes a valid layout through", () => {
    expect(normalizeSplitLayout("vertical")).toBe("vertical");
  });
  it("defaults an unknown / missing layout to horizontal", () => {
    expect(normalizeSplitLayout("diagonal")).toBe("horizontal");
    expect(normalizeSplitLayout(undefined)).toBe("horizontal");
  });
});

describe("splitFilter", () => {
  it("normalizes both clips into half-width cells and hstacks them (side by side)", () => {
    expect(splitFilter("horizontal", 640, 720)).toEqual({
      filter: [vbranch(0, 640, 720), vbranch(1, 640, 720), "[v0][v1]hstack=inputs=2[v]"].join(";"),
      maps: ["[v]"],
    });
  });

  it("vstacks the cells when the layout is vertical (stacked)", () => {
    expect(splitFilter("vertical", 1280, 360)).toEqual({
      filter: [vbranch(0, 1280, 360), vbranch(1, 1280, 360), "[v0][v1]vstack=inputs=2[v]"].join(";"),
      maps: ["[v]"],
    });
  });
});
