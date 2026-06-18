import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Split-screen. Place two clips side-by-side ("horizontal") or stacked ("vertical") — comparisons,
 * duets, before/after. Each clip is normalized to a half-cell of the main clip's frame and stacked,
 * so the output keeps the main clip's dimensions. The layout normalizer and the filter builder are
 * pure + unit-tested; runSplitPipeline probes the main clip's size and runs ffmpeg.
 */

export type SplitLayout = "horizontal" | "vertical";
export const SPLIT_LAYOUTS = ["horizontal", "vertical"] as const;

/** Coerce an untrusted layout to a known one (defaults to side-by-side). */
export function normalizeSplitLayout(raw: unknown): SplitLayout {
  return String(raw) === "vertical" ? "vertical" : "horizontal";
}

export interface SplitFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex to fit each input into a `cellW`x`cellH` cell (scale-to-fit, pad/center,
 * setsar, yuv420p) and hstack (horizontal) or vstack (vertical) them into one frame.
 */
export function splitFilter(layout: SplitLayout, cellW: number, cellH: number): SplitFilter {
  const cell = (i: number) =>
    `[${i}:v]scale=${cellW}:${cellH}:force_original_aspect_ratio=decrease,pad=${cellW}:${cellH}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`;
  const stack = layout === "vertical" ? "vstack" : "hstack";
  return { filter: [cell(0), cell(1), `[v0][v1]${stack}=inputs=2[v]`].join(";"), maps: ["[v]"] };
}

export interface SplitResult {
  outputPath: string;
  layout: SplitLayout;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Combine `leftPath` and `rightPath` into a split-screen at `${workDir}/${jobId}.mp4` (libx264
 * veryfast, yuv420p, +faststart). The first clip's audio is preserved. Cell size comes from the
 * first clip: horizontal splits its width in half, vertical splits its height in half, so the
 * output keeps its overall dimensions.
 */
export async function runSplitPipeline(
  leftPath: string,
  rightPath: string,
  rawLayout: unknown,
  workDir: string,
  jobId: string,
): Promise<SplitResult> {
  const layout = normalizeSplitLayout(rawLayout);
  const { width, height } = await ffprobeDimensions(leftPath);
  const cellW = layout === "horizontal" ? Math.round(width / 4) * 2 : Math.round(width / 2) * 2;
  const cellH = layout === "horizontal" ? Math.round(height / 2) * 2 : Math.round(height / 4) * 2;
  const { filter, maps } = splitFilter(layout, cellW, cellH);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", leftPath,
    "-i", rightPath,
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, layout };
}
/* v8 ignore stop */
