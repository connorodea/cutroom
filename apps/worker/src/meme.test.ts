import { describe, it, expect } from "vitest";
import { memeMagickArgs } from "./meme";

describe("memeMagickArgs", () => {
  it("renders uppercased top + bottom Impact-style text on a full-frame transparent PNG", () => {
    const args = memeMagickArgs("top text", "bottom text", { width: 640, height: 360 }, "/tmp/m.png");
    expect(args).toContain("xc:none");
    expect(args).toContain("640x360");
    expect(args).toContain("white"); // fill
    expect(args).toContain("black"); // stroke
    // big text scaled to the frame height.
    expect(args[args.indexOf("-pointsize") + 1]).toBe("32");
    // top text drawn at North gravity, uppercased.
    expect(args[args.indexOf("North") + 1]).toBe("-annotate");
    expect(args.join(" ")).toContain("TOP TEXT");
    // bottom text drawn at South gravity, uppercased.
    expect(args[args.indexOf("South") + 1]).toBe("-annotate");
    expect(args.join(" ")).toContain("BOTTOM TEXT");
    expect(args[args.length - 1]).toBe("/tmp/m.png");
  });

  it("omits the top annotate when there is no top text", () => {
    const args = memeMagickArgs("", "just bottom", { width: 640, height: 360 }, "/tmp/m.png");
    expect(args.join(" ")).not.toContain("North");
    expect(args.join(" ")).toContain("South");
    expect(args.join(" ")).toContain("JUST BOTTOM");
  });

  it("omits the bottom annotate when there is no bottom text", () => {
    const args = memeMagickArgs("just top", "", { width: 640, height: 360 }, "/tmp/m.png");
    expect(args.join(" ")).toContain("North");
    expect(args.join(" ")).not.toContain("South");
    expect(args.join(" ")).toContain("JUST TOP");
  });

  it("scales the point size with the frame height", () => {
    const args = memeMagickArgs("x", "y", { width: 1920, height: 1080 }, "/tmp/m.png");
    expect(args[args.indexOf("-pointsize") + 1]).toBe("97");
  });

  it("passes an explicit -font when OVERLAY_FONT is set", () => {
    const prev = process.env.OVERLAY_FONT;
    process.env.OVERLAY_FONT = "/fonts/Impact.ttf";
    try {
      const args = memeMagickArgs("hi", "", { width: 640, height: 360 }, "/tmp/m.png");
      expect(args[args.indexOf("-font") + 1]).toBe("/fonts/Impact.ttf");
    } finally {
      if (prev === undefined) delete process.env.OVERLAY_FONT;
      else process.env.OVERLAY_FONT = prev;
    }
  });
});
