import { run, ffprobeHasAudio } from "./ffmpeg";

/**
 * Reverse / boomerang. "reverse" plays the clip backwards (audio too, when present); "boomerang"
 * plays it forward then reversed as a seamless silent loop (≈ 2× the length). The mode normalizer
 * and the filtergraph builder are pure + unit-tested; runReversePipeline wires them into ffmpeg.
 *
 * Note: ffmpeg's `reverse`/`areverse` buffer the whole stream in memory — fine for the short
 * social clips this targets, not for very long uploads.
 */

export type ReverseMode = "reverse" | "boomerang";
export const REVERSE_MODES = ["reverse", "boomerang"] as const;

/** Coerce an untrusted mode to a known one (defaults to reverse). */
export function normalizeReverseMode(raw: unknown): ReverseMode {
  return (REVERSE_MODES as readonly string[]).includes(String(raw)) ? (String(raw) as ReverseMode) : "reverse";
}

export interface ReverseFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex + stream maps. A boomerang splits the video, reverses one copy and
 * concatenates forward+reverse (video only — boomerangs are silent). A plain reverse reverses the
 * video and, when present, the audio.
 */
export function reverseFilter(mode: ReverseMode, hasAudio: boolean): ReverseFilter {
  if (mode === "boomerang") {
    return {
      filter: "[0:v]split[fwd][bk];[bk]reverse[rev];[fwd][rev]concat=n=2:v=1:a=0[v]",
      maps: ["[v]"],
    };
  }
  if (!hasAudio) return { filter: "[0:v]reverse[v]", maps: ["[v]"] };
  return { filter: "[0:v]reverse[v];[0:a]areverse[a]", maps: ["[v]", "[a]"] };
}

export interface ReverseResult {
  outputPath: string;
  mode: ReverseMode;
  hadAudio: boolean;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Reverse/boomerang `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Reversed audio is re-encoded to AAC when present (and the clip isn't a
 * boomerang, which is always silent).
 */
export async function runReversePipeline(
  inputPath: string,
  rawMode: unknown,
  workDir: string,
  jobId: string,
): Promise<ReverseResult> {
  const mode = normalizeReverseMode(rawMode);
  const hadAudio = await ffprobeHasAudio(inputPath);
  const { filter, maps } = reverseFilter(mode, hadAudio);
  const keepAudio = maps.includes("[a]");
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...(keepAudio ? ["-c:a", "aac"] : []),
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, mode, hadAudio };
}
/* v8 ignore stop */
