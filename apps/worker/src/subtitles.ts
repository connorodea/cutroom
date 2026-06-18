import { readFile } from "node:fs/promises";
import { run } from "./ffmpeg";

/**
 * Subtitles from SRT. Burn a user-supplied `.srt` subtitle file onto a clip. The SRT timestamp +
 * cue parser is pure + unit-tested (it validates the file and counts cues); runSubtitlesPipeline
 * writes the SRT to disk and burns it via ffmpeg's libass `subtitles` filter (same burn path the
 * captions feature uses).
 */

export interface SrtCue {
  start: number;
  end: number;
  text: string;
}

/** Parse an SRT timestamp `HH:MM:SS,mmm` (or with a dot) into seconds; 0 if unparseable. */
export function srtTimeToSeconds(raw: string): number {
  const m = String(raw).match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/**
 * Parse SRT text into cues. Tolerates CRLF endings, a leading BOM, missing index lines, and
 * multi-line cue text; blocks without a valid `-->` timecode line or with no text are skipped.
 */
export function parseSrt(text: string): SrtCue[] {
  const clean = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const cues: SrtCue[] = [];
  for (const block of clean.split(/\n[ \t]*\n/)) {
    const lines = block.split("\n");
    const tcIdx = lines.findIndex((l) => l.includes("-->"));
    if (tcIdx === -1) continue;
    const m = lines[tcIdx].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!m) continue;
    const cueText = lines.slice(tcIdx + 1).join("\n").trim();
    if (cueText === "") continue;
    cues.push({ start: srtTimeToSeconds(m[1]), end: srtTimeToSeconds(m[2]), text: cueText });
  }
  return cues;
}

export interface SubtitlesResult {
  outputPath: string;
  cues: number;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Burn `srtPath` onto `videoPath` and encode to `${workDir}/${jobId}.mp4` (libx264 veryfast,
 * yuv420p, +faststart). Rejects an SRT with no cues. The path is escaped for the `subtitles` filter
 * exactly as the captions pipeline does. Audio is copied through.
 */
export async function runSubtitlesPipeline(
  videoPath: string,
  srtPath: string,
  workDir: string,
  jobId: string,
): Promise<SubtitlesResult> {
  const cues = parseSrt(await readFile(srtPath, "utf8"));
  if (cues.length === 0) throw new Error("no subtitles found in the .srt file");
  const esc = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-vf", `subtitles=${esc}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, cues: cues.length };
}
/* v8 ignore stop */
