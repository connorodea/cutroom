import { run } from "./ffmpeg";

/**
 * RGB split / chromatic aberration ("glitch"). Offset the red and blue channels in opposite
 * horizontal directions so edges fringe with colour — the trendy VHS/glitch look. The strength
 * normalizer and the filter builder are pure + unit-tested; runRgbSplitPipeline wires it into ffmpeg.
 */

export type RgbStrength = "light" | "medium" | "heavy";
export const RGB_STRENGTHS = ["light", "medium", "heavy"] as const;

/** Horizontal channel offset (px) per strength — larger = more aberration. */
export const RGB_SHIFTS: Record<RgbStrength, number> = { light: 4, medium: 10, heavy: 20 };

/** Coerce an untrusted strength to a known one (defaults to medium). */
export function normalizeRgbStrength(raw: unknown): RgbStrength {
  return (RGB_STRENGTHS as readonly string[]).includes(String(raw)) ? (String(raw) as RgbStrength) : "medium";
}

/** Build the ffmpeg `-vf` value: shift red right and blue left by `shift` px via `rgbashift`. */
export function rgbSplitFilter(shift: number): string {
  return `rgbashift=rh=${shift}:bh=-${shift}`;
}

export interface RgbSplitResult {
  outputPath: string;
  strength: RgbStrength;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Apply the RGB split to `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Audio is copied through.
 */
export async function runRgbSplitPipeline(
  inputPath: string,
  rawStrength: unknown,
  workDir: string,
  jobId: string,
): Promise<RgbSplitResult> {
  const strength = normalizeRgbStrength(rawStrength);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", rgbSplitFilter(RGB_SHIFTS[strength]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, strength };
}
/* v8 ignore stop */
