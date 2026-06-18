import { run } from "./ffmpeg";

/**
 * Crop. Punch into a rectangular region of the frame (distinct from reframe, which fits/covers to a
 * target aspect). Regions are expressed as fractions of the frame so they're resolution-free. The
 * preset table, the normalizer (clamp + overrun-shrink) and the filter builder are pure +
 * unit-tested; runCropPipeline wires them into ffmpeg.
 */

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Named crop regions (fractions of the frame). "center" is a 50% punch-in. */
export const CROP_PRESETS: Record<string, CropRect> = {
  center: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
  top: { x: 0, y: 0, w: 1, h: 0.5 },
  bottom: { x: 0, y: 0.5, w: 1, h: 0.5 },
  left: { x: 0, y: 0, w: 0.5, h: 1 },
  right: { x: 0.5, y: 0, w: 0.5, h: 1 },
};

export const CROP_PRESET_NAMES = ["center", "top", "bottom", "left", "right"] as const;

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface CropInput {
  preset?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
}

/**
 * Resolve a crop request into a clamped rectangle: start from the named preset (or the center
 * punch-in for an unknown/missing name), apply any custom fraction overrides (x/y in [0, 0.99],
 * w/h in [0.01, 1]), then shrink w/h so the region never overruns the right/bottom edge.
 */
export function normalizeCrop(input: CropInput = {}): CropRect {
  const base = CROP_PRESETS[String(input.preset)] ?? CROP_PRESETS.center;
  const x = clamp(num(input.x, base.x), 0, 0.99);
  const y = clamp(num(input.y, base.y), 0, 0.99);
  let w = clamp(num(input.w, base.w), 0.01, 1);
  let h = clamp(num(input.h, base.h), 0.01, 1);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return { x: r3(x), y: r3(y), w: r3(w), h: r3(h) };
}

/** Build the ffmpeg `-vf` crop expression. Width/height are floored to even values (libx264/yuv420p). */
export function cropFilter(r: CropRect): string {
  return `crop=floor(iw*${r.w}/2)*2:floor(ih*${r.h}/2)*2:floor(iw*${r.x}):floor(ih*${r.y})`;
}

export interface CropResult {
  outputPath: string;
  rect: CropRect;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Crop `inputPath` to the requested region and encode to `${workDir}/${jobId}.mp4` (libx264
 * veryfast, yuv420p, +faststart). Audio is passed through (stream copy).
 */
export async function runCropPipeline(
  inputPath: string,
  input: CropInput,
  workDir: string,
  jobId: string,
): Promise<CropResult> {
  const rect = normalizeCrop(input);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", cropFilter(rect),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, rect };
}
/* v8 ignore stop */
