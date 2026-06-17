import { describe, it, expect } from "vitest";
import { normalizeElements, overlayFilterComplex, magickArgs, animationFor } from "./overlay";

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

  it("defaults a badge's corner to tr when missing or invalid", () => {
    const [missing] = normalizeElements([{ type: "badge", text: "NEW", start: 0, end: 2 }]);
    expect(missing).toMatchObject({ type: "badge", corner: "tr" });
    const [invalid] = normalizeElements([{ type: "badge", text: "NEW", corner: "middle", start: 0, end: 2 }]);
    expect(invalid).toMatchObject({ type: "badge", corner: "tr" });
  });

  it("normalizes a lower_third with its subtitle", () => {
    const [el] = normalizeElements([{ type: "lower_third", text: "Name", subtitle: "Role", start: 0, end: 2 }]);
    expect(el).toMatchObject({ type: "lower_third", text: "Name", subtitle: "Role" });
  });

  it("returns [] for a non-array input", () => {
    expect(normalizeElements("nope")).toEqual([]);
    expect(normalizeElements(null)).toEqual([]);
  });
});

describe("animationFor", () => {
  it("slides a title down from above over 0.35s", () => {
    expect(animationFor({ type: "title", text: "Hi", start: 0, end: 2.5 })).toEqual({
      dur: 0.35,
      slide: { axis: "y", from: "-0.06*H" },
    });
  });

  it("wipes a lower third in from the left", () => {
    expect(animationFor({ type: "lower_third", text: "B", start: 3, end: 7 })).toEqual({
      dur: 0.35,
      slide: { axis: "x", from: "-0.06*W" },
    });
  });

  it("holds callouts and badges in place (no slide)", () => {
    expect(animationFor({ type: "callout", text: "x", x: 0.5, y: 0.5, start: 0, end: 4 }).slide).toBeNull();
    expect(animationFor({ type: "badge", text: "NEW", corner: "tr", start: 0, end: 4 }).slide).toBeNull();
  });

  it("clamps the slide to half the element's duration for short cues", () => {
    expect(animationFor({ type: "badge", text: "NEW", corner: "tr", start: 0, end: 0.4 }).dur).toBe(0.2);
  });
});

describe("overlayFilterComplex", () => {
  it("returns an empty filter mapping straight to 0:v when there are no elements", () => {
    expect(overlayFilterComplex([])).toEqual({ filter: "", outLabel: "0:v" });
  });

  it("slides a title down into place (y animated, x pinned)", () => {
    const { filter, outLabel } = overlayFilterComplex([{ type: "title", text: "Hi", start: 0, end: 2.5 }]);
    expect(filter).toBe(
      "[0:v][1:v]overlay=0:'-0.06*H*max(max(0,1-(t-0.00)/0.35),max(0,(t-2.15)/0.35))':enable='between(t,0.00,2.50)'[ov1]",
    );
    expect(outLabel).toBe("ov1");
  });

  it("slides a lower third in from the left (x animated, y pinned)", () => {
    const { filter } = overlayFilterComplex([{ type: "lower_third", text: "B", start: 3, end: 7 }]);
    expect(filter).toBe(
      "[0:v][1:v]overlay='-0.06*W*max(max(0,1-(t-3.00)/0.35),max(0,(t-6.65)/0.35))':0:enable='between(t,3.00,7.00)'[ov1]",
    );
  });

  it("holds a badge in place with no slide (overlay stays at 0:0)", () => {
    const { filter } = overlayFilterComplex([{ type: "badge", text: "NEW", corner: "tr", start: 1, end: 3 }]);
    expect(filter).toBe("[0:v][1:v]overlay=0:0:enable='between(t,1.00,3.00)'[ov1]");
  });

  it("chains multiple animated overlays in order", () => {
    const { filter, outLabel } = overlayFilterComplex([
      { type: "title", text: "A", start: 0, end: 2 },
      { type: "lower_third", text: "B", start: 3, end: 7 },
    ]);
    expect(filter).toBe(
      "[0:v][1:v]overlay=0:'-0.06*H*max(max(0,1-(t-0.00)/0.35),max(0,(t-1.65)/0.35))':enable='between(t,0.00,2.00)'[ov1];" +
        "[ov1][2:v]overlay='-0.06*W*max(max(0,1-(t-3.00)/0.35),max(0,(t-6.65)/0.35))':0:enable='between(t,3.00,7.00)'[ov2]",
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

  it("includes the subtitle text for a title", () => {
    const args = magickArgs({ type: "title", text: "Hi", subtitle: "Sub", start: 0, end: 2 }, DIMS, "/tmp/t2.png");
    expect(args.join(" ")).toContain("Sub");
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
