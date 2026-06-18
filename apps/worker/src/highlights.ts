import { run } from "./ffmpeg";
import type { Word } from "./transcribe";

export interface Highlight {
  start: number;
  end: number;
  text: string;
}

export interface HighlightOptions {
  /** Number of highlight clips to keep (default 3). */
  count?: number;
  /** Min clip length in seconds; shorter speech runs are dropped (default 1.5). */
  minLen?: number;
  /** Max clip length in seconds; longer runs are trimmed (default 30). */
  maxLen?: number;
  /** Silence gap (seconds) that splits the transcript into runs (default 0.6). */
  gap?: number;
}

/**
 * Pick the "best moments" from a word-level transcript: split it into continuous speech runs at
 * silence gaps, drop the short ones, take the longest `count`, cap each to `maxLen`, and return
 * them in chronological order. Pure + deterministic — the render step stitches them into a reel.
 */
export function planHighlights(words: Word[], totalDur: number, opts: HighlightOptions = {}): Highlight[] {
  const gap = opts.gap ?? 0.6;
  const minLen = opts.minLen ?? 1.5;
  const maxLen = opts.maxLen ?? 30;
  const count = opts.count ?? 3;

  const sorted = [...words].sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return [];

  // Group words into runs, splitting where the gap to the next word exceeds `gap`.
  const runs: { start: number; end: number; words: string[] }[] = [];
  let cur = { start: sorted[0].start, end: sorted[0].end, words: [sorted[0].word] };
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start - cur.end > gap) {
      runs.push(cur);
      cur = { start: sorted[i].start, end: sorted[i].end, words: [sorted[i].word] };
    } else {
      cur.end = sorted[i].end;
      cur.words.push(sorted[i].word);
    }
  }
  runs.push(cur);

  const candidates: Highlight[] = runs
    .map((r) => ({ start: r.start, end: Math.min(r.end, r.start + maxLen, totalDur || r.end), text: r.words.join(" ") }))
    .filter((h) => h.end - h.start >= minLen);

  return [...candidates]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, count)
    .sort((a, b) => a.start - b.start);
}

export interface HighlightsResult {
  outputPath: string;
  clips: number;
  durationSec: number;
}

/* v8 ignore start -- ffmpeg subprocess (trim + concat the highlight ranges); verified by live integration on deploy */
/** Stitch the chosen highlight ranges into one reel (`${jobId}.mp4`). */
export async function runHighlightsPipeline(
  inputPath: string,
  highlights: Highlight[],
  workDir: string,
  jobId: string,
): Promise<HighlightsResult> {
  const parts: string[] = [];
  highlights.forEach((h, i) => {
    parts.push(`[0:v]trim=${h.start.toFixed(3)}:${h.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=${h.start.toFixed(3)}:${h.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const concatInputs = highlights.map((_, i) => `[v${i}][a${i}]`).join("");
  parts.push(`${concatInputs}concat=n=${highlights.length}:v=1:a=1[vc][ac]`);

  const outputPath = `${workDir}/${jobId}.mp4`;
  await run("ffmpeg", [
    "-y", "-i", inputPath, "-filter_complex", parts.join(";"),
    "-map", "[vc]", "-map", "[ac]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outputPath,
  ]);
  const durationSec = highlights.reduce((a, h) => a + (h.end - h.start), 0);
  return { outputPath, clips: highlights.length, durationSec: Math.round(durationSec * 10) / 10 };
}
/* v8 ignore stop */
