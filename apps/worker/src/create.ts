import { writeFile } from "node:fs/promises";
import { run, ffprobeDuration } from "./ffmpeg";
import { transcribe } from "./transcribe";
import { buildAss } from "./edit";
import { synthesize } from "./tts";
import { findClipUrl } from "./pexels";
import { writeScript, suggestOverlays, type ScriptSegment, type TimedSegment } from "./script";
import { applyOverlays } from "./overlay";
import { generateImage, imageToVideo, isConfigured as higgsfieldConfigured, type VideoModel } from "./higgsfield";

const SIZES = {
  landscape: { w: 1280, h: 720, orientation: "landscape" as const },
  portrait: { w: 720, h: 1280, orientation: "portrait" as const },
};

export interface CreateResult {
  outputPath: string;
  segments: number;
  durationSec: number;
  usedStock: number;
  usedGenerative: number;
  captionsApplied: boolean;
  overlaysApplied: number;
}

export interface CreateInput {
  prompt?: string;
  script?: ScriptSegment[];
  aspect?: "landscape" | "portrait";
  captions?: boolean;
  /** Explicit overlay spec (title/lower_third/callout/badge). Skips AI suggestion when provided. */
  overlays?: unknown[];
  /** When true (default) and no explicit overlays, the AI designs on-screen graphics. */
  autoGraphics?: boolean;
  /** "stock" (Pexels, default) or "generative" (Higgsfield text→image→video per scene). */
  source?: "stock" | "generative";
  /** Higgsfield video model for the generative source (default "dop"). */
  videoModel?: VideoModel;
}

async function concat(listItems: string[], listPath: string, outPath: string, audio: boolean): Promise<void> {
  await writeFile(listPath, listItems.map((p) => `file '${p}'`).join("\n") + "\n");
  const codec = audio ? ["-c:a", "aac", "-b:a", "160k"] : ["-c", "copy"];
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, ...codec, outPath]);
}

/**
 * Create pipeline: script (AI-written from a prompt, or provided) → per-segment TTS voiceover +
 * Pexels stock footage matched to each scene → assembled video with word-aligned burned captions.
 */
export async function runCreatePipeline(
  input: CreateInput,
  workDir: string,
  jobId: string,
): Promise<CreateResult> {
  const { w, h, orientation } = SIZES[input.aspect ?? "landscape"];
  const captions = input.captions ?? true;
  const segments = input.script ?? (await writeScript(input.prompt || "a short explainer video"));
  if (segments.length === 0) throw new Error("no script segments");

  const segVideos: string[] = [];
  const voiceParts: string[] = [];
  const timed: TimedSegment[] = [];
  const aspectRatio = orientation === "portrait" ? "9:16" : "16:9";
  const generative = input.source === "generative" && higgsfieldConfigured();
  let clock = 0;
  let usedStock = 0;
  let usedGenerative = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const ttsPath = `${workDir}/${jobId}-seg${i}.mp3`;
    await synthesize(seg.text, ttsPath);
    const dur = Math.max(1.2, await ffprobeDuration(ttsPath));
    timed.push({ text: seg.text, start: clock, end: clock + dur });
    clock += dur;
    voiceParts.push(ttsPath);

    const segVid = `${workDir}/${jobId}-vid${i}.mp4`;

    // Source the scene's raw clip: Higgsfield (generative) or Pexels (stock).
    let rawUrl: string | null = null;
    let fromGenerative = false;
    if (generative) {
      try {
        const imageUrl = await generateImage(seg.query || seg.text, aspectRatio);
        rawUrl = await imageToVideo(imageUrl, seg.text, { model: input.videoModel, duration: Math.ceil(dur), aspect: aspectRatio });
        fromGenerative = true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[create] generative scene failed, falling back to stock:", (err as Error).message.split("\n")[0]);
      }
    }
    if (!rawUrl) rawUrl = await findClipUrl(seg.query, orientation).catch(() => null);

    if (rawUrl) {
      const raw = `${workDir}/${jobId}-raw${i}.mp4`;
      const res = await fetch(rawUrl);
      await writeFile(raw, Buffer.from(await res.arrayBuffer()));
      await run("ffmpeg", [
        "-y", "-stream_loop", "-1", "-i", raw, "-t", dur.toFixed(2),
        "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`,
        "-r", "25", "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", segVid,
      ]);
      if (fromGenerative) usedGenerative++;
      else usedStock++;
    } else {
      // Fallback: branded slide when no clip matched.
      await run("ffmpeg", [
        "-y", "-f", "lavfi", "-i", `color=c=0x20262E:s=${w}x${h}:r=25:d=${dur.toFixed(2)}`,
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", segVid,
      ]);
    }
    segVideos.push(segVid);
  }

  // Concat voiceover + video tracks.
  const voicePath = `${workDir}/${jobId}-voice.m4a`;
  const videoPath = `${workDir}/${jobId}-video.mp4`;
  await concat(voiceParts, `${workDir}/${jobId}-alist.txt`, voicePath, true);
  await concat(segVideos, `${workDir}/${jobId}-vlist.txt`, videoPath, false);

  // Mux video + voiceover.
  const muxed = `${workDir}/${jobId}-mux.mp4`;
  await run("ffmpeg", ["-y", "-i", videoPath, "-i", voicePath, "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", muxed]);

  // Word-aligned captions from the voiceover (best-effort; needs libass). Written to a base file;
  // the overlay pass produces the canonical served output `${jobId}.mp4`.
  const basePath = `${workDir}/${jobId}-base.mp4`;
  let captionsApplied = false;
  if (captions) {
    try {
      const words = await transcribe(voicePath);
      const assPath = `${workDir}/${jobId}.ass`;
      await writeFile(assPath, buildAss(words, w, h));
      const esc = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
      await run("ffmpeg", [
        "-y", "-i", muxed, "-vf", `subtitles=${esc}`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", basePath,
      ]);
      captionsApplied = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[create] captions failed, shipping uncaptioned:", (err as Error).message.split("\n")[0]);
      await run("ffmpeg", ["-y", "-i", muxed, "-c", "copy", "-movflags", "+faststart", basePath]);
    }
  } else {
    await run("ffmpeg", ["-y", "-i", muxed, "-c", "copy", "-movflags", "+faststart", basePath]);
  }

  // Graphics overlays: explicit spec, or AI-designed (title/lower thirds/callouts) when autoGraphics.
  let overlays: unknown[] = [];
  if (input.overlays && input.overlays.length) {
    overlays = input.overlays;
  } else if (input.autoGraphics !== false) {
    overlays = await suggestOverlays(input.prompt || segments[0].text, timed).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[create] overlay suggestion failed:", (err as Error).message.split("\n")[0]);
      return [];
    });
  }
  const ov = await applyOverlays(basePath, overlays, { width: w, height: h }, workDir, jobId);

  const durationSec = Math.round((await ffprobeDuration(ov.outputPath)) * 10) / 10;
  // eslint-disable-next-line no-console
  console.log(`[create] ${jobId}: ${segments.length} segs, ${usedStock} stock, ${usedGenerative} generative, ${ov.applied} overlays, ${durationSec}s`);
  return {
    outputPath: ov.outputPath,
    segments: segments.length,
    durationSec,
    usedStock,
    usedGenerative,
    captionsApplied,
    overlaysApplied: ov.applied,
  };
}
