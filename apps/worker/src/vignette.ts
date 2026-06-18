import { run } from "./ffmpeg";

/**
 * Vignette. Darken the corners of a clip for a cinematic/focus-pulling look via ffmpeg's `vignette`
 * filter, whose lens `angle` controls the falloff — a larger angle darkens the corners more. The
 * strength normalizer and the filter builder are pure + unit-tested; runVignettePipeline wires it in.
 */

export type VignetteStrength = "subtle" | "medium" | "strong";
export const VIGNETTE_STRENGTHS = ["subtle", "medium", "strong"] as const;

/** Lens angle (radians, as an ffmpeg expression) per strength — larger = darker corners. */
export const VIGNETTE_ANGLES: Record<VignetteStrength, string> = {
  subtle: "PI/8",
  medium: "PI/5",
  strong: "PI/3",
};

/** Coerce an untrusted strength to a known one (defaults to medium). */
export function normalizeVignetteStrength(raw: unknown): VignetteStrength {
  return (VIGNETTE_STRENGTHS as readonly string[]).includes(String(raw)) ? (String(raw) as VignetteStrength) : "medium";
}

/** Build the ffmpeg `-vf` value for a vignette at the strength's angle. */
export function vignetteFilter(strength: VignetteStrength): string {
  return `vignette=angle=${VIGNETTE_ANGLES[strength]}`;
}

export interface VignetteResult {
  outputPath: string;
  strength: VignetteStrength;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Apply a vignette to `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Audio is copied through.
 */
export async function runVignettePipeline(
  inputPath: string,
  rawStrength: unknown,
  workDir: string,
  jobId: string,
): Promise<VignetteResult> {
  const strength = normalizeVignetteStrength(rawStrength);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", vignetteFilter(strength),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, strength };
}
/* v8 ignore stop */
