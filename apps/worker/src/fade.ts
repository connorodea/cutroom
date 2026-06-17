import { run, ffprobeDuration, ffprobeHasAudio } from "./ffmpeg";

/**
 * Fade in / out. Adds an intro fade-from-black and/or an outro fade-to-black (with matching audio
 * fades), anchored to the clip's duration. The kind/duration normalizers and the filter builder are
 * pure + unit-tested; runFadePipeline probes the duration + audio track and wires it into ffmpeg.
 */

export type FadeKind = "in" | "out" | "both";
export const FADE_KINDS = ["in", "out", "both"] as const;

/** Coerce an untrusted kind to a known one (defaults to both ends). */
export function normalizeFadeKind(raw: unknown): FadeKind {
  return (FADE_KINDS as readonly string[]).includes(String(raw)) ? (String(raw) as FadeKind) : "both";
}

/** Coerce an untrusted fade duration (seconds) into [0.1, 5]; non-finite → 0.5. */
export function normalizeFadeDur(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(5, Math.max(0.1, n));
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

export interface FadeFilters {
  vf: string;
  af: string;
}

/**
 * Build the ffmpeg `-vf`/`-af` fade chains for a kind + duration, anchoring the fade-out `dur`
 * seconds before the clip ends (never before 0). Video uses `fade`, audio uses `afade`.
 */
export function fadeFilters(kind: FadeKind, dur: number, duration: number): FadeFilters {
  const fadeIn = kind === "in" || kind === "both";
  const fadeOut = kind === "out" || kind === "both";
  const outStart = Math.max(0, duration - dur).toFixed(2);
  const v: string[] = [];
  const a: string[] = [];
  if (fadeIn) {
    v.push(`fade=t=in:st=0:d=${fmt(dur)}`);
    a.push(`afade=t=in:st=0:d=${fmt(dur)}`);
  }
  if (fadeOut) {
    v.push(`fade=t=out:st=${outStart}:d=${fmt(dur)}`);
    a.push(`afade=t=out:st=${outStart}:d=${fmt(dur)}`);
  }
  return { vf: v.join(","), af: a.join(",") };
}

export interface FadeResult {
  outputPath: string;
  kind: FadeKind;
  dur: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Apply fades to `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart). The audio fade is applied + re-encoded to AAC only when the source has audio.
 */
export async function runFadePipeline(
  inputPath: string,
  rawKind: unknown,
  rawDur: unknown,
  workDir: string,
  jobId: string,
): Promise<FadeResult> {
  const kind = normalizeFadeKind(rawKind);
  const dur = normalizeFadeDur(rawDur);
  const duration = await ffprobeDuration(inputPath);
  const hasAudio = await ffprobeHasAudio(inputPath);
  const { vf, af } = fadeFilters(kind, dur, duration);
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
  return { outputPath, kind, dur };
}
/* v8 ignore stop */
