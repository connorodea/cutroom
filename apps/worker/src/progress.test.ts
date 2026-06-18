import { describe, it, expect } from "vitest";
import {
  PROGRESS_COLORS,
  PROGRESS_THICKNESS,
  normalizeProgressColor,
  normalizeProgressThickness,
  progressBarHeight,
  progressBarFilter,
} from "./progress";

describe("normalizeProgressColor", () => {
  it("lists the colors and accepts them, defaulting the rest to cyan", () => {
    expect(PROGRESS_COLORS).toEqual(["cyan", "magenta", "lime", "white", "red"]);
    expect(normalizeProgressColor("red")).toBe("red");
    expect(normalizeProgressColor("white")).toBe("white");
    expect(normalizeProgressColor("octarine")).toBe("cyan");
    expect(normalizeProgressColor(undefined)).toBe("cyan");
  });
});

describe("normalizeProgressThickness", () => {
  it("lists the thicknesses and defaults to medium", () => {
    expect(PROGRESS_THICKNESS).toEqual(["thin", "medium", "thick"]);
    expect(normalizeProgressThickness("thin")).toBe("thin");
    expect(normalizeProgressThickness("thick")).toBe("thick");
    expect(normalizeProgressThickness("chonky")).toBe("medium");
  });
});

describe("progressBarHeight", () => {
  it("scales an even bar height to the frame and thickness", () => {
    expect(progressBarHeight(360, "thin")).toBe(4);
    expect(progressBarHeight(360, "medium")).toBe(10);
    expect(progressBarHeight(360, "thick")).toBe(16);
    expect(progressBarHeight(1080, "medium")).toBe(28);
  });

  it("never goes below 4px", () => {
    expect(progressBarHeight(120, "thin")).toBe(4);
  });
});

describe("progressBarFilter", () => {
  it("slides a full-width colored bar in from the left across the duration", () => {
    const { filter, maps } = progressBarFilter(640, 360, 3, 10, "cyan");
    expect(filter).toBe(
      "color=c=cyan:s=640x10:d=3[bar];[0:v][bar]overlay=x='-640*(1-t/3)':y=350[v]",
    );
    expect(maps).toEqual(["[v]"]);
  });

  it("threads other dims/duration/color through", () => {
    const { filter } = progressBarFilter(1280, 720, 12.5, 18, "red");
    expect(filter).toContain("color=c=red:s=1280x18:d=12.5");
    expect(filter).toContain("overlay=x='-1280*(1-t/12.5)':y=702[v]");
  });
});
