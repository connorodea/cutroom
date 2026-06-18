import { run, ffprobeDuration } from "./ffmpeg";

/**
 * Thumbnail / poster. Grab a single frame from a clip as a PNG (a cover image / poster). The time
 * normalizer and the ffmpeg arg builder are pure + unit-tested; runThumbnailPipeline probes the
 * duration and extracts the frame (output is a `.png`, served by /api/media/:id).
 */

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Coerce an untrusted timestamp into a valid frame time: a missing/invalid time defaults to the
 * clip's midpoint (or 0 when the duration is unknown); the value is floored at 0 and capped just
 * inside the clip end (duration - 0.05) so the grab always lands on a real frame.
 */
export function normalizeThumbTime(rawTime: unknown, duration: number): number {
  const hasDur = typeof duration === "number" && Number.isFinite(duration) && duration > 0;
  let t = num(rawTime, hasDur ? duration / 2 : 0);
  t = Math.max(0, t);
  if (hasDur) t = Math.min(t, duration - 0.05);
  return Math.round(t * 100) / 100;
}

/** Build the ffmpeg args to extract one frame at `time` (accurate seek: -ss after -i). */
export function thumbArgs(inputPath: string, outputPath: string, time: number): string[] {
  return ["-y", "-i", inputPath, "-ss", time.toFixed(2), "-frames:v", "1", outputPath];
}

export interface ThumbnailResult {
  outputPath: string;
  time: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Extract a poster frame from `inputPath` at the (clamped) time and write `${workDir}/${jobId}.png`
 * (served at /api/media/:id, which resolves the .png extension).
 */
export async function runThumbnailPipeline(
  inputPath: string,
  rawTime: unknown,
  workDir: string,
  jobId: string,
): Promise<ThumbnailResult> {
  const duration = await ffprobeDuration(inputPath);
  const time = normalizeThumbTime(rawTime, duration);
  const outputPath = `${workDir}/${jobId}.png`;
  await run("ffmpeg", thumbArgs(inputPath, outputPath, time));
  return { outputPath, time };
}
/* v8 ignore stop */
