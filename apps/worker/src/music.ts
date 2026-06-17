import { run, ffprobeHasAudio } from "./ffmpeg";

/**
 * Background music. Lay a music track under a clip at a chosen level. When the clip already has
 * audio, the original is kept at full and the music is ducked underneath via `amix` (with auto-
 * normalization disabled so the set levels are respected); when the clip is silent, the music
 * becomes its audio track. Output is bound to the clip's length. The volume normalizer and the
 * filter builder are pure + unit-tested; runMusicPipeline probes the clip's audio and wires ffmpeg.
 */

/** Coerce an untrusted music volume into [0, 1] at two decimals; non-finite → 0.3. */
export function clampMusicVolume(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

export interface MusicFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the audio filter. With original audio: scale the clip's audio to 1, the music to `vol`, and
 * `amix` them (duration bound to the clip, no renormalization). Silent clip: the music alone is the
 * track. Input 0 is the video, input 1 the music; the mixed/selected audio is labelled `[a]`.
 */
export function musicFilter(vol: number, hasAudio: boolean): MusicFilter {
  if (hasAudio) {
    return {
      filter: `[0:a]volume=1[a0];[1:a]volume=${vol}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`,
      maps: ["[a]"],
    };
  }
  return { filter: `[1:a]volume=${vol}[a]`, maps: ["[a]"] };
}

export interface MusicResult {
  outputPath: string;
  volume: number;
  hadAudio: boolean;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Mix `audioPath` under `videoPath` and encode to `${workDir}/${jobId}.mp4` (video copied through,
 * audio re-encoded to AAC, +faststart). `-shortest` bounds the output to the clip's length.
 */
export async function runMusicPipeline(
  videoPath: string,
  audioPath: string,
  rawVol: unknown,
  workDir: string,
  jobId: string,
): Promise<MusicResult> {
  const volume = clampMusicVolume(rawVol);
  const hasAudio = await ffprobeHasAudio(videoPath);
  const { filter, maps } = musicFilter(volume, hasAudio);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-i", audioPath,
    "-filter_complex", filter,
    "-map", "0:v",
    ...maps.flatMap((m) => ["-map", m]),
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, volume, hadAudio: hasAudio };
}
/* v8 ignore stop */
