import { describe, it, expect } from "vitest";
import {
  KEN_BURNS_DIRECTIONS,
  KEN_BURNS_TARGETS,
  normalizeKenBurnsDirection,
  normalizeKenBurnsSeconds,
  normalizeKenBurnsAspect,
  kenBurnsFilter,
} from "./kenburns";

describe("normalizeKenBurnsDirection", () => {
  it("lists the four motions", () => {
    expect(KEN_BURNS_DIRECTIONS).toEqual(["in", "out", "left", "right"]);
  });

  it("accepts known directions and defaults the rest to in", () => {
    expect(normalizeKenBurnsDirection("out")).toBe("out");
    expect(normalizeKenBurnsDirection("left")).toBe("left");
    expect(normalizeKenBurnsDirection("right")).toBe("right");
    expect(normalizeKenBurnsDirection("in")).toBe("in");
    expect(normalizeKenBurnsDirection("sideways")).toBe("in");
    expect(normalizeKenBurnsDirection(undefined)).toBe("in");
  });
});

describe("normalizeKenBurnsSeconds", () => {
  it("defaults non-finite to 5", () => {
    expect(normalizeKenBurnsSeconds("nope")).toBe(5);
    expect(normalizeKenBurnsSeconds(undefined)).toBe(5);
  });

  it("clamps into [2, 15] and rounds to one decimal", () => {
    expect(normalizeKenBurnsSeconds(1)).toBe(2);
    expect(normalizeKenBurnsSeconds(99)).toBe(15);
    expect(normalizeKenBurnsSeconds(6.54)).toBe(6.5);
    expect(normalizeKenBurnsSeconds("8")).toBe(8);
  });
});

describe("normalizeKenBurnsAspect", () => {
  it("maps known aspects and defaults to landscape", () => {
    expect(normalizeKenBurnsAspect("portrait")).toBe("portrait");
    expect(normalizeKenBurnsAspect("square")).toBe("square");
    expect(normalizeKenBurnsAspect("landscape")).toBe("landscape");
    expect(normalizeKenBurnsAspect("nonsense")).toBe("landscape");
  });

  it("has dimensions for every target", () => {
    expect(KEN_BURNS_TARGETS.landscape).toEqual({ width: 1280, height: 720 });
    expect(KEN_BURNS_TARGETS.portrait).toEqual({ width: 720, height: 1280 });
    expect(KEN_BURNS_TARGETS.square).toEqual({ width: 1080, height: 1080 });
  });
});

describe("kenBurnsFilter", () => {
  it("zooms in (centered) over the right number of frames", () => {
    const { vf, frames } = kenBurnsFilter("in", 1280, 720, 5, 30);
    expect(frames).toBe(150);
    expect(vf).toBe(
      "scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440," +
        "zoompan=z='1+0.3*on/149':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1280x720:fps=30",
    );
  });

  it("zooms out from the maximum", () => {
    const { vf } = kenBurnsFilter("out", 1280, 720, 5, 30);
    expect(vf).toContain("zoompan=z='1.3-0.3*on/149'");
    expect(vf).toContain("x='iw/2-(iw/zoom/2)'");
  });

  it("pans right at a constant zoom", () => {
    const { vf } = kenBurnsFilter("right", 1280, 720, 5, 30);
    expect(vf).toContain("z='1.2'");
    expect(vf).toContain("x='(iw-iw/zoom)*on/149'");
    expect(vf).toContain("y='ih/2-(ih/zoom/2)'");
  });

  it("pans left (reverse of right)", () => {
    const { vf } = kenBurnsFilter("left", 1280, 720, 5, 30);
    expect(vf).toContain("z='1.2'");
    expect(vf).toContain("x='(iw-iw/zoom)*(1-on/149)'");
  });

  it("scales the supersample base + frame count to other targets/durations", () => {
    const { vf, frames } = kenBurnsFilter("in", 720, 1280, 4, 30);
    expect(frames).toBe(120);
    expect(vf).toContain("scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560");
    expect(vf).toContain("d=120:s=720x1280:fps=30");
  });
});
