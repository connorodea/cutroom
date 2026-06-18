import { describe, it, expect } from "vitest";
import { normalizeSpeed, atempoChain, speedFilterComplex, MIN_SPEED, MAX_SPEED, DEFAULT_SPEED } from "./speed";

describe("normalizeSpeed", () => {
  it("passes a valid factor through", () => {
    expect(normalizeSpeed(2)).toBe(2);
    expect(normalizeSpeed("0.5")).toBe(0.5);
  });

  it("clamps to the supported range", () => {
    expect(normalizeSpeed(99)).toBe(MAX_SPEED);
    expect(normalizeSpeed(0.01)).toBe(MIN_SPEED);
  });

  it("falls back to the default for non-finite / non-positive input", () => {
    expect(normalizeSpeed("nope")).toBe(DEFAULT_SPEED);
    expect(normalizeSpeed(0)).toBe(DEFAULT_SPEED);
    expect(normalizeSpeed(-3)).toBe(DEFAULT_SPEED);
    expect(normalizeSpeed(undefined)).toBe(DEFAULT_SPEED);
  });
});

describe("atempoChain", () => {
  it("uses a single atempo when the factor is already in [0.5, 2]", () => {
    expect(atempoChain(1)).toEqual(["atempo=1.000"]);
    expect(atempoChain(0.5)).toEqual(["atempo=0.500"]);
    expect(atempoChain(2)).toEqual(["atempo=2.000"]);
  });

  it("decomposes a speed-up above 2x into a chain whose product is the factor", () => {
    expect(atempoChain(4)).toEqual(["atempo=2.0", "atempo=2.000"]);
    expect(atempoChain(3)).toEqual(["atempo=2.0", "atempo=1.500"]);
    expect(atempoChain(8)).toEqual(["atempo=2.0", "atempo=2.0", "atempo=2.000"]);
  });

  it("decomposes a slow-down below 0.5x into a chain whose product is the factor", () => {
    expect(atempoChain(0.25)).toEqual(["atempo=0.5", "atempo=0.500"]);
  });
});

describe("speedFilterComplex", () => {
  it("retimes video and audio together when audio is present", () => {
    expect(speedFilterComplex(2, true)).toEqual({
      filter: "[0:v]setpts=0.5000*PTS[v];[0:a]atempo=2.000[a]",
      maps: ["[v]", "[a]"],
    });
  });

  it("retimes video only when there is no audio track", () => {
    expect(speedFilterComplex(0.5, false)).toEqual({
      filter: "[0:v]setpts=2.0000*PTS[v]",
      maps: ["[v]"],
    });
  });

  it("chains atempo for a high speed-up factor", () => {
    expect(speedFilterComplex(4, true)).toEqual({
      filter: "[0:v]setpts=0.2500*PTS[v];[0:a]atempo=2.0,atempo=2.000[a]",
      maps: ["[v]", "[a]"],
    });
  });
});
