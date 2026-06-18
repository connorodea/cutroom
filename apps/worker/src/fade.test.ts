import { describe, it, expect } from "vitest";
import { normalizeFadeKind, normalizeFadeDur, fadeFilters, FADE_KINDS } from "./fade";

describe("FADE_KINDS", () => {
  it("exposes the supported kinds", () => {
    expect(FADE_KINDS).toEqual(["in", "out", "both"]);
  });
});

describe("normalizeFadeKind", () => {
  it("passes a valid kind through", () => {
    expect(normalizeFadeKind("in")).toBe("in");
    expect(normalizeFadeKind("out")).toBe("out");
  });

  it("defaults an unknown / missing kind to both", () => {
    expect(normalizeFadeKind("sideways")).toBe("both");
    expect(normalizeFadeKind(undefined)).toBe("both");
  });
});

describe("normalizeFadeDur", () => {
  it("passes a valid duration through and parses strings", () => {
    expect(normalizeFadeDur(1)).toBe(1);
    expect(normalizeFadeDur("0.75")).toBe(0.75);
  });

  it("clamps to [0.1, 5] and defaults non-finite input to 0.5", () => {
    expect(normalizeFadeDur(99)).toBe(5);
    expect(normalizeFadeDur(0)).toBe(0.1);
    expect(normalizeFadeDur("x")).toBe(0.5);
  });
});

describe("fadeFilters", () => {
  it("builds a fade-in for video and audio", () => {
    expect(fadeFilters("in", 0.5, 10)).toEqual({
      vf: "fade=t=in:st=0:d=0.5",
      af: "afade=t=in:st=0:d=0.5",
    });
  });

  it("builds a fade-out anchored to the clip end", () => {
    expect(fadeFilters("out", 0.5, 10)).toEqual({
      vf: "fade=t=out:st=9.50:d=0.5",
      af: "afade=t=out:st=9.50:d=0.5",
    });
  });

  it("builds both fades chained together", () => {
    expect(fadeFilters("both", 1, 10)).toEqual({
      vf: "fade=t=in:st=0:d=1,fade=t=out:st=9.00:d=1",
      af: "afade=t=in:st=0:d=1,afade=t=out:st=9.00:d=1",
    });
  });

  it("never anchors a fade-out before 0 on a very short clip", () => {
    expect(fadeFilters("out", 0.5, 0.3).vf).toBe("fade=t=out:st=0.00:d=0.5");
  });
});
