import { run, ffprobeHasAudio } from "./ffmpeg";

/**
 * Speed change (slow-motion / timelapse). Retimes a clip by a speed factor: >1 speeds up
 * (timelapse), <1 slows down (slow-mo). Video is retimed with `setpts`; audio is retimed with
 * `atempo`, which only supports [0.5, 2.0] per instance — so an arbitrary factor is decomposed
 * into a chain of atempo filters whose product equals the factor. The builders are pure +
 * unit-tested; runSpeedPipeline wires them into ffmpeg.
 */

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 8;
export const DEFAULT_SPEED = 2;

/** Coerce an untrusted speed factor into the supported range; non-finite / non-positive → default. */
export function normalizeSpeed(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, n));
}

/**
 * Decompose a speed factor into a chain of `atempo` filters, each within atempo's well-supported
 * [0.5, 2.0] range, whose product equals the (normalized) factor. e.g. 4 → [2,2]; 0.25 → [0.5,0.5].
 */
export function atempoChain(factor: number): string[] {
  let f = normalizeSpeed(factor);
  const parts: string[] = [];
  while (f > 2) {
    parts.push("atempo=2.0");
    f /= 2;
  }
  while (f < 0.5) {
    parts.push("atempo=0.5");
    f *= 2;
  }
  parts.push(`atempo=${f.toFixed(3)}`);
  return parts;
}

export interface SpeedFilter {
  /** The `filter_complex` graph string. */
  filter: string;
  /** Stream output labels to `-map`, in order. */
  maps: string[];
}

/**
 * Build the filter_complex + stream maps to retime a clip by `factor`. Video PTS is scaled by
 * `1/factor`; audio (when present) is retimed via the atempo chain. With no audio, only the video
 * stream is produced/mapped (a `[0:a]` reference would fail on a silent clip).
 */
export function speedFilterComplex(factor: number, hasAudio: boolean): SpeedFilter {
  const f = normalizeSpeed(factor);
  const video = `[0:v]setpts=${(1 / f).toFixed(4)}*PTS[v]`;
  if (!hasAudio) return { filter: video, maps: ["[v]"] };
  const audio = `[0:a]${atempoChain(f).join(",")}[a]`;
  return { filter: `${video};${audio}`, maps: ["[v]", "[a]"] };
}

export interface SpeedResult {
  outputPath: string;
  factor: number;
  hadAudio: boolean;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Retime `inputPath` by `factor` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Audio is retimed + re-encoded to AAC when the source has an audio track.
 */
export async function runSpeedPipeline(
  inputPath: string,
  factor: number,
  workDir: string,
  jobId: string,
): Promise<SpeedResult> {
  const f = normalizeSpeed(factor);
  const hadAudio = await ffprobeHasAudio(inputPath);
  const { filter, maps } = speedFilterComplex(f, hadAudio);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...(hadAudio ? ["-c:a", "aac"] : []),
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, factor: f, hadAudio };
}
/* v8 ignore stop */
