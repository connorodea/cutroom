import { run } from "./ffmpeg";

/**
 * Waveform / audiogram. Turn an audio file into a shareable video that draws its waveform — the
 * podcast/music social clip. ffmpeg `showwaves` renders the audio into a video stream at a target
 * size, and the original audio rides along so the clip plays. The mode/color/aspect normalizers and
 * the filter builder are pure + unit-tested; runWaveformPipeline wires them into ffmpeg.
 */

export type WaveMode = "cline" | "line" | "point";
export const WAVE_MODES = ["cline", "line", "point"] as const;

export type WaveColor = "cyan" | "magenta" | "lime" | "white";
export const WAVE_COLORS = ["cyan", "magenta", "lime", "white"] as const;

export type WaveAspect = "square" | "landscape" | "portrait";
export const WAVE_TARGETS: Record<WaveAspect, { width: number; height: number }> = {
  square: { width: 720, height: 720 },
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
};

/** Coerce an untrusted mode to a known one (defaults to a centered line). */
export function normalizeWaveMode(raw: unknown): WaveMode {
  return (WAVE_MODES as readonly string[]).includes(String(raw)) ? (String(raw) as WaveMode) : "cline";
}

/** Coerce an untrusted color to a known one (defaults to cyan). */
export function normalizeWaveColor(raw: unknown): WaveColor {
  return (WAVE_COLORS as readonly string[]).includes(String(raw)) ? (String(raw) as WaveColor) : "cyan";
}

/** Coerce an untrusted aspect to a known target (defaults to square). */
export function normalizeWaveAspect(raw: unknown): WaveAspect {
  return raw === "landscape" || raw === "portrait" ? raw : "square";
}

export interface WaveformFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex that renders the audio (input 0) into a `width`x`height` `showwaves`
 * video at 25fps in the given mode/color, labelled `[v]`.
 */
export function waveformFilter(width: number, height: number, mode: WaveMode, color: WaveColor): WaveformFilter {
  return {
    filter: `[0:a]showwaves=s=${width}x${height}:mode=${mode}:colors=${color}:rate=25,format=yuv420p[v]`,
    maps: ["[v]"],
  };
}

export interface WaveformResult {
  outputPath: string;
  mode: WaveMode;
  color: WaveColor;
  aspect: WaveAspect;
  width: number;
  height: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Render `audioPath` into a waveform video at `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart) with the original audio muxed in. `-shortest` bounds it to the audio's length.
 */
export async function runWaveformPipeline(
  audioPath: string,
  rawMode: unknown,
  rawColor: unknown,
  rawAspect: unknown,
  workDir: string,
  jobId: string,
): Promise<WaveformResult> {
  const mode = normalizeWaveMode(rawMode);
  const color = normalizeWaveColor(rawColor);
  const aspect = normalizeWaveAspect(rawAspect);
  const { width, height } = WAVE_TARGETS[aspect];
  const { filter, maps } = waveformFilter(width, height, mode, color);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", audioPath,
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-map", "0:a",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, mode, color, aspect, width, height };
}
/* v8 ignore stop */
