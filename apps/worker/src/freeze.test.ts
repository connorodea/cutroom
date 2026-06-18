import { describe, it, expect } from "vitest";
import {
  FREEZE_POSITIONS,
  normalizeFreezePosition,
  normalizeFreezeSeconds,
  freezeFilters,
} from "./freeze";

describe("normalizeFreezePosition", () => {
  it("lists start and end", () => {
    expect(FREEZE_POSITIONS).toEqual(["start", "end"]);
  });

  it("accepts start", () => {
    expect(normalizeFreezePosition("start")).toBe("start");
  });

  it("defaults unknown/garbage to end", () => {
    expect(normalizeFreezePosition("end")).toBe("end");
    expect(normalizeFreezePosition("middle")).toBe("end");
    expect(normalizeFreezePosition(undefined)).toBe("end");
  });
});

describe("normalizeFreezeSeconds", () => {
  it("defaults non-finite to 2", () => {
    expect(normalizeFreezeSeconds("nope")).toBe(2);
    expect(normalizeFreezeSeconds(undefined)).toBe(2);
  });

  it("clamps into [0.5, 10] and rounds to one decimal", () => {
    expect(normalizeFreezeSeconds(0.1)).toBe(0.5);
    expect(normalizeFreezeSeconds(99)).toBe(10);
    expect(normalizeFreezeSeconds(1.54)).toBe(1.5);
    expect(normalizeFreezeSeconds("3")).toBe(3);
  });
});

describe("freezeFilters", () => {
  it("holds the last frame and pads audio with silence for an end freeze", () => {
    const { vf, af } = freezeFilters("end", 3);
    expect(vf).toBe("tpad=stop_mode=clone:stop_duration=3");
    expect(af).toBe("apad=pad_dur=3");
  });

  it("clones the first frame and delays audio for a start freeze", () => {
    const { vf, af } = freezeFilters("start", 1.5);
    expect(vf).toBe("tpad=start_mode=clone:start_duration=1.5");
    expect(af).toBe("adelay=1500:all=1");
  });
});
