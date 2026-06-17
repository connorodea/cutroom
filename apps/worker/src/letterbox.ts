import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Letterbox (cinematic bars). Overlay black bars at the top and bottom of a clip to give it a
 * widescreen/cinema look at a target aspect ratio — the dimensions stay the same; the bars just
 * crop the visible area. The preset normalizer, the bar-height math and the filter builder are pure
 * + unit-tested; runLetterboxPipeline probes the source size and wires it into ffmpeg.
 */

export type LetterboxPreset = "cinema" | "wide" | "classic";
export const LETTERBOX_PRESETS = ["cinema", "wide", "classic"] as const;

/** Target visible aspect ratio (width / height) for each preset. */
export const LETTERBOX_RATIOS: Record<LetterboxPreset, number> = {
  cinema: 2.39,
  wide: 2.0,
  classic: 1.85,
};

/** Coerce an untrusted preset to a known one (defaults to cinema scope, 2.39:1). */
export function normalizeLetterboxPreset(raw: unknown): LetterboxPreset {
  return (LETTERBOX_PRESETS as readonly string[]).includes(String(raw)) ? (String(raw) as LetterboxPreset) : "cinema";
}

const even = (n: number): number => Math.round(n / 2) * 2;

/** Even-aligned height of each bar so the visible area is `width/ratio` tall; 0 if already wide enough. */
export function letterboxBarHeight(width: number, height: number, ratio: number): number {
  return Math.max(0, even((height - width / ratio) / 2));
}

export interface LetterboxFilter {
  vf: string;
  bar: number;
}

/**
 * Build the `-vf` value: two `drawbox` black bars (top + bottom) of the computed height. When no
 * bars are needed (the clip is already at/above the target ratio) the filter is a `null` pass-through.
 */
export function letterboxFilter(width: number, height: number, ratio: number): LetterboxFilter {
  const bar = letterboxBarHeight(width, height, ratio);
  if (bar <= 0) return { vf: "null", bar: 0 };
  const vf =
    `drawbox=x=0:y=0:w=${width}:h=${bar}:color=black:t=fill,` +
    `drawbox=x=0:y=${height - bar}:w=${width}:h=${bar}:color=black:t=fill`;
  return { vf, bar };
}

export interface LetterboxResult {
  outputPath: string;
  preset: LetterboxPreset;
  bar: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Letterbox `inputPath` to the preset's ratio and encode to `${workDir}/${jobId}.mp4` (libx264
 * veryfast, yuv420p, +faststart). Audio is copied through untouched.
 */
export async function runLetterboxPipeline(
  inputPath: string,
  rawPreset: unknown,
  workDir: string,
  jobId: string,
): Promise<LetterboxResult> {
  const preset = normalizeLetterboxPreset(rawPreset);
  const { width, height } = await ffprobeDimensions(inputPath);
  const { vf, bar } = letterboxFilter(width, height, LETTERBOX_RATIOS[preset]);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", vf,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, preset, bar };
}
/* v8 ignore stop */
