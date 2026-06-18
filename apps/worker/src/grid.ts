import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Grid (2×2 mosaic). Combine four clips into a single 2×2 frame — comparisons, reaction grids,
 * multicam. Each clip is fit into a quarter-frame cell (scale-to-fit, pad/center) and `xstack`ed
 * into the grid, so the output keeps the first clip's overall dimensions. The filter builder is
 * pure + unit-tested; runGridPipeline probes the first clip's size and wires it into ffmpeg.
 */

export interface GridFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex that fits each of four inputs into a `cellW`x`cellH` cell and stacks them
 * top-left, top-right, bottom-left, bottom-right via `xstack`.
 */
export function gridFilter(cellW: number, cellH: number): GridFilter {
  const cell = (i: number) =>
    `[${i}:v]scale=${cellW}:${cellH}:force_original_aspect_ratio=decrease,pad=${cellW}:${cellH}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`;
  const stack = "[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]";
  return { filter: [cell(0), cell(1), cell(2), cell(3), stack].join(";"), maps: ["[v]"] };
}

export interface GridResult {
  outputPath: string;
  cells: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Combine four clips at `paths` into a 2×2 grid at `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). The first clip's audio is preserved; cell size is half the first clip's
 * dimensions, so the grid keeps its overall size.
 */
export async function runGridPipeline(paths: string[], workDir: string, jobId: string): Promise<GridResult> {
  const { width, height } = await ffprobeDimensions(paths[0]);
  const cellW = Math.round(width / 4) * 2;
  const cellH = Math.round(height / 4) * 2;
  const { filter, maps } = gridFilter(cellW, cellH);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    ...paths.flatMap((p) => ["-i", p]),
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, cells: 4 };
}
/* v8 ignore stop */
