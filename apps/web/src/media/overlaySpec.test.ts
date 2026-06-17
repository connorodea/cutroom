import { describe, expect, it } from "vitest";
import { defaultElement, normalizeForSubmit, type OverlaySpec } from "./overlaySpec";

describe("defaultElement", () => {
  it("builds a title with empty text and a 0..3s window", () => {
    const el = defaultElement("title");
    expect(el).toMatchObject({ type: "title", text: "", start: 0, end: 3 });
  });

  it("builds a lower_third with a subtitle slot", () => {
    const el = defaultElement("lower_third");
    expect(el.type).toBe("lower_third");
    expect("subtitle" in el).toBe(true);
  });

  it("defaults a callout to centre-ish (x=0.5, y=0.3)", () => {
    const el = defaultElement("callout");
    expect(el).toMatchObject({ type: "callout", x: 0.5, y: 0.3 });
  });

  it("defaults a badge to the top-right corner", () => {
    const el = defaultElement("badge");
    expect(el).toMatchObject({ type: "badge", corner: "tr" });
  });
});

describe("normalizeForSubmit", () => {
  it("drops the editor-only id and trims text", () => {
    const els: OverlaySpec[] = [
      { id: "x1", type: "title", text: "  Hello  ", subtitle: "  Sub  ", start: 0, end: 3 },
    ];
    const out = normalizeForSubmit(els);
    expect(out).toEqual([{ type: "title", text: "Hello", subtitle: "Sub", start: 0, end: 3 }]);
    expect("id" in out[0]).toBe(false);
  });

  it("omits empty subtitles", () => {
    const els: OverlaySpec[] = [
      { id: "x1", type: "title", text: "Hi", subtitle: "   ", start: 0, end: 3 },
    ];
    const out = normalizeForSubmit(els);
    expect("subtitle" in out[0]).toBe(false);
  });

  it("keeps callout x/y and clamps them to 0..1", () => {
    const els: OverlaySpec[] = [
      { id: "c1", type: "callout", text: "Look", x: 1.6, y: -0.2, start: 1, end: 4 },
    ];
    const out = normalizeForSubmit(els);
    expect(out[0]).toEqual({ type: "callout", text: "Look", x: 1, y: 0, start: 1, end: 4 });
  });

  it("keeps the badge corner", () => {
    const els: OverlaySpec[] = [
      { id: "b1", type: "badge", text: "NEW", corner: "bl", start: 0, end: 3 },
    ];
    const out = normalizeForSubmit(els);
    expect(out[0]).toEqual({ type: "badge", text: "NEW", corner: "bl", start: 0, end: 3 });
  });

  it("coerces a non-positive duration so end > start", () => {
    const els: OverlaySpec[] = [
      { id: "t1", type: "title", text: "Hi", start: 2, end: 2 },
    ];
    const out = normalizeForSubmit(els);
    const el = out[0] as { start: number; end: number };
    expect(el.end).toBeGreaterThan(el.start);
  });

  it("defaults a non-finite start/end to the 0..3s window", () => {
    const els: OverlaySpec[] = [
      { id: "t1", type: "title", text: "Hi", start: NaN, end: NaN },
    ];
    const out = normalizeForSubmit(els) as { start: number; end: number }[];
    expect(out[0]).toMatchObject({ start: 0, end: 3 });
  });

  it("drops elements whose text is empty after trimming", () => {
    const els: OverlaySpec[] = [
      { id: "t1", type: "title", text: "   ", start: 0, end: 3 },
      { id: "t2", type: "badge", text: "OK", corner: "tr", start: 0, end: 3 },
    ];
    const out = normalizeForSubmit(els);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "badge", text: "OK" });
  });
});
