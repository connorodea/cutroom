import { run, ffprobeDuration } from "./ffmpeg";

/**
 * Precise trim ("keep seconds A to B"). Unlike clean-up (auto-cuts silences) or transcript-cut
 * (removes words), this keeps a single explicit [start, end] window. The window normalizer and
 * the ffmpeg arg builder are pure + unit-tested; runTrimPipeline probes duration and runs ffmpeg.
 */

export interface TrimWindow {
  start: number;
  end: number;
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Clamp an untrusted [start, end] window into the clip. start is floored at 0 (and capped at the
 * duration); end is capped at the duration and, when missing/invalid or not after start, falls back
 * to the end of the clip. Guarantees end > start. When duration is unknown (<= 0) the upper bounds
 * are skipped and a missing end defaults to start + 1s.
 */
export function normalizeTrim(rawStart: unknown, rawEnd: unknown, duration: number): TrimWindow {
  const hasDur = typeof duration === "number" && Number.isFinite(duration) && duration > 0;
  let start = Math.max(0, num(rawStart, 0));
  if (hasDur) start = Math.min(start, duration);
  let end = num(rawEnd, hasDur ? duration : start + 1);
  if (hasDur) end = Math.min(end, duration);
  if (end <= start) end = hasDur ? duration : start + 1;
  end = Math.max(end, start + 0.1); // final guard: always a positive-length window
  return { start: r2(start), end: r2(end) };
}

/**
 * Build the ffmpeg args to trim `inputPath` to `[start, end]` and re-encode to `outputPath`.
 * `-ss`/`-to` are placed AFTER `-i` so they use absolute input timestamps for frame-accurate
 * cutting (input-side `-ss` snaps to keyframes); re-encoding makes the cut exact.
 */
export function trimArgs(inputPath: string, outputPath: string, w: TrimWindow): string[] {
  return [
    "-y",
    "-i", inputPath,
    "-ss", w.start.toFixed(2),
    "-to", w.end.toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath,
  ];
}

export interface TrimResult {
  outputPath: string;
  start: number;
  end: number;
  durationSec: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Trim `inputPath` to the requested window (clamped against the probed duration) and encode to
 * `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p, +faststart, AAC audio).
 */
export async function runTrimPipeline(
  inputPath: string,
  rawStart: unknown,
  rawEnd: unknown,
  workDir: string,
  jobId: string,
): Promise<TrimResult> {
  const duration = await ffprobeDuration(inputPath);
  const window = normalizeTrim(rawStart, rawEnd, duration);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", trimArgs(inputPath, outputPath, window));
  return { outputPath, start: window.start, end: window.end, durationSec: r2(window.end - window.start) };
}
/* v8 ignore stop */
