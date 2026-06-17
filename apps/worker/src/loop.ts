import { run, ffprobeHasAudio } from "./ffmpeg";

/**
 * Loop. Repeat a clip end-to-end N times (extend a short clip / make a seamless repeat) by
 * splitting the stream into N copies and concatenating them. The count normalizer and the
 * filtergraph builder are pure + unit-tested; runLoopPipeline wires them into ffmpeg.
 */

export const LOOP_MIN = 2;
export const LOOP_MAX = 10;
export const LOOP_DEFAULT = 2;

/** Coerce an untrusted loop count into [2, 10] (whole number); non-finite → 2. */
export function normalizeLoopCount(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return LOOP_DEFAULT;
  return Math.min(LOOP_MAX, Math.max(LOOP_MIN, Math.round(n)));
}

export interface LoopFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex + stream maps to repeat the clip `count` times. The source is split into
 * `count` copies (and the audio asplit into `count`) which are concatenated in order. With no audio
 * the audio half is omitted (concat a=0).
 */
export function loopFilter(count: number, hasAudio: boolean): LoopFilter {
  const v = Array.from({ length: count }, (_, i) => `[v${i}]`);
  const parts = [`[0:v]split=${count}${v.join("")}`];
  if (hasAudio) {
    const a = Array.from({ length: count }, (_, i) => `[a${i}]`);
    parts.push(`[0:a]asplit=${count}${a.join("")}`);
    const interleaved = Array.from({ length: count }, (_, i) => `[v${i}][a${i}]`).join("");
    parts.push(`${interleaved}concat=n=${count}:v=1:a=1[v][a]`);
    return { filter: parts.join(";"), maps: ["[v]", "[a]"] };
  }
  parts.push(`${v.join("")}concat=n=${count}:v=1:a=0[v]`);
  return { filter: parts.join(";"), maps: ["[v]"] };
}

export interface LoopResult {
  outputPath: string;
  count: number;
  hadAudio: boolean;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Loop `inputPath` `count` times and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Audio is concatenated + re-encoded to AAC when the source has a track.
 */
export async function runLoopPipeline(
  inputPath: string,
  rawCount: unknown,
  workDir: string,
  jobId: string,
): Promise<LoopResult> {
  const count = normalizeLoopCount(rawCount);
  const hadAudio = await ffprobeHasAudio(inputPath);
  const { filter, maps } = loopFilter(count, hadAudio);
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
  return { outputPath, count, hadAudio };
}
/* v8 ignore stop */
