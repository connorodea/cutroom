import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Border / matte. Pad a clip with a solid colored frame on every side — the framed look for social
 * posts, or breathing room around a clip. Output grows by 2×thickness in each dimension; audio is
 * preserved. The color/thickness normalizers and the pad-filter builder are pure + unit-tested;
 * runBorderPipeline probes the source size and wires it into ffmpeg.
 */

export const BORDER_COLORS = ["white", "black"] as const;

/** Coerce an untrusted color to an ffmpeg token. Named colors pass; valid 0xRRGGBB passes; else white. */
export function normalizeBorderColor(raw: unknown): string {
  const s = String(raw);
  if ((BORDER_COLORS as readonly string[]).includes(s)) return s;
  if (/^0x[0-9a-fA-F]{6}$/.test(s)) return "0x" + s.slice(2).toUpperCase();
  return "white";
}

/** Coerce an untrusted thickness into an integer px in [2, 200]; non-finite → 24. */
export function clampBorderThickness(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 24;
  return Math.min(200, Math.max(2, Math.round(n)));
}

export interface BorderFilter {
  vf: string;
  outW: number;
  outH: number;
}

/**
 * Build the `pad` filter that frames a `inW`x`inH` source with a `thickness`-px border of `color`,
 * centering the source. The padded canvas is the source plus `thickness` on every side.
 */
export function borderFilter(thickness: number, color: string, inW: number, inH: number): BorderFilter {
  const outW = inW + thickness * 2;
  const outH = inH + thickness * 2;
  return { vf: `pad=${outW}:${outH}:${thickness}:${thickness}:color=${color}`, outW, outH };
}

export interface BorderResult {
  outputPath: string;
  thickness: number;
  color: string;
  width: number;
  height: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Frame `inputPath` with a colored border and encode to `${workDir}/${jobId}.mp4` (libx264
 * veryfast, yuv420p, +faststart). Audio is copied through untouched.
 */
export async function runBorderPipeline(
  inputPath: string,
  rawThickness: unknown,
  rawColor: unknown,
  workDir: string,
  jobId: string,
): Promise<BorderResult> {
  const thickness = clampBorderThickness(rawThickness);
  const color = normalizeBorderColor(rawColor);
  const { width, height } = await ffprobeDimensions(inputPath);
  const { vf, outW, outH } = borderFilter(thickness, color, width, height);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", vf,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, thickness, color, width: outW, height: outH };
}
/* v8 ignore stop */
