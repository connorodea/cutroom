import { describe, it, expect } from "vitest";
import { normalizeElements, overlayFilterComplex, magickArgs } from "./overlay";

const DIMS = { width: 1280, height: 720 };

describe("normalizeElements", () => {
  it("passes a valid title through with its fields", () => {
    const [el] = normalizeElements([{ type: "title", text: "Hello", start: 0, end: 2 }]);
    expect(el).toMatchObject({ type: "title", text: "Hello", start: 0, end: 2 });
  });

  it("drops an element with no text", () => {
    expect(normalizeElements([{ type: "title", start: 0, end: 2 }])).toEqual([]);
  });

  it("drops an element with an unknown type", () => {
    expect(normalizeElements([{ type: "explosion", text: "boom", start: 0, end: 2 }])).toEqual([]);
  });

  it("defaults end to start + 2.5 when end <= start", () => {
    const [el] = normalizeElements([{ type: "title", text: "Hi", start: 4, end: 4 }]);
    expect(el.end).toBe(6.5);
  });

  it("clamps a negative start to 0", () => {
    const [el] = normalizeElements([{ type: "title", text: "Hi", start: -3, end: 2 }]);
    expect(el.start).toBe(0);
  });

  it("clamps callout x/y to [0,1] and defaults missing coords to 0.5", () => {
    const [el] = normalizeElements([{ type: "callout", text: "look", start: 1, end: 3, x: 1.8 }]);
    expect(el).toMatchObject({ type: "callout", x: 1, y: 0.5 });
  });

  it("returns [] for a non-array input", () => {
    expect(normalizeElements("nope")).toEqual([]);
    expect(normalizeElements(null)).toEqual([]);
  });
});

describe("overlayFilterComplex", () => {
  it("returns an empty filter mapping straight to 0:v when there are no elements", () => {
    expect(overlayFilterComplex([])).toEqual({ filter: "", outLabel: "0:v" });
  });

  it("builds a single timed overlay at 0:0", () => {
    const { filter, outLabel } = overlayFilterComplex([{ type: "title", text: "Hi", start: 0, end: 2.5 }]);
    expect(filter).toBe("[0:v][1:v]overlay=0:0:enable='between(t,0.00,2.50)'[ov1]");
    expect(outLabel).toBe("ov1");
  });

  it("chains multiple overlays in order", () => {
    const { filter, outLabel } = overlayFilterComplex([
      { type: "title", text: "A", start: 0, end: 2 },
      { type: "lower_third", text: "B", start: 3, end: 7 },
    ]);
    expect(filter).toBe(
      "[0:v][1:v]overlay=0:0:enable='between(t,0.00,2.00)'[ov1];" +
        "[ov1][2:v]overlay=0:0:enable='between(t,3.00,7.00)'[ov2]",
    );
    expect(outLabel).toBe("ov2");
  });
});

describe("magickArgs", () => {
  it("renders a full-frame transparent canvas ending at the output path", () => {
    const args = magickArgs({ type: "title", text: "Hello", start: 0, end: 2 }, DIMS, "/tmp/t.png");
    expect(args).toContain("-size");
    expect(args).toContain("1280x720");
    expect(args).toContain("xc:none");
    expect(args.join(" ")).toContain("Hello");
    expect(args[args.length - 1]).toBe("/tmp/t.png");
  });

  it("includes the subtitle text for a lower third", () => {
    const args = magickArgs(
      { type: "lower_third", text: "Connor", subtitle: "Founder", start: 0, end: 2 },
      DIMS,
      "/tmp/lt.png",
    );
    expect(args.join(" ")).toContain("Connor");
    expect(args.join(" ")).toContain("Founder");
  });

  it("renders a callout bubble at the given position", () => {
    const args = magickArgs({ type: "callout", text: "look here", x: 0.5, y: 0.3, start: 0, end: 2 }, DIMS, "/tmp/c.png");
    expect(args).toContain("xc:none");
    expect(args.join(" ")).toContain("look here");
    expect(args.join(" ")).toContain("roundrectangle");
    expect(args[args.length - 1]).toBe("/tmp/c.png");
  });

  it("renders a corner badge", () => {
    const args = magickArgs({ type: "badge", text: "NEW", corner: "tr", start: 0, end: 2 }, DIMS, "/tmp/b.png");
    expect(args.join(" ")).toContain("NEW");
    expect(args.join(" ")).toContain("roundrectangle");
    expect(args[args.length - 1]).toBe("/tmp/b.png");
  });
});
