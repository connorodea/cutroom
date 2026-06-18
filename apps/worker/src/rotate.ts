import { run } from "./ffmpeg";

/**
 * Rotate / flip. Fixes orientation (sideways phone footage) or mirrors a clip. Quarter turns use
 * ffmpeg's `transpose`; 180° is two transposes; flips use `hflip`/`vflip`. The mapping is pure +
 * unit-tested; runRotatePipeline wires it into ffmpeg.
 */

export type Orientation = "cw" | "ccw" | "180" | "flip-h" | "flip-v";
export const ORIENTATIONS = ["cw", "ccw", "180", "flip-h", "flip-v"] as const;

/** Coerce an untrusted orientation to a known one (defaults to a clockwise quarter turn). */
export function normalizeOrientation(raw: unknown): Orientation {
  return (ORIENTATIONS as readonly string[]).includes(String(raw)) ? (String(raw) as Orientation) : "cw";
}

/** Build the ffmpeg `-vf` value for an orientation. */
export function rotateFilter(o: Orientation): string {
  switch (o) {
    case "cw":
      return "transpose=1"; // 90° clockwise
    case "ccw":
      return "transpose=2"; // 90° counter-clockwise
    case "180":
      return "transpose=1,transpose=1"; // 180°
    case "flip-h":
      return "hflip"; // mirror left/right
    case "flip-v":
      return "vflip"; // mirror top/bottom
  }
}

/** Whether the orientation swaps width and height (the quarter-turn rotations). */
export function swapsDimensions(o: Orientation): boolean {
  return o === "cw" || o === "ccw";
}

export interface RotateResult {
  outputPath: string;
  orientation: Orientation;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Rotate/flip `inputPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart). Audio is passed through (stream copy).
 */
export async function runRotatePipeline(
  inputPath: string,
  rawOrientation: unknown,
  workDir: string,
  jobId: string,
): Promise<RotateResult> {
  const orientation = normalizeOrientation(rawOrientation);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", rotateFilter(orientation),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, orientation };
}
/* v8 ignore stop */
