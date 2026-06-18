import { run, ffprobeDimensions, ffprobeDuration } from "./ffmpeg";

/**
 * Progress bar. Overlay an animated bar along the bottom that fills left→right as the clip plays —
 * the familiar social/YouTube progress indicator. A full-width colored bar source is slid in from
 * the left via `overlay`'s per-frame `x` expression, so the visible portion grows with time. The
 * color/thickness normalizers, the bar-height math and the filter builder are pure + unit-tested;
 * runProgressPipeline probes the clip's size + duration and wires it into ffmpeg.
 */

export type ProgressColor = "cyan" | "magenta" | "lime" | "white" | "red";
export const PROGRESS_COLORS = ["cyan", "magenta", "lime", "white", "red"] as const;

export type ProgressThickness = "thin" | "medium" | "thick";
export const PROGRESS_THICKNESS = ["thin", "medium", "thick"] as const;

const THICKNESS_RATIO: Record<ProgressThickness, number> = { thin: 0.012, medium: 0.025, thick: 0.045 };

/** Coerce an untrusted color to a known one (defaults to cyan). */
export function normalizeProgressColor(raw: unknown): ProgressColor {
  return (PROGRESS_COLORS as readonly string[]).includes(String(raw)) ? (String(raw) as ProgressColor) : "cyan";
}

/** Coerce an untrusted thickness to a known one (defaults to medium). */
export function normalizeProgressThickness(raw: unknown): ProgressThickness {
  return (PROGRESS_THICKNESS as readonly string[]).includes(String(raw)) ? (String(raw) as ProgressThickness) : "medium";
}

/** Even-aligned bar height (px) for a frame height + thickness preset; never below 4px. */
export function progressBarHeight(frameHeight: number, thickness: ProgressThickness): number {
  return Math.max(4, Math.round((frameHeight * THICKNESS_RATIO[thickness]) / 2) * 2);
}

export interface ProgressFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex: a `width`x`barHeight` color bar slid in from the left so the visible
 * span is `width * t/duration`, overlaid `barHeight` px from the bottom.
 */
export function progressBarFilter(width: number, height: number, duration: number, barHeight: number, color: ProgressColor): ProgressFilter {
  const y = height - barHeight;
  const filter =
    `color=c=${color}:s=${width}x${barHeight}:d=${duration}[bar];` +
    `[0:v][bar]overlay=x='-${width}*(1-t/${duration})':y=${y}[v]`;
  return { filter, maps: ["[v]"] };
}

export interface ProgressResult {
  outputPath: string;
  color: ProgressColor;
  barHeight: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Overlay the progress bar onto `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264
 * veryfast, yuv420p, +faststart). Audio is copied through.
 */
export async function runProgressPipeline(
  inputPath: string,
  rawColor: unknown,
  rawThickness: unknown,
  workDir: string,
  jobId: string,
): Promise<ProgressResult> {
  const color = normalizeProgressColor(rawColor);
  const thickness = normalizeProgressThickness(rawThickness);
  const dims = await ffprobeDimensions(inputPath);
  const duration = Math.round((await ffprobeDuration(inputPath)) * 100) / 100;
  const barHeight = progressBarHeight(dims.height, thickness);
  const { filter, maps } = progressBarFilter(dims.width, dims.height, duration, barHeight, color);
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
  return { outputPath, color, barHeight };
}
/* v8 ignore stop */
