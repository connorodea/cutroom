import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Censor. Blur out a region of the frame — a face, a license plate, a logo. The frame is split, the
 * chosen region is cropped + box-blurred, then overlaid back in place, so only that rectangle is
 * obscured. Regions are named presets (center / edges); the region/strength normalizers, the
 * rect geometry, and the filter builder are pure + unit-tested; runCensorPipeline probes the source
 * size and wires it into ffmpeg. Output keeps the source's dimensions + audio.
 */

export type CensorRegion = "center" | "top" | "bottom" | "left" | "right";
export const CENSOR_REGIONS = ["center", "top", "bottom", "left", "right"] as const;

const REGION_RECTS: Record<CensorRegion, { x: number; y: number; w: number; h: number }> = {
  center: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
  top: { x: 0, y: 0, w: 1, h: 0.34 },
  bottom: { x: 0, y: 0.66, w: 1, h: 0.34 },
  left: { x: 0, y: 0, w: 0.34, h: 1 },
  right: { x: 0.66, y: 0, w: 0.34, h: 1 },
};

/** Coerce an untrusted region to a known preset (defaults to center). */
export function normalizeCensorRegion(raw: unknown): CensorRegion {
  return (CENSOR_REGIONS as readonly string[]).includes(String(raw)) ? (String(raw) as CensorRegion) : "center";
}

/** Coerce an untrusted blur strength into an integer in [2, 50]; non-finite → 20. */
export function clampCensorStrength(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(2, Math.round(n)));
}

const even = (n: number): number => Math.round(n / 2) * 2;
const evenFloor = (n: number): number => Math.floor(n / 2) * 2;

export interface CensorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixel rect for a region preset, even-aligned and clamped so `x+w`/`y+h` never exceed the frame. */
export function censorRect(region: CensorRegion, inW: number, inH: number): CensorRect {
  const r = REGION_RECTS[region];
  const x = even(inW * r.x);
  const y = even(inH * r.y);
  const w = Math.min(even(inW * r.w), evenFloor(inW - x));
  const h = Math.min(even(inH * r.h), evenFloor(inH - y));
  return { x, y, w, h };
}

export interface CensorFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex that splits the source, crops the region rect, box-blurs it at `strength`,
 * and overlays the blurred patch back at the rect's origin.
 */
export function censorFilter(region: CensorRegion, inW: number, inH: number, strength: number): CensorFilter {
  const { x, y, w, h } = censorRect(region, inW, inH);
  const filter =
    `[0:v]split=2[base][reg];` +
    `[reg]crop=${w}:${h}:${x}:${y},boxblur=${strength}[blur];` +
    `[base][blur]overlay=${x}:${y}[v]`;
  return { filter, maps: ["[v]"] };
}

export interface CensorResult {
  outputPath: string;
  region: CensorRegion;
  strength: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Blur a region of `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart). Audio is copied through untouched.
 */
export async function runCensorPipeline(
  inputPath: string,
  rawRegion: unknown,
  rawStrength: unknown,
  workDir: string,
  jobId: string,
): Promise<CensorResult> {
  const region = normalizeCensorRegion(rawRegion);
  const strength = clampCensorStrength(rawStrength);
  const { width, height } = await ffprobeDimensions(inputPath);
  const { filter, maps } = censorFilter(region, width, height, strength);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, region, strength };
}
/* v8 ignore stop */
