import { run } from "./ffmpeg";

/**
 * Ken Burns. Turn a still image into a motion clip with a slow zoom or pan — the classic
 * documentary/slideshow move. The source is supersampled to 2× the target so the pan/zoom keeps
 * resolution, then ffmpeg `zoompan` walks the viewport across `frames = seconds * fps` output
 * frames. The direction/seconds/aspect normalizers and the filter builder are pure + unit-tested;
 * runKenBurnsPipeline wires it into ffmpeg over a looped still.
 */

export type KenBurnsDirection = "in" | "out" | "left" | "right";
export const KEN_BURNS_DIRECTIONS = ["in", "out", "left", "right"] as const;

export type KenBurnsAspect = "landscape" | "portrait" | "square";
export const KEN_BURNS_TARGETS: Record<KenBurnsAspect, { width: number; height: number }> = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
  square: { width: 1080, height: 1080 },
};

/** Coerce an untrusted direction to a known one (defaults to a slow zoom-in). */
export function normalizeKenBurnsDirection(raw: unknown): KenBurnsDirection {
  return (KEN_BURNS_DIRECTIONS as readonly string[]).includes(String(raw))
    ? (String(raw) as KenBurnsDirection)
    : "in";
}

/** Coerce an untrusted duration (seconds) into [2, 15], one decimal; non-finite → 5. */
export function normalizeKenBurnsSeconds(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 5;
  return Math.min(15, Math.max(2, Math.round(n * 10) / 10));
}

/** Coerce an untrusted aspect to a known target (defaults to landscape). */
export function normalizeKenBurnsAspect(raw: unknown): KenBurnsAspect {
  return raw === "portrait" || raw === "square" ? raw : "landscape";
}

export interface KenBurnsFilter {
  vf: string;
  frames: number;
}

/** Centered viewport expressions (keep the moving window in the middle of the frame). */
const CENTER_X = "iw/2-(iw/zoom/2)";
const CENTER_Y = "ih/2-(ih/zoom/2)";
const PAN_ZOOM = "1.2";

/**
 * Build the complete `-vf` value for a Ken Burns move to `dstW`x`dstH` over `seconds` at `fps`.
 * Zoom moves between 1.0 and 1.3 (in/out); pans hold a 1.2 zoom and slide the viewport edge-to-edge.
 * The leading scale+crop supersamples the still to 2× the target so the motion stays sharp.
 */
export function kenBurnsFilter(
  direction: KenBurnsDirection,
  dstW: number,
  dstH: number,
  seconds: number,
  fps: number,
): KenBurnsFilter {
  const frames = Math.round(seconds * fps);
  const last = frames - 1;
  let z: string;
  let x: string;
  let y: string;
  if (direction === "in") {
    z = `1+0.3*on/${last}`;
    x = CENTER_X;
    y = CENTER_Y;
  } else if (direction === "out") {
    z = `1.3-0.3*on/${last}`;
    x = CENTER_X;
    y = CENTER_Y;
  } else if (direction === "right") {
    z = PAN_ZOOM;
    x = `(iw-iw/zoom)*on/${last}`;
    y = CENTER_Y;
  } else {
    z = PAN_ZOOM;
    x = `(iw-iw/zoom)*(1-on/${last})`;
    y = CENTER_Y;
  }
  const baseW = dstW * 2;
  const baseH = dstH * 2;
  const vf =
    `scale=${baseW}:${baseH}:force_original_aspect_ratio=increase,crop=${baseW}:${baseH},` +
    `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${dstW}x${dstH}:fps=${fps}`;
  return { vf, frames };
}

export interface KenBurnsResult {
  outputPath: string;
  direction: KenBurnsDirection;
  seconds: number;
  aspect: KenBurnsAspect;
  width: number;
  height: number;
}

const FPS = 30;

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Animate the still at `imagePath` into `${workDir}/${jobId}.mp4` (libx264 veryfast, yuv420p,
 * +faststart) by looping it and applying the Ken Burns zoompan for `seconds` at 30fps.
 */
export async function runKenBurnsPipeline(
  imagePath: string,
  rawDirection: unknown,
  rawSeconds: unknown,
  rawAspect: unknown,
  workDir: string,
  jobId: string,
): Promise<KenBurnsResult> {
  const direction = normalizeKenBurnsDirection(rawDirection);
  const seconds = normalizeKenBurnsSeconds(rawSeconds);
  const aspect = normalizeKenBurnsAspect(rawAspect);
  const { width, height } = KEN_BURNS_TARGETS[aspect];
  const { vf } = kenBurnsFilter(direction, width, height, seconds, FPS);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-t", String(seconds),
    "-vf", vf,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, direction, seconds, aspect, width, height };
}
/* v8 ignore stop */
