import { run, ffprobeHasAudio } from "./ffmpeg";

/**
 * Freeze-frame (hold). Extends a clip by holding its first or last frame still for a few seconds —
 * the classic "let the ending land" or "pause on the opening shot" beat. Video uses ffmpeg `tpad`
 * to clone the boundary frame; audio is padded with silence (end) or delayed (start) so it stays in
 * sync. The position/seconds normalizers and the filter builder are pure + unit-tested;
 * runFreezePipeline probes the audio track and wires it into ffmpeg.
 */

export type FreezePosition = "start" | "end";
export const FREEZE_POSITIONS = ["start", "end"] as const;

/** Coerce an untrusted position to a known one (defaults to holding the end). */
export function normalizeFreezePosition(raw: unknown): FreezePosition {
  return String(raw) === "start" ? "start" : "end";
}

/** Coerce an untrusted hold length (seconds) into [0.5, 10], one decimal; non-finite → 2. */
export function normalizeFreezeSeconds(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 2;
  return Math.min(10, Math.max(0.5, Math.round(n * 10) / 10));
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

export interface FreezeFilters {
  vf: string;
  af: string;
}

/**
 * Build the ffmpeg `-vf`/`-af` chains for a freeze. End → `tpad=stop_mode=clone` extends past the
 * last frame and `apad` appends matching silence. Start → `tpad=start_mode=clone` prepends the
 * first frame and `adelay` pushes the audio back by the same amount (kept in milliseconds).
 */
export function freezeFilters(position: FreezePosition, seconds: number): FreezeFilters {
  if (position === "start") {
    return {
      vf: `tpad=start_mode=clone:start_duration=${fmt(seconds)}`,
      af: `adelay=${Math.round(seconds * 1000)}:all=1`,
    };
  }
  return {
    vf: `tpad=stop_mode=clone:stop_duration=${fmt(seconds)}`,
    af: `apad=pad_dur=${fmt(seconds)}`,
  };
}

export interface FreezeResult {
  outputPath: string;
  position: FreezePosition;
  seconds: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Hold a frame of `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart). The audio pad/delay is applied + re-encoded to AAC only when the source has audio.
 */
export async function runFreezePipeline(
  inputPath: string,
  rawPosition: unknown,
  rawSeconds: unknown,
  workDir: string,
  jobId: string,
): Promise<FreezeResult> {
  const position = normalizeFreezePosition(rawPosition);
  const seconds = normalizeFreezeSeconds(rawSeconds);
  const hasAudio = await ffprobeHasAudio(inputPath);
  const { vf, af } = freezeFilters(position, seconds);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", vf,
    ...(hasAudio ? ["-af", af] : []),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...(hasAudio ? ["-c:a", "aac"] : []),
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, position, seconds };
}
/* v8 ignore stop */
