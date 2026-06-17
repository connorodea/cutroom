import { run, ffprobeHasAudio } from "./ffmpeg";

/**
 * Audio operations: scale the volume, mute, or normalize loudness to a broadcast target. The
 * mode/level normalizers and the filter builder are pure + unit-tested; runAudioPipeline probes
 * for an audio track and wires the filter into ffmpeg (a silent clip is passed through untouched).
 */

export type AudioMode = "volume" | "mute" | "normalize";
export const AUDIO_MODES = ["volume", "mute", "normalize"] as const;

/** Coerce an untrusted mode to a known one (defaults to volume). */
export function normalizeAudioMode(raw: unknown): AudioMode {
  return (AUDIO_MODES as readonly string[]).includes(String(raw)) ? (String(raw) as AudioMode) : "volume";
}

/** Coerce an untrusted volume multiplier into [0, 4]; non-finite → 1 (unchanged). */
export function normalizeLevel(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(0, n));
}

/** Build the ffmpeg `-af` value for a mode (+ level for the volume mode). */
export function audioFilter(mode: AudioMode, level: number): string {
  if (mode === "mute") return "volume=0";
  if (mode === "normalize") return "loudnorm=I=-16:TP=-1.5:LRA=11";
  return `volume=${Math.round(level * 100) / 100}`;
}

export interface AudioResult {
  outputPath: string;
  mode: AudioMode;
  hadAudio: boolean;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Apply an audio operation to `inputPath` and encode to `${workDir}/${jobId}.mp4` (video stream
 * copied, audio re-encoded to AAC). A clip with no audio track is copied through unchanged.
 */
export async function runAudioPipeline(
  inputPath: string,
  rawMode: unknown,
  rawLevel: unknown,
  workDir: string,
  jobId: string,
): Promise<AudioResult> {
  const mode = normalizeAudioMode(rawMode);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  const hadAudio = await ffprobeHasAudio(inputPath);
  if (!hadAudio) {
    await run("ffmpeg", ["-y", "-i", inputPath, "-c", "copy", "-movflags", "+faststart", outputPath]);
    return { outputPath, mode, hadAudio: false };
  }
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-af", audioFilter(mode, normalizeLevel(rawLevel)),
    "-c:v", "copy",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, mode, hadAudio: true };
}
/* v8 ignore stop */
