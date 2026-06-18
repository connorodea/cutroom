import { describe, it, expect } from "vitest";
import { normalizePipCorner, normalizePipScale, pipFilter, PIP_CORNERS } from "./pip";

describe("PIP_CORNERS", () => {
  it("exposes the four corners", () => {
    expect(PIP_CORNERS).toEqual(["tl", "tr", "bl", "br"]);
  });
});

describe("normalizePipCorner", () => {
  it("passes a valid corner through", () => {
    expect(normalizePipCorner("tl")).toBe("tl");
    expect(normalizePipCorner("tr")).toBe("tr");
  });
  it("defaults an unknown / missing corner to bottom-right", () => {
    expect(normalizePipCorner("middle")).toBe("br");
    expect(normalizePipCorner(undefined)).toBe("br");
  });
});

describe("normalizePipScale", () => {
  it("passes a valid scale through and parses strings", () => {
    expect(normalizePipScale(0.25)).toBe(0.25);
    expect(normalizePipScale("0.4")).toBe(0.4);
  });
  it("clamps to [0.1, 0.5] and defaults non-finite input to 0.3", () => {
    expect(normalizePipScale(0.9)).toBe(0.5);
    expect(normalizePipScale(0.01)).toBe(0.1);
    expect(normalizePipScale("x")).toBe(0.3);
  });
});

describe("pipFilter", () => {
  it("scales the overlay and composites it at the corner with a margin", () => {
    expect(pipFilter("br", 384, 38)).toBe(
      "[1:v]scale=384:-1,setsar=1[pip];[0:v][pip]overlay=W-w-38:H-h-38[v]",
    );
  });

  it("maps each corner to its overlay position expression", () => {
    const pos = (c: "tl" | "tr" | "bl" | "br") => pipFilter(c, 100, 10).split("overlay=")[1].replace("[v]", "");
    expect(pos("tl")).toBe("10:10");
    expect(pos("tr")).toBe("W-w-10:10");
    expect(pos("bl")).toBe("10:H-h-10");
    expect(pos("br")).toBe("W-w-10:H-h-10");
  });
});
