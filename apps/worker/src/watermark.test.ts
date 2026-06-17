import { describe, it, expect } from "vitest";
import { normalizeCorner, normalizeOpacity, watermarkMagickArgs, WATERMARK_CORNERS } from "./watermark";

describe("WATERMARK_CORNERS", () => {
  it("exposes the four corners", () => {
    expect(WATERMARK_CORNERS).toEqual(["tl", "tr", "bl", "br"]);
  });
});

describe("normalizeCorner", () => {
  it("passes a valid corner through", () => {
    expect(normalizeCorner("tl")).toBe("tl");
    expect(normalizeCorner("bl")).toBe("bl");
  });
  it("defaults an unknown / missing corner to bottom-right", () => {
    expect(normalizeCorner("middle")).toBe("br");
    expect(normalizeCorner(undefined)).toBe("br");
  });
});

describe("normalizeOpacity", () => {
  it("passes a valid opacity through and parses strings", () => {
    expect(normalizeOpacity(0.8)).toBe(0.8);
    expect(normalizeOpacity("0.3")).toBe(0.3);
  });
  it("clamps to [0.1, 1] and defaults non-finite input to 0.5", () => {
    expect(normalizeOpacity(5)).toBe(1);
    expect(normalizeOpacity(0)).toBe(0.1);
    expect(normalizeOpacity("x")).toBe(0.5);
  });
});

describe("watermarkMagickArgs", () => {
  it("renders the text at the chosen corner's gravity, with the opacity fill", () => {
    const args = watermarkMagickArgs("@cutroom", "br", 0.5, { width: 1280, height: 720 }, "/tmp/w.png");
    expect(args).toContain("xc:none");
    expect(args).toContain("1280x720");
    // br → SouthEast gravity.
    expect(args[args.indexOf("-gravity") + 1]).toBe("SouthEast");
    expect(args.join(" ")).toContain("rgba(255,255,255,0.5)");
    expect(args.join(" ")).toContain("@cutroom");
    expect(args[args.length - 1]).toBe("/tmp/w.png");
  });

  it("maps each corner to its ImageMagick gravity", () => {
    const g = (c: "tl" | "tr" | "bl" | "br") => {
      const a = watermarkMagickArgs("x", c, 0.5, { width: 100, height: 100 }, "/tmp/x.png");
      return a[a.indexOf("-gravity") + 1];
    };
    expect(g("tl")).toBe("NorthWest");
    expect(g("tr")).toBe("NorthEast");
    expect(g("bl")).toBe("SouthWest");
    expect(g("br")).toBe("SouthEast");
  });
});
