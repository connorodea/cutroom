import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Meme text. Burn classic top/bottom Impact-style captions onto a clip — big uppercase white text
 * with a heavy black outline. Reuses the proven ImageMagick → ffmpeg-overlay path (same as the
 * watermark/graphics tiers): render the text on a full-frame transparent PNG, then composite it over
 * the whole video. The ImageMagick arg builder is pure + unit-tested; runMemePipeline wires it in.
 */

const fontArgs = (): string[] => (process.env.OVERLAY_FONT ? ["-font", process.env.OVERLAY_FONT] : []);

export interface Dims {
  width: number;
  height: number;
}

/**
 * Build the ImageMagick `convert` args that draw uppercased `topText`/`bottomText` at the top and
 * bottom of a full-frame transparent PNG, in big white with a black outline. Empty strings are
 * skipped so a one-line meme renders only the line it has.
 */
export function memeMagickArgs(topText: string, bottomText: string, dims: Dims, outPath: string): string[] {
  const { width: w, height: h } = dims;
  const size = Math.max(20, Math.round(h * 0.09));
  const margin = Math.round(h * 0.04);
  const stroke = Math.max(2, Math.round(size * 0.06));
  const args = [
    "-size", `${w}x${h}`, "xc:none",
    ...fontArgs(),
    "-pointsize", String(size),
    "-stroke", "black",
    "-strokewidth", String(stroke),
    "-fill", "white",
  ];
  if (topText) args.push("-gravity", "North", "-annotate", `+0+${margin}`, topText.toUpperCase());
  if (bottomText) args.push("-gravity", "South", "-annotate", `+0+${margin}`, bottomText.toUpperCase());
  args.push(outPath);
  return args;
}

export interface MemeResult {
  outputPath: string;
  top: string;
  bottom: string;
}

/* v8 ignore start -- ImageMagick + ffmpeg subprocess composite; verified by live integration tests on each deploy */
/**
 * Render the meme-text PNG and composite it over the full duration of `inputPath`, encoding to
 * `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p, +faststart; audio stream-copied).
 */
export async function runMemePipeline(
  inputPath: string,
  rawTop: unknown,
  rawBottom: unknown,
  workDir: string,
  jobId: string,
): Promise<MemeResult> {
  const top = String(rawTop ?? "").trim();
  const bottom = String(rawBottom ?? "").trim();
  const dims = await ffprobeDimensions(inputPath);
  const pngPath = `${workDir}/${jobId}-meme.png`;
  await run("convert", memeMagickArgs(top, bottom, dims, pngPath));
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
  return { outputPath, top, bottom };
}
/* v8 ignore stop */
