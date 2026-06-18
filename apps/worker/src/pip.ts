import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Picture-in-picture. Composite an overlay clip (e.g. a reaction webcam) into a corner of a main
 * clip (e.g. a screen recording). The overlay is scaled to a fraction of the main width and pinned
 * to a corner with a margin. The corner/scale normalizers and the filter builder are pure +
 * unit-tested; runPipPipeline probes the main clip's size and runs ffmpeg.
 */

export type PipCorner = "tl" | "tr" | "bl" | "br";
export const PIP_CORNERS = ["tl", "tr", "bl", "br"] as const;

/** Coerce an untrusted corner to a known one (defaults to bottom-right). */
export function normalizePipCorner(raw: unknown): PipCorner {
  return (PIP_CORNERS as readonly string[]).includes(String(raw)) ? (String(raw) as PipCorner) : "br";
}

/** Coerce an untrusted PiP size (fraction of the main width) into [0.1, 0.5]; non-finite → 0.3. */
export function normalizePipScale(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.3;
  return Math.round(Math.min(0.5, Math.max(0.1, n)) * 100) / 100;
}

/**
 * Build the filter_complex to scale the overlay (input 1) to `pipWidth` px and composite it onto
 * the main video (input 0) at `corner`, inset by `margin` px. Uses the overlay filter's W/H (main)
 * and w/h (scaled overlay) constants so the corner math is resolution-independent.
 */
export function pipFilter(corner: PipCorner, pipWidth: number, margin: number): string {
  const pos: Record<PipCorner, string> = {
    tl: `${margin}:${margin}`,
    tr: `W-w-${margin}:${margin}`,
    bl: `${margin}:H-h-${margin}`,
    br: `W-w-${margin}:H-h-${margin}`,
  };
  return `[1:v]scale=${pipWidth}:-1,setsar=1[pip];[0:v][pip]overlay=${pos[corner]}[v]`;
}

export interface PipResult {
  outputPath: string;
  corner: PipCorner;
  scale: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Composite `overlayPath` onto `mainPath` and encode to `${workDir}/${jobId}.mp4` (libx264
 * veryfast, yuv420p, +faststart). The main clip's audio is preserved (stream copy).
 */
export async function runPipPipeline(
  mainPath: string,
  overlayPath: string,
  rawCorner: unknown,
  rawScale: unknown,
  workDir: string,
  jobId: string,
): Promise<PipResult> {
  const corner = normalizePipCorner(rawCorner);
  const scale = normalizePipScale(rawScale);
  const { width } = await ffprobeDimensions(mainPath);
  const pipWidth = Math.round((width * scale) / 2) * 2; // even width keeps the encoder happy
  const margin = Math.round(width * 0.03);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", mainPath,
    "-i", overlayPath,
    "-filter_complex", pipFilter(corner, pipWidth, margin),
    "-map", "[v]",
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, corner, scale };
}
/* v8 ignore stop */
