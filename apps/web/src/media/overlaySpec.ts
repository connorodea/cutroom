/**
 * Editor-side overlay spec model + pure helpers for the Overlay panel.
 *
 * `OverlaySpec` is the *editor* shape: it carries an editor-only `id` (stable React key)
 * and may hold half-filled fields while the user types. `normalizeForSubmit` converts a
 * list of these into the wire shape the worker's POST /api/overlay expects (see
 * apps/worker/src/overlay.ts → normalizeElements), dropping the id, trimming text,
 * clamping callout coordinates, and discarding empty rows.
 */

export type OverlayType = "title" | "lower_third" | "callout" | "badge";
export type BadgeCorner = "tl" | "tr" | "bl" | "br";

/** Wire shape sent to the worker (one element of the `overlays` JSON array). */
export type OverlayElement =
  | { type: "title"; text: string; subtitle?: string; start: number; end: number }
  | { type: "lower_third"; text: string; subtitle?: string; start: number; end: number }
  | { type: "callout"; text: string; x: number; y: number; start: number; end: number }
  | { type: "badge"; text: string; corner: BadgeCorner; start: number; end: number };

/** Editor-side element: a wire element plus a stable id for React keys. */
export type OverlaySpec = OverlayElement & { id: string };

export const OVERLAY_TYPES: { type: OverlayType; label: string }[] = [
  { type: "title", label: "Title" },
  { type: "lower_third", label: "Lower third" },
  { type: "callout", label: "Callout" },
  { type: "badge", label: "Badge" },
];

const DEFAULT_START = 0;
const DEFAULT_END = 3;

let seq = 0;
const newId = (): string => `ov-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Build a fresh editor element of the given type with sensible defaults. */
export function defaultElement(type: OverlayType): OverlaySpec {
  const base = { id: newId(), text: "", start: DEFAULT_START, end: DEFAULT_END };
  switch (type) {
    case "title":
      return { ...base, type: "title", subtitle: "" };
    case "lower_third":
      return { ...base, type: "lower_third", subtitle: "" };
    case "callout":
      return { ...base, type: "callout", x: 0.5, y: 0.3 };
    case "badge":
      return { ...base, type: "badge", corner: "tr" };
  }
}

/**
 * Convert editor elements into the worker wire shape: drop the editor-only `id`,
 * trim text, omit empty subtitles, clamp callout x/y to 0..1, ensure end > start,
 * and drop any element whose text is empty after trimming.
 */
export function normalizeForSubmit(elements: OverlaySpec[]): OverlayElement[] {
  const out: OverlayElement[] = [];
  for (const el of elements) {
    const text = el.text.trim();
    if (!text) continue;

    const start = Math.max(0, Number.isFinite(el.start) ? el.start : DEFAULT_START);
    let end = Number.isFinite(el.end) ? el.end : start + DEFAULT_END;
    if (end <= start) end = start + DEFAULT_END;

    if (el.type === "callout") {
      out.push({ type: "callout", text, x: clamp01(el.x), y: clamp01(el.y), start, end });
    } else if (el.type === "badge") {
      out.push({ type: "badge", text, corner: el.corner, start, end });
    } else {
      const sub = el.subtitle?.trim();
      const base = sub ? { text, subtitle: sub, start, end } : { text, start, end };
      out.push({ type: el.type, ...base });
    }
  }
  return out;
}
