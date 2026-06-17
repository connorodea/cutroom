import { run } from "./ffmpeg";

/**
 * Aspect reframe ("make it 9:16"). Reshapes a video to a target aspect ratio with one of two
 * fit modes:
 *  - "blur" (default): the video scaled to FIT inside the frame, centered over a blurred, zoomed
 *    copy of itself — the popular social/vertical style. No content is lost; the bars are filled.
 *  - "crop": scale to COVER + center-crop — the frame is filled edge-to-edge, sides cropped off.
 *
 * The filter builders are pure + unit-tested; runReframePipeline wires them into ffmpeg.
 */

export type ReframeAspect = "portrait" | "square" | "landscape";
export type ReframeMode = "blur" | "crop";

export interface ReframeTarget {
  width: number;
  height: number;
  ratio: string;
}

/** Canonical render dimensions per aspect. Portrait (9:16) is the default. */
export const REFRAME_TARGETS: Record<ReframeAspect, ReframeTarget> = {
  portrait: { width: 720, height: 1280, ratio: "9:16" },
  square: { width: 1080, height: 1080, ratio: "1:1" },
  landscape: { width: 1280, height: 720, ratio: "16:9" },
};

export const DEFAULT_ASPECT: ReframeAspect = "portrait";
export const DEFAULT_MODE: ReframeMode = "blur";

/** Coerce an untrusted aspect string to a known aspect (defaults to portrait). */
export function normalizeAspect(raw: unknown): ReframeAspect {
  return raw === "square" || raw === "landscape" ? raw : DEFAULT_ASPECT;
}

/** Coerce an untrusted mode string to a known mode (defaults to blur). */
export function normalizeMode(raw: unknown): ReframeMode {
  return raw === "crop" ? "crop" : DEFAULT_MODE;
}

export interface ReframeFilter {
  /** ffmpeg video-filter args: `["-vf", ...]` (crop) or `["-filter_complex", ..., "-map", ...]` (blur). */
  args: string[];
  mode: ReframeMode;
}

/**
 * Build the ffmpeg filter invocation for a reframe to `dstW x dstH`.
 *
 * crop → `-vf scale=W:H:force_original_aspect_ratio=increase,crop=W:H,setsar=1`
 * blur → `-filter_complex` splitting the source: background fills the frame (scale increase +
 *        center-crop + boxblur) and foreground fits inside (scale decrease), then a centered
 *        `overlay=(W-w)/2:(H-h)/2`. The composited stream is mapped via `[out]`.
 */
export function buildReframeFilter(dstW: number, dstH: number, mode: ReframeMode): ReframeFilter {
  if (mode === "crop") {
    const vf = `scale=${dstW}:${dstH}:force_original_aspect_ratio=increase,crop=${dstW}:${dstH},setsar=1`;
    return { args: ["-vf", vf], mode: "crop" };
  }

  // blur (default): blurred zoomed background + centered fitted foreground
  const bg = `[0:v]split=2[bg][fg];` +
    `[bg]scale=${dstW}:${dstH}:force_original_aspect_ratio=increase,crop=${dstW}:${dstH},boxblur=20:2[bgb];`;
  const fg = `[fg]scale=${dstW}:${dstH}:force_original_aspect_ratio=decrease[fgs];`;
  const compose = `[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1[out]`;
  return { args: ["-filter_complex", `${bg}${fg}${compose}`, "-map", "[out]"], mode: "blur" };
}

export interface ReframeResult {
  outputPath: string;
  width: number;
  height: number;
  mode: ReframeMode;
}

/**
 * Reframe `inputPath` to the requested aspect/mode and encode to `${workDir}/${jobId}.mp4`
 * (libx264 veryfast, yuv420p, +faststart). Audio is preserved (re-encoded to AAC) when present.
 */
export async function runReframePipeline(
  inputPath: string,
  opts: { aspect?: ReframeAspect; mode?: ReframeMode },
  workDir: string,
  jobId: string,
): Promise<ReframeResult> {
  const aspect = normalizeAspect(opts.aspect);
  const mode = normalizeMode(opts.mode);
  const { width, height } = REFRAME_TARGETS[aspect];
  const { args: filterArgs } = buildReframeFilter(width, height, mode);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)

  // blur mode already maps its labeled video output ([out]); crop mode uses -vf, so once we add an
  // explicit audio map we must also map the (filtered) video stream 0:v back in.
  const videoMap = mode === "crop" ? ["-map", "0:v"] : [];

  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    ...filterArgs,
    ...videoMap,
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath,
  ]);

  return { outputPath, width, height, mode };
}
