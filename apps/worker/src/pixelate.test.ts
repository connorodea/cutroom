import { describe, it, expect } from "vitest";
import {
  PIXEL_SIZES,
  PIXEL_BLOCKS,
  normalizePixelSize,
  pixelateDims,
  pixelateFilter,
} from "./pixelate";

describe("normalizePixelSize", () => {
  it("lists the sizes and their block widths", () => {
    expect(PIXEL_SIZES).toEqual(["small", "medium", "large"]);
    expect(PIXEL_BLOCKS.small).toBe(8);
    expect(PIXEL_BLOCKS.medium).toBe(16);
    expect(PIXEL_BLOCKS.large).toBe(32);
  });

  it("accepts known sizes and defaults the rest to medium", () => {
    expect(normalizePixelSize("small")).toBe("small");
    expect(normalizePixelSize("large")).toBe("large");
    expect(normalizePixelSize("medium")).toBe("medium");
    expect(normalizePixelSize("chunky")).toBe("medium");
    expect(normalizePixelSize(undefined)).toBe("medium");
  });
});

describe("pixelateDims", () => {
  it("divides the dimension by the block size, rounded, never below 1", () => {
    expect(pixelateDims(320, 32)).toBe(10);
    expect(pixelateDims(240, 32)).toBe(8);
    expect(pixelateDims(320, 8)).toBe(40);
    expect(pixelateDims(20, 32)).toBe(1);
  });
});

describe("pixelateFilter", () => {
  it("downscales then upscales with nearest-neighbor to make square blocks", () => {
    expect(pixelateFilter(320, 240, 32)).toBe("scale=10:8,scale=320:240:flags=neighbor");
  });

  it("threads other dims/blocks through", () => {
    expect(pixelateFilter(1280, 720, 16)).toBe("scale=80:45,scale=1280:720:flags=neighbor");
  });
});
