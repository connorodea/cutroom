import { writeFile } from "node:fs/promises";
import { run, ffprobeDuration, ffprobeDimensions, extractAudio } from "./ffmpeg";
import { transcribe, type Word } from "./transcribe";

/** Conservative filler-word list (whole-word, lowercased, punctuation-stripped). */
const FILLERS = new Set(["um", "umm", "uh", "uhh", "uhm", "er", "err", "ah", "hmm", "mhm", "erm"]);

interface Segment {
  start: number;
  end: number;
}

export interface CutPlan {
  segments: Segment[];
  /** Kept words remapped onto the post-cut timeline. */
  remapped: Word[];
  keptDur: number;
  removedDur: number;
}

/** Decide what to keep: drop fillers, collapse silent gaps, merge into segments, remap word times. */
export function planCuts(
  words: Word[],
  totalDur: number,
  opts: { silenceGap?: number; pad?: number; removeFillers?: boolean } = {},
): CutPlan {
  const silenceGap = opts.silenceGap ?? 0.7;
  const pad = opts.pad ?? 0.12;
  const fillerPad = 0.04;
  const removeFillers = opts.removeFillers ?? true;
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");

  const sorted = [...words].sort((a, b) => a.start - b.start);

  // Regions to REMOVE: filler words + silent gaps + leading/trailing silence.
  const remove: Segment[] = [];
  if (removeFillers) {
    for (const w of sorted) {
      if (FILLERS.has(norm(w.word))) remove.push({ start: Math.max(0, w.start - fillerPad), end: w.end + fillerPad });
    }
  }
  if (sorted.length && sorted[0].start > silenceGap) remove.push({ start: 0, end: sorted[0].start - pad });
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].start - sorted[i].end;
    if (gap > silenceGap) remove.push({ start: sorted[i].end + pad, end: sorted[i + 1].start - pad });
  }
  const lastWord = sorted[sorted.length - 1];
  if (lastWord && totalDur - lastWord.end > silenceGap) remove.push({ start: lastWord.end + pad, end: totalDur });

  // Merge removal regions.
  remove.sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const iv of remove) {
    if (iv.end <= iv.start) continue;
    const m = merged[merged.length - 1];
    if (m && iv.start <= m.end) m.end = Math.max(m.end, iv.end);
    else merged.push({ ...iv });
  }

  // KEEP = complement of removal regions within [0, totalDur].
  let cursor = 0;
  const segs: Segment[] = [];
  for (const r of merged) {
    if (r.start > cursor) segs.push({ start: cursor, end: Math.min(r.start, totalDur) });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < totalDur) segs.push({ start: cursor, end: totalDur });
  const segments = segs.filter((s) => s.end - s.start > 0.05);
  if (segments.length === 0) segments.push({ start: 0, end: totalDur });

  // Removed-before each segment → remap kept word times onto the cut timeline.
  const removedBefore: number[] = [];
  let removed = 0;
  let prevEnd = 0;
  for (const seg of segments) {
    removed += seg.start - prevEnd;
    removedBefore.push(removed);
    prevEnd = seg.end;
  }
  const segIndexAt = (t: number) => segments.findIndex((s) => t >= s.start && t <= s.end);
  const remapped: Word[] = [];
  for (const w of sorted) {
    const i = segIndexAt(w.start);
    if (i === -1) continue; // dropped (filler/silence)
    const rb = removedBefore[i];
    remapped.push({ word: w.word, start: Math.max(0, w.start - rb), end: Math.max(0, w.end - rb) });
  }

  const keptDur = segments.reduce((a, s) => a + (s.end - s.start), 0);
  return { segments, remapped, keptDur, removedDur: Math.max(0, totalDur - keptDur) };
}

/** Build a cut plan by removing the spans of the given word indices (transcript editing). */
export function planCutsFromRemovedWords(
  words: Word[],
  removedIndices: number[],
  totalDur: number,
  opts: { pad?: number } = {},
): CutPlan {
  const pad = opts.pad ?? 0.04;
  const removed = new Set(removedIndices);
  const remove: Segment[] = [];
  words.forEach((w, i) => {
    if (removed.has(i)) remove.push({ start: Math.max(0, w.start - pad), end: w.end + pad });
  });
  remove.sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const iv of remove) {
    if (iv.end <= iv.start) continue;
    const m = merged[merged.length - 1];
    if (m && iv.start <= m.end) m.end = Math.max(m.end, iv.end);
    else merged.push({ ...iv });
  }
  let cursor = 0;
  const segs: Segment[] = [];
  for (const r of merged) {
    if (r.start > cursor) segs.push({ start: cursor, end: Math.min(r.start, totalDur) });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < totalDur) segs.push({ start: cursor, end: totalDur });
  const segments = segs.filter((s) => s.end - s.start > 0.02);
  if (segments.length === 0) segments.push({ start: 0, end: totalDur });
  const removedBefore: number[] = [];
  let removedAcc = 0;
  let prevEnd = 0;
  for (const seg of segments) {
    removedAcc += seg.start - prevEnd;
    removedBefore.push(removedAcc);
    prevEnd = seg.end;
  }
  const segAt = (t: number) => segments.findIndex((s) => t >= s.start && t <= s.end);
  const remapped: Word[] = [];
  words.forEach((w, i) => {
    if (removed.has(i)) return;
    const si = segAt(w.start);
    if (si === -1) return;
    remapped.push({ word: w.word, start: Math.max(0, w.start - removedBefore[si]), end: Math.max(0, w.end - removedBefore[si]) });
  });
  const keptDur = segments.reduce((a, s) => a + (s.end - s.start), 0);
  return { segments, remapped, keptDur, removedDur: Math.max(0, totalDur - keptDur) };
}

const assTime = (t: number) => {
  // Round to centiseconds FIRST, then decompose — otherwise rounding `t % 60` can yield an
  // invalid "60.00" (e.g. 59.999s) instead of carrying into the next minute/hour.
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = (cs % 6000) / 100;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
};

/** Build a burned-in caption (.ass) from remapped words, grouped into short cues. */
export function buildAss(words: Word[], width: number, height: number, wordsPerCue = 4, position: "bottom" | "top" = "bottom"): string {
  const fontSize = Math.max(18, Math.round(height * 0.06));
  const marginV = Math.round(height * 0.08);
  const alignment = position === "top" ? 8 : 2; // ASS \an: 2 = bottom-center, 8 = top-center
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,${fontSize},&H00FFFFFF,&H00000000,&H64000000,1,3,1,${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const cues: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    const group = words.slice(i, i + wordsPerCue);
    if (!group.length) continue;
    const start = group[0].start;
    const end = Math.max(group[group.length - 1].end, start + 0.4);
    const text = group.map((g) => g.word.trim()).join(" ").replace(/[\r\n]+/g, " ");
    cues.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,${text}`);
  }
  return header + cues.join("\n") + "\n";
}

/* v8 ignore start -- ffmpeg subprocess render pipelines below; verified by live integration tests on each deploy */
export interface EditResult {
  outputPath: string;
  totalWords: number;
  segments: number;
  removedSec: number;
  captionsApplied: boolean;
}

/** Render a cut plan to MP4: trim+concat+loudnorm, then best-effort caption burn-in. */
async function renderPlan(
  inputPath: string,
  plan: CutPlan,
  dims: { width: number; height: number },
  workDir: string,
  jobId: string,
  captions: boolean,
): Promise<{ outputPath: string; captionsApplied: boolean }> {
  const assPath = `${workDir}/${jobId}.ass`;
  const outputPath = `${workDir}/${jobId}.mp4`;
  const cutPath = `${workDir}/${jobId}.cut.mp4`;

  // Pass 1: trim+concat each kept segment (reliable PTS handling) + loudnorm.
  const parts: string[] = [];
  plan.segments.forEach((s, i) => {
    parts.push(`[0:v]trim=${s.start.toFixed(3)}:${s.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=${s.start.toFixed(3)}:${s.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const concatInputs = plan.segments.map((_, i) => `[v${i}][a${i}]`).join("");
  parts.push(`${concatInputs}concat=n=${plan.segments.length}:v=1:a=1[vc][ac]`);
  parts.push(`[ac]loudnorm[a]`);
  await run("ffmpeg", [
    "-y", "-i", inputPath, "-filter_complex", parts.join(";"),
    "-map", "[vc]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", cutPath,
  ]);

  // Pass 2: best-effort caption burn-in (needs libass; fall back to uncaptioned).
  const remux = () => run("ffmpeg", ["-y", "-i", cutPath, "-c", "copy", "-movflags", "+faststart", outputPath]);
  let captionsApplied = false;
  if (captions && plan.remapped.length > 0) {
    await writeFile(assPath, buildAss(plan.remapped, dims.width, dims.height));
    const esc = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
    try {
      await run("ffmpeg", [
        "-y", "-i", cutPath, "-vf", `subtitles=${esc}`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", outputPath,
      ]);
      captionsApplied = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[edit] caption burn-in failed (no libass?), shipping uncaptioned:`, (err as Error).message.split("\n")[0]);
      await remux();
    }
  } else {
    await remux();
  }
  return { outputPath, captionsApplied };
}

/** Auto clean-up: extract audio → Whisper → plan cuts (filler + silence) → render. */
export async function runEditPipeline(
  inputPath: string,
  workDir: string,
  jobId: string,
  opts: { captions?: boolean } = {},
): Promise<EditResult> {
  const captions = opts.captions ?? true;
  const audioPath = `${workDir}/${jobId}.wav`;
  const [totalDur, dims] = await Promise.all([ffprobeDuration(inputPath), ffprobeDimensions(inputPath)]);
  await extractAudio(inputPath, audioPath);
  const words = await transcribe(audioPath);
  const plan = planCuts(words, totalDur);
  // eslint-disable-next-line no-console
  console.log(`[edit] ${jobId}: ${words.length} words → ${plan.segments.length} segs, removed ${plan.removedDur.toFixed(1)}s`);
  const { outputPath, captionsApplied } = await renderPlan(inputPath, plan, dims, workDir, jobId, captions);
  return {
    captionsApplied, outputPath,
    totalWords: words.length,
    segments: plan.segments.length,
    removedSec: Math.round(plan.removedDur * 10) / 10,
  };
}

/** Transcript-driven cut (Descript-style): remove the given word indices' spans → render. */
export async function runTranscriptCutPipeline(
  inputPath: string,
  words: Word[],
  removedIndices: number[],
  totalDur: number,
  dims: { width: number; height: number },
  workDir: string,
  jobId: string,
  opts: { captions?: boolean } = {},
): Promise<EditResult> {
  const captions = opts.captions ?? true;
  const plan = planCutsFromRemovedWords(words, removedIndices, totalDur);
  // eslint-disable-next-line no-console
  console.log(`[transcript-cut] ${jobId}: removed ${removedIndices.length}/${words.length} words → ${plan.segments.length} segs, −${plan.removedDur.toFixed(1)}s`);
  const { outputPath, captionsApplied } = await renderPlan(inputPath, plan, dims, workDir, jobId, captions);
  return {
    captionsApplied, outputPath,
    totalWords: words.length,
    segments: plan.segments.length,
    removedSec: Math.round(plan.removedDur * 10) / 10,
  };
}
/* v8 ignore stop */
