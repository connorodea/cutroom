import { run } from "./ffmpeg";

/**
 * Graphics overlay system. The AI agent (or a caller) emits an overlay spec — a list of
 * graphic elements — which ImageMagick renders to full-frame transparent PNGs and ffmpeg
 * composites onto the base video at each element's time window. Positioning lives entirely
 * in ImageMagick (the PNG is the full frame), so the ffmpeg side is a simple overlay=0:0 chain.
 */

export type OverlayElement =
  | { type: "title"; text: string; subtitle?: string; start: number; end: number }
  | { type: "lower_third"; text: string; subtitle?: string; start: number; end: number }
  | { type: "callout"; text: string; x: number; y: number; start: number; end: number }
  | { type: "badge"; text: string; corner: "tl" | "tr" | "bl" | "br"; start: number; end: number };

export interface Dims {
  width: number;
  height: number;
}

const KNOWN = new Set(["title", "lower_third", "callout", "badge"]);
const DEFAULT_DURATION = 2.5;
const ACCENT = "#FF6A2B"; // Preecursor / Cutroom accent orange

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Validate + normalize a raw overlay spec (untrusted JSON) into typed elements. */
export function normalizeElements(raw: unknown): OverlayElement[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayElement[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const type = String(o.type ?? "");
    const text = String(o.text ?? "").trim();
    if (!KNOWN.has(type) || !text) continue;

    const start = Math.max(0, num(o.start, 0));
    let end = num(o.end, start + DEFAULT_DURATION);
    if (end <= start) end = start + DEFAULT_DURATION;
    const subtitle = o.subtitle != null ? String(o.subtitle).trim() : undefined;

    if (type === "callout") {
      out.push({ type: "callout", text, start, end, x: clamp01(num(o.x, 0.5)), y: clamp01(num(o.y, 0.5)) });
    } else if (type === "badge") {
      const c = String(o.corner ?? "tr");
      const corner = (["tl", "tr", "bl", "br"].includes(c) ? c : "tr") as "tl" | "tr" | "bl" | "br";
      out.push({ type: "badge", text, start, end, corner });
    } else if (type === "title") {
      out.push({ type: "title", text, subtitle, start, end });
    } else {
      out.push({ type: "lower_third", text, subtitle, start, end });
    }
  }
  return out;
}

/** Default entrance/exit slide length (seconds), clamped to half the cue for short cues. */
const SLIDE = 0.35;

export interface OverlayAnimation {
  /** Entrance and exit slide duration in seconds. */
  dur: number;
  /** Slide vector: the overlay starts/ends offset by `from` (an ffmpeg expr) and rests at 0. */
  slide: { axis: "x" | "y"; from: string } | null;
}

/**
 * The animated-graphics tier: pick an entrance/exit animation per element type. Titles drop in
 * from above (y), lower thirds wipe in from the left (x); callouts and badges hold their position.
 * Offsets are fractions of the frame (ffmpeg's `W`/`H`) so they're resolution-free. The animation
 * is driven entirely by the overlay filter's `x`/`y` expressions, which are evaluated against the
 * BASE video's timestamp `t` — a still PNG has no timeline of its own, so a `fade`/`geq` alpha
 * ramp would bake in a single frame's value; position expressions are the safe, correct mechanism.
 */
export function animationFor(el: OverlayElement): OverlayAnimation {
  const dur = Math.min(SLIDE, (el.end - el.start) / 2);
  if (el.type === "title") return { dur, slide: { axis: "y", from: "-0.06*H" } };
  if (el.type === "lower_third") return { dur, slide: { axis: "x", from: "-0.06*W" } };
  return { dur, slide: null };
}

/**
 * Build the ffmpeg filter_complex chain that composites each element's PNG (inputs 1..N) onto the
 * base video (input 0) for its time window — with an animated slide-in / slide-out. The overlay
 * position eases from the element's off-rest offset to 0 over the first `dur` seconds, holds at
 * rest, then eases back out over the final `dur` seconds. Returns the chain + the label to map.
 * Single-quoted expressions keep their commas from splitting the filtergraph.
 */
export function overlayFilterComplex(elements: OverlayElement[]): { filter: string; outLabel: string } {
  if (elements.length === 0) return { filter: "", outLabel: "0:v" };
  const parts: string[] = [];
  let prev = "0:v";
  elements.forEach((el, i) => {
    const idx = i + 1;
    const { dur, slide } = animationFor(el);
    const s = el.start.toFixed(2);
    const e = el.end.toFixed(2);
    const d = dur.toFixed(2);
    const exit = (el.end - dur).toFixed(2);
    // Ramp = `from` at the start (entrance) and end (exit), easing to 0 (rest) in between.
    const ramp = (from: string) => `'${from}*max(max(0,1-(t-${s})/${d}),max(0,(t-${exit})/${d}))'`;
    const x = slide?.axis === "x" ? ramp(slide.from) : "0";
    const y = slide?.axis === "y" ? ramp(slide.from) : "0";
    const out = `ov${idx}`;
    parts.push(`[${prev}][${idx}:v]overlay=${x}:${y}:enable='between(t,${s},${e})'[${out}]`);
    prev = out;
  });
  return { filter: parts.join(";"), outLabel: prev };
}

const fontArgs = (bold = true): string[] => {
  const f = bold ? process.env.OVERLAY_FONT : process.env.OVERLAY_FONT_REGULAR ?? process.env.OVERLAY_FONT;
  return f ? ["-font", f] : [];
};

const esc = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Build the ImageMagick `convert` args that draw one element on a full-frame transparent PNG. */
export function magickArgs(el: OverlayElement, dims: Dims, outPath: string): string[] {
  const { width: w, height: h } = dims;
  const base = ["-size", `${w}x${h}`, "xc:none"];

  if (el.type === "title") {
    const size = Math.round(h * 0.085);
    const sub = Math.round(h * 0.04);
    const args = [
      ...base,
      ...fontArgs(),
      "-gravity", "north",
      "-pointsize", String(size),
      "-fill", "white",
      "-stroke", "#000000A0",
      "-strokewidth", String(Math.max(2, Math.round(size * 0.04))),
      "-annotate", `+0+${Math.round(h * 0.18)}`, esc(el.text),
      "-stroke", "none",
    ];
    if (el.subtitle) {
      args.push("-fill", ACCENT, "-pointsize", String(sub), "-annotate", `+0+${Math.round(h * 0.18) + size + 14}`, esc(el.subtitle));
    }
    args.push(outPath);
    return args;
  }

  if (el.type === "lower_third") {
    const bx = Math.round(w * 0.06);
    const by = Math.round(h * 0.74);
    const bw = Math.round(w * 0.5);
    const bh = Math.round(h * 0.15);
    const nameSize = Math.round(h * 0.055);
    const subSize = Math.round(h * 0.034);
    const args = [
      ...base,
      // accent bar + dark backing
      "-fill", "#000000B0",
      "-draw", `roundrectangle ${bx},${by} ${bx + bw},${by + bh} 10,10`,
      "-fill", ACCENT,
      "-draw", `roundrectangle ${bx},${by} ${bx + Math.round(w * 0.012)},${by + bh} 6,6`,
      ...fontArgs(),
      "-gravity", "northwest",
      "-fill", "white",
      "-pointsize", String(nameSize),
      "-annotate", `+${bx + Math.round(w * 0.03)}+${by + Math.round(bh * 0.18)}`, esc(el.text),
    ];
    if (el.subtitle) {
      args.push("-fill", "#D8DEE6", "-pointsize", String(subSize), "-annotate", `+${bx + Math.round(w * 0.03)}+${by + Math.round(bh * 0.62)}`, esc(el.subtitle));
    }
    args.push(outPath);
    return args;
  }

  if (el.type === "callout") {
    const size = Math.round(h * 0.045);
    const pad = Math.round(size * 0.6);
    const boxW = Math.min(w * 0.5, el.text.length * size * 0.62 + pad * 2);
    const boxH = size + pad * 2;
    const cx = Math.round(clamp01(el.x) * w);
    const cy = Math.round(clamp01(el.y) * h);
    const x1 = Math.max(0, Math.round(cx - boxW / 2));
    const y1 = Math.max(0, Math.round(cy - boxH / 2));
    return [
      ...base,
      "-fill", ACCENT,
      "-draw", `roundrectangle ${x1},${y1} ${Math.round(x1 + boxW)},${Math.round(y1 + boxH)} 12,12`,
      ...fontArgs(),
      "-gravity", "northwest",
      "-fill", "white",
      "-pointsize", String(size),
      "-annotate", `+${x1 + pad}+${y1 + pad}`, esc(el.text),
      outPath,
    ];
  }

  // badge — small pill in a corner
  const size = Math.round(h * 0.035);
  const pad = Math.round(size * 0.6);
  const boxW = Math.round(el.text.length * size * 0.62 + pad * 2);
  const boxH = size + pad * 2;
  const margin = Math.round(h * 0.04);
  const left = el.corner === "tl" || el.corner === "bl";
  const top = el.corner === "tl" || el.corner === "tr";
  const x1 = left ? margin : w - margin - boxW;
  const y1 = top ? margin : h - margin - boxH;
  return [
    ...base,
    "-fill", ACCENT,
    "-draw", `roundrectangle ${x1},${y1} ${x1 + boxW},${y1 + boxH} ${Math.round(boxH / 2)},${Math.round(boxH / 2)}`,
    ...fontArgs(),
    "-gravity", "northwest",
    "-fill", "white",
    "-pointsize", String(size),
    "-annotate", `+${x1 + pad}+${y1 + pad}`, esc(el.text),
    outPath,
  ];
}

export interface OverlayResult {
  outputPath: string;
  applied: number;
}

/* v8 ignore start -- ImageMagick + ffmpeg subprocess composite; verified by live integration tests on each deploy */
/**
 * Render each element to a PNG via ImageMagick, then composite them all onto the input
 * video with a single ffmpeg pass. Returns the input untouched (copied) if no elements.
 */
export async function applyOverlays(
  inputVideo: string,
  rawElements: unknown,
  dims: Dims,
  workDir: string,
  jobId: string,
): Promise<OverlayResult> {
  const elements = normalizeElements(rawElements);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  if (elements.length === 0) {
    await run("ffmpeg", ["-y", "-i", inputVideo, "-c", "copy", "-movflags", "+faststart", outputPath]);
    return { outputPath, applied: 0 };
  }

  const pngs: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const png = `${workDir}/${jobId}-ov${i}.png`;
    await run("convert", magickArgs(elements[i], dims, png));
    pngs.push(png);
  }

  const { filter, outLabel } = overlayFilterComplex(elements);
  const inputs = ["-i", inputVideo];
  for (const p of pngs) inputs.push("-i", p);
  await run("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex", filter,
    "-map", `[${outLabel}]`,
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy", "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, applied: elements.length };
}
/* v8 ignore stop */
