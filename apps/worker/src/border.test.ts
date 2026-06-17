import { describe, it, expect } from "vitest";
import {
  BORDER_COLORS,
  normalizeBorderColor,
  clampBorderThickness,
  borderFilter,
} from "./border";

describe("normalizeBorderColor", () => {
  it("passes the named colors through", () => {
    expect(BORDER_COLORS).toContain("white");
    expect(BORDER_COLORS).toContain("black");
    expect(normalizeBorderColor("white")).toBe("white");
    expect(normalizeBorderColor("black")).toBe("black");
  });

  it("passes through a valid 0xRRGGBB hex (upper-cased)", () => {
    expect(normalizeBorderColor("0xab12cd")).toBe("0xAB12CD");
  });

  it("defaults garbage to white", () => {
    expect(normalizeBorderColor("chartreuse")).toBe("white");
    expect(normalizeBorderColor("0x12")).toBe("white");
    expect(normalizeBorderColor(undefined)).toBe("white");
  });
});

describe("clampBorderThickness", () => {
  it("defaults non-finite to 24 and clamps into [2, 200] as an integer", () => {
    expect(clampBorderThickness("nope")).toBe(24);
    expect(clampBorderThickness(0)).toBe(2);
    expect(clampBorderThickness(999)).toBe(200);
    expect(clampBorderThickness(31.7)).toBe(32);
  });
});

describe("borderFilter", () => {
  it("pads the frame on every side and reports the grown dimensions", () => {
    const { vf, outW, outH } = borderFilter(24, "white", 320, 240);
    expect(outW).toBe(368);
    expect(outH).toBe(288);
    expect(vf).toBe("pad=368:288:24:24:color=white");
  });

  it("threads the color + thickness through", () => {
    const { vf, outW, outH } = borderFilter(10, "0x0000FF", 1280, 720);
    expect(outW).toBe(1300);
    expect(outH).toBe(740);
    expect(vf).toBe("pad=1300:740:10:10:color=0x0000FF");
  });
});
