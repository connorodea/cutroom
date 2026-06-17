import { run, ffprobeDimensions } from "./ffmpeg";

/**
 * Chroma key (green screen). Key out a solid backdrop color from a foreground clip and composite
 * the remaining subject over a second clip. The foreground is scaled to fill the background's frame,
 * `colorkey` makes the screen color transparent, then it's overlaid. The color/similarity/blend
 * normalizers and the filter builder are pure + unit-tested; runChromaKeyPipeline probes the
 * background's size and wires it into ffmpeg. Output keeps the background's dimensions + audio.
 */

export type ChromaColorName = "green" | "blue";
export const CHROMA_COLORS: Record<ChromaColorName, string> = {
  green: "0x00FF00",
  blue: "0x0000FF",
};

/** Coerce an untrusted screen color to an ffmpeg hex token. Names map; valid 0xRRGGBB passes through; else green. */
export function normalizeChromaColor(raw: unknown): string {
  const s = String(raw);
  if (s === "green" || s === "blue") return CHROMA_COLORS[s];
  if (/^0x[0-9a-fA-F]{6}$/.test(s)) return "0x" + s.slice(2).toUpperCase();
  return CHROMA_COLORS.green;
}

/** Coerce an untrusted similarity into [0.01, 1], two decimals; non-finite → 0.3. */
export function clampSimilarity(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(1, Math.max(0.01, Math.round(n * 100) / 100));
}

/** Coerce an untrusted blend into [0, 1], two decimals; non-finite → 0.1. */
export function clampBlend(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.1;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

export interface ChromaKeyFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex that scales input 1 (foreground) to fill `bgW`x`bgH`, keys `color` out of
 * it (`colorkey=color:similarity:blend`), and overlays it onto input 0 (background) at the origin.
 */
export function chromaKeyFilter(color: string, similarity: number, blend: number, bgW: number, bgH: number): ChromaKeyFilter {
  const fg =
    `[1:v]scale=${bgW}:${bgH}:force_original_aspect_ratio=increase,crop=${bgW}:${bgH},` +
    `colorkey=${color}:${similarity}:${blend}[fg]`;
  return { filter: `${fg};[0:v][fg]overlay=0:0[v]`, maps: ["[v]"] };
}

export interface ChromaKeyResult {
  outputPath: string;
  color: string;
  similarity: number;
  blend: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Composite `fgPath` (a green/blue-screen clip) over `bgPath` and encode to `${workDir}/${jobId}.mp4`
 * (libx264 veryfast, yuv420p, +faststart). The background's audio is preserved; output keeps the
 * background's dimensions.
 */
export async function runChromaKeyPipeline(
  bgPath: string,
  fgPath: string,
  rawColor: unknown,
  rawSimilarity: unknown,
  rawBlend: unknown,
  workDir: string,
  jobId: string,
): Promise<ChromaKeyResult> {
  const color = normalizeChromaColor(rawColor);
  const similarity = clampSimilarity(rawSimilarity);
  const blend = clampBlend(rawBlend);
  const { width, height } = await ffprobeDimensions(bgPath);
  const { filter, maps } = chromaKeyFilter(color, similarity, blend, width, height);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", bgPath,
    "-i", fgPath,
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, color, similarity, blend };
}
/* v8 ignore stop */
