import { run } from "./ffmpeg";

/**
 * GIF export. Turns a clip into a shareable looping GIF using ffmpeg's two-pass palette flow
 * (palettegen → paletteuse) for good color at small size. The option normalizer and the filter
 * builder are pure + unit-tested; runGifPipeline wires them into ffmpeg (output is a `.gif`).
 */

export const GIF_MIN_FPS = 5;
export const GIF_MAX_FPS = 30;
export const GIF_DEFAULT_FPS = 12;
export const GIF_MIN_WIDTH = 120;
export const GIF_MAX_WIDTH = 1080;
export const GIF_DEFAULT_WIDTH = 480;

export interface GifOpts {
  fps: number;
  width: number;
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const clampInt = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(n)));

export interface GifInput {
  fps?: unknown;
  width?: unknown;
}

/** Coerce an untrusted GIF request into a clamped { fps, width } (whole numbers). */
export function normalizeGifOpts(input: GifInput = {}): GifOpts {
  return {
    fps: clampInt(num(input.fps, GIF_DEFAULT_FPS), GIF_MIN_FPS, GIF_MAX_FPS),
    width: clampInt(num(input.width, GIF_DEFAULT_WIDTH), GIF_MIN_WIDTH, GIF_MAX_WIDTH),
  };
}

/**
 * Build the ffmpeg `-vf` chain: set the frame rate, scale to the target width (height auto via
 * lanczos), then generate an optimized palette and apply it with light dithering.
 */
export function gifFilter(o: GifOpts): string {
  return `fps=${o.fps},scale=${o.width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
}

export interface GifResult {
  outputPath: string;
  fps: number;
  width: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Render `inputPath` to a looping GIF at `${workDir}/${jobId}.gif` (served at /api/media/:id, which
 * resolves the .gif extension). No audio — GIF has none.
 */
export async function runGifPipeline(
  inputPath: string,
  input: GifInput,
  workDir: string,
  jobId: string,
): Promise<GifResult> {
  const { fps, width } = normalizeGifOpts(input);
  const outputPath = `${workDir}/${jobId}.gif`;
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", gifFilter({ fps, width }),
    "-loop", "0",
    outputPath,
  ]);
  return { outputPath, fps, width };
}
/* v8 ignore stop */
