import { run } from "./ffmpeg";

/**
 * Color grade. Applies a named look (or custom brightness/contrast/saturation/gamma) to a video
 * via ffmpeg's `eq` filter. The preset table, the normalizer (clamp + preset resolution) and the
 * filter builder are all pure + unit-tested; runColorPipeline wires them into ffmpeg.
 */

export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  gammaR: number;
  gammaB: number;
}

const NONE: ColorAdjust = { brightness: 0, contrast: 1, saturation: 1, gamma: 1, gammaR: 1, gammaB: 1 };

/** Named looks. Each is a full `eq` adjustment; "none" is the neutral pass-through. */
export const COLOR_PRESETS: Record<string, ColorAdjust> = {
  none: NONE,
  vivid: { ...NONE, contrast: 1.12, saturation: 1.35 },
  warm: { ...NONE, saturation: 1.08, gammaR: 1.06, gammaB: 0.94 },
  cool: { ...NONE, saturation: 1.05, gammaR: 0.94, gammaB: 1.08 },
  bw: { ...NONE, contrast: 1.05, saturation: 0 },
  cinematic: { ...NONE, brightness: -0.02, contrast: 1.15, saturation: 0.9, gamma: 0.95 },
};

export const COLOR_PRESET_NAMES = ["none", "vivid", "warm", "cool", "bw", "cinematic"] as const;

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export interface ColorInput {
  preset?: unknown;
  brightness?: unknown;
  contrast?: unknown;
  saturation?: unknown;
  gamma?: unknown;
  gammaR?: unknown;
  gammaB?: unknown;
}

/**
 * Resolve a color request into a clamped adjustment: start from the named preset (or the neutral
 * look for an unknown/missing name), then apply any provided custom overrides, each clamped to a
 * safe range (brightness [-1,1]; contrast/saturation [0,3]; gammas [0.1,3]).
 */
export function normalizeColor(input: ColorInput = {}): ColorAdjust {
  const presetName = typeof input.preset === "string" ? input.preset : "";
  const base = COLOR_PRESETS[presetName] ?? COLOR_PRESETS.none;
  return {
    brightness: clamp(num(input.brightness, base.brightness), -1, 1),
    contrast: clamp(num(input.contrast, base.contrast), 0, 3),
    saturation: clamp(num(input.saturation, base.saturation), 0, 3),
    gamma: clamp(num(input.gamma, base.gamma), 0.1, 3),
    gammaR: clamp(num(input.gammaR, base.gammaR), 0.1, 3),
    gammaB: clamp(num(input.gammaB, base.gammaB), 0.1, 3),
  };
}

const r3 = (n: number): string => String(Math.round(n * 1000) / 1000);

/** Build the ffmpeg `eq=` video filter string for an adjustment. */
export function colorFilter(a: ColorAdjust): string {
  return `eq=brightness=${r3(a.brightness)}:contrast=${r3(a.contrast)}:saturation=${r3(a.saturation)}:gamma=${r3(a.gamma)}:gamma_r=${r3(a.gammaR)}:gamma_b=${r3(a.gammaB)}`;
}

export interface ColorResult {
  outputPath: string;
  adjust: ColorAdjust;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Apply a color grade to `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Audio is passed through (stream copy).
 */
export async function runColorPipeline(
  inputPath: string,
  input: ColorInput,
  workDir: string,
  jobId: string,
): Promise<ColorResult> {
  const adjust = normalizeColor(input);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", colorFilter(adjust),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, adjust };
}
/* v8 ignore stop */
