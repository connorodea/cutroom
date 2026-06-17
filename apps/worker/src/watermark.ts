import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Watermark. Burn a persistent brand/attribution text into a corner of the whole clip. Reuses the
 * proven ImageMagick → ffmpeg-overlay path (same as the graphics overlay tier): render the text on
 * a full-frame transparent PNG, then composite it over the entire video. The corner/opacity
 * normalizers and the ImageMagick arg builder are pure + unit-tested; runWatermarkPipeline wires
 * them into ffmpeg.
 */

export type Corner = "tl" | "tr" | "bl" | "br";
export const WATERMARK_CORNERS = ["tl", "tr", "bl", "br"] as const;

const GRAVITY: Record<Corner, string> = { tl: "NorthWest", tr: "NorthEast", bl: "SouthWest", br: "SouthEast" };

/** Coerce an untrusted corner to a known one (defaults to bottom-right). */
export function normalizeCorner(raw: unknown): Corner {
  return (WATERMARK_CORNERS as readonly string[]).includes(String(raw)) ? (String(raw) as Corner) : "br";
}

/** Coerce an untrusted opacity into [0.1, 1]; non-finite → 0.5. */
export function normalizeOpacity(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.5;
  return Math.round(Math.min(1, Math.max(0.1, n)) * 100) / 100;
}

const fontArgs = (): string[] => (process.env.OVERLAY_FONT ? ["-font", process.env.OVERLAY_FONT] : []);

export interface Dims {
  width: number;
  height: number;
}

/**
 * Build the ImageMagick `convert` args that draw the watermark text on a full-frame transparent PNG
 * at the corner's gravity — semi-transparent white with a faint dark outline for legibility.
 */
export function watermarkMagickArgs(text: string, corner: Corner, opacity: number, dims: Dims, outPath: string): string[] {
  const { width: w, height: h } = dims;
  const size = Math.max(14, Math.round(h * 0.04));
  const margin = Math.round(h * 0.03);
  return [
    "-size", `${w}x${h}`, "xc:none",
    ...fontArgs(),
    "-gravity", GRAVITY[corner],
    "-pointsize", String(size),
    "-stroke", `rgba(0,0,0,${Math.round(opacity * 0.7 * 100) / 100})`,
    "-strokewidth", "1",
    "-fill", `rgba(255,255,255,${opacity})`,
    "-annotate", `+${margin}+${margin}`, text,
    outPath,
  ];
}

export interface WatermarkResult {
  outputPath: string;
  corner: Corner;
  opacity: number;
}

/* v8 ignore start -- ImageMagick + ffmpeg subprocess composite; verified by live integration tests on each deploy */
/**
 * Render the watermark PNG and composite it over the full duration of `inputPath`, encoding to
 * `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p, +faststart; audio stream-copied).
 */
export async function runWatermarkPipeline(
  inputPath: string,
  text: string,
  rawCorner: unknown,
  rawOpacity: unknown,
  workDir: string,
  jobId: string,
): Promise<WatermarkResult> {
  const corner = normalizeCorner(rawCorner);
  const opacity = normalizeOpacity(rawOpacity);
  const dims = await ffprobeDimensions(inputPath);
  const pngPath = `${workDir}/${jobId}-wm.png`;
  await run("convert", watermarkMagickArgs(text, corner, opacity, dims, pngPath));
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-i", pngPath,
    "-filter_complex", "[0:v][1:v]overlay=0:0[v]",
    "-map", "[v]",
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, corner, opacity };
}
/* v8 ignore stop */
