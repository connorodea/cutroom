import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Pixelate (retro mosaic). Reduce a clip to chunky blocks by down-scaling it (area-averaging the
 * detail away) then up-scaling back with nearest-neighbour so each block is a flat square — the 8-bit
 * / mosaic look. The size normalizer, the downscaled-dims math and the filter builder are pure +
 * unit-tested; runPixelatePipeline probes the source size and wires it into ffmpeg.
 */

export type PixelSize = "small" | "medium" | "large";
export const PIXEL_SIZES = ["small", "medium", "large"] as const;

/** Block width (px) per size — larger = chunkier blocks. */
export const PIXEL_BLOCKS: Record<PixelSize, number> = { small: 8, medium: 16, large: 32 };

/** Coerce an untrusted size to a known one (defaults to medium). */
export function normalizePixelSize(raw: unknown): PixelSize {
  return (PIXEL_SIZES as readonly string[]).includes(String(raw)) ? (String(raw) as PixelSize) : "medium";
}

/** Down-scaled dimension: the frame dimension divided by the block size, rounded, never below 1. */
export function pixelateDims(dimension: number, blockSize: number): number {
  return Math.max(1, Math.round(dimension / blockSize));
}

/** Build the ffmpeg `-vf` value: down-scale to the block grid, then up-scale back with neighbor. */
export function pixelateFilter(width: number, height: number, blockSize: number): string {
  const downW = pixelateDims(width, blockSize);
  const downH = pixelateDims(height, blockSize);
  return `scale=${downW}:${downH},scale=${width}:${height}:flags=neighbor`;
}

export interface PixelateResult {
  outputPath: string;
  size: PixelSize;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Pixelate `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart). Audio is copied through.
 */
export async function runPixelatePipeline(
  inputPath: string,
  rawSize: unknown,
  workDir: string,
  jobId: string,
): Promise<PixelateResult> {
  const size = normalizePixelSize(rawSize);
  const { width, height } = await ffprobeDimensions(inputPath);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", pixelateFilter(width, height, PIXEL_BLOCKS[size]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, size };
}
/* v8 ignore stop */
