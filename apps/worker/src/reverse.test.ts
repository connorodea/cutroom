import { describe, it, expect } from "vitest";
import { normalizeReverseMode, reverseFilter, REVERSE_MODES } from "./reverse";

describe("REVERSE_MODES", () => {
  it("exposes the supported modes", () => {
    expect(REVERSE_MODES).toEqual(["reverse", "boomerang"]);
  });
});

describe("normalizeReverseMode", () => {
  it("passes a valid mode through", () => {
    expect(normalizeReverseMode("boomerang")).toBe("boomerang");
    expect(normalizeReverseMode("reverse")).toBe("reverse");
  });

  it("defaults an unknown / missing mode to reverse", () => {
    expect(normalizeReverseMode("backwards")).toBe("reverse");
    expect(normalizeReverseMode(undefined)).toBe("reverse");
  });
});

describe("reverseFilter", () => {
  it("reverses video and audio together when audio is present", () => {
    expect(reverseFilter("reverse", true)).toEqual({
      filter: "[0:v]reverse[v];[0:a]areverse[a]",
      maps: ["[v]", "[a]"],
    });
  });

  it("reverses video only when there is no audio track", () => {
    expect(reverseFilter("reverse", false)).toEqual({
      filter: "[0:v]reverse[v]",
      maps: ["[v]"],
    });
  });

  it("boomerangs by concatenating the clip with its reverse (video only)", () => {
    const expected = {
      filter: "[0:v]split[fwd][bk];[bk]reverse[rev];[fwd][rev]concat=n=2:v=1:a=0[v]",
      maps: ["[v]"],
    };
    expect(reverseFilter("boomerang", true)).toEqual(expected);
    // Audio is dropped for a boomerang regardless of the source.
    expect(reverseFilter("boomerang", false)).toEqual(expected);
  });
});
