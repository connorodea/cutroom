/* v8 ignore start -- ffmpeg/Whisper subprocess pipeline; reuses the unit-tested buildAss, verified by live integration on deploy */
import { writeFile } from "node:fs/promises";
import { run, ffprobeDimensions, extractAudio } from "./ffmpeg";
import { transcribe } from "./transcribe";
import { buildAss } from "./edit";

export interface CaptionsResult {
  outputPath: string;
  totalWords: number;
  captionsApplied: boolean;
}

/**
 * Burn word-aligned captions onto a video without cutting anything: extract audio → Whisper →
 * buildAss → ffmpeg subtitles burn-in (best-effort; needs libass, falls back to uncaptioned).
 */
export async function runCaptionsPipeline(
  inputPath: string,
  workDir: string,
  jobId: string,
  opts: { position?: "bottom" | "top" } = {},
): Promise<CaptionsResult> {
  const audioPath = `${workDir}/${jobId}.wav`;
  const dims = await ffprobeDimensions(inputPath);
  await extractAudio(inputPath, audioPath);
  const words = await transcribe(audioPath);
  const outputPath = `${workDir}/${jobId}.mp4`;
  const remux = () => run("ffmpeg", ["-y", "-i", inputPath, "-c", "copy", "-movflags", "+faststart", outputPath]);

  let captionsApplied = false;
  if (words.length > 0) {
    const assPath = `${workDir}/${jobId}.ass`;
    await writeFile(assPath, buildAss(words, dims.width, dims.height, 4, opts.position));
    const esc = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
    try {
      await run("ffmpeg", [
        "-y", "-i", inputPath, "-vf", `subtitles=${esc}`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", outputPath,
      ]);
      captionsApplied = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[captions] burn-in failed (no libass?), shipping uncaptioned:", (err as Error).message.split("\n")[0]);
      await remux();
    }
  } else {
    await remux();
  }
  return { outputPath, totalWords: words.length, captionsApplied };
}
/* v8 ignore stop */
