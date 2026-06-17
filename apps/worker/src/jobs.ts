import { randomUUID } from "node:crypto";
import { runEditPipeline, runTranscriptCutPipeline } from "./edit";
import { runCreatePipeline, type CreateInput } from "./create";
import { applyOverlays } from "./overlay";
import { runReframePipeline, type ReframeAspect, type ReframeMode } from "./reframe";
import { planHighlights, runHighlightsPipeline, type HighlightOptions } from "./highlights";
import { runCaptionsPipeline } from "./captions";
import { runSpeedPipeline } from "./speed";
import { runTrimPipeline } from "./trim";
import { runColorPipeline, type ColorInput } from "./color";
import { runRotatePipeline } from "./rotate";
import { runAudioPipeline } from "./audio";
import { runFadePipeline } from "./fade";
import { runReversePipeline } from "./reverse";
import { runCropPipeline, type CropInput } from "./crop";
import { runGifPipeline, type GifInput } from "./gif";
import { runLoopPipeline } from "./loop";
import { runThumbnailPipeline } from "./thumbnail";
import { runStitchPipeline } from "./stitch";
import { runWatermarkPipeline } from "./watermark";
import { runPipPipeline } from "./pip";
import { runSplitPipeline } from "./splitscreen";
import { runFreezePipeline } from "./freeze";
import { runKenBurnsPipeline } from "./kenburns";
import { runChromaKeyPipeline } from "./chromakey";
import { runBorderPipeline } from "./border";
import { generateImage, imageToVideo, downloadTo, type ImageModel, type VideoModel } from "./higgsfield";
import { extractAudio, ffprobeDimensions, ffprobeDuration } from "./ffmpeg";
import { transcribe, type Word } from "./transcribe";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  type: "edit" | "create" | "overlay" | "reframe" | "highlights" | "captions" | "speed" | "trim" | "color" | "rotate" | "audio" | "fade" | "reverse" | "crop" | "gif" | "loop" | "thumbnail" | "stitch" | "watermark" | "pip" | "split" | "freeze" | "kenburns" | "chromakey" | "border" | "image" | "video";
  status: JobStatus;
  step?: string;
  result?: { outputId: string; [key: string]: unknown };
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Create + run an Edit job. The output MP4 is written to `workDir/<jobId>.mp4`,
 * retrievable via the job's `result.outputId`. Runs async; poll the job for status.
 */
export function createEditJob(inputPath: string, workDir: string, opts: { captions?: boolean }): Job {
  const id = randomUUID();
  const job: Job = { id, type: "edit", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);

  void (async () => {
    try {
      job.status = "running";
      job.step = "transcribe + cut + caption + render";
      const r = await runEditPipeline(inputPath, workDir, id, opts);
      job.status = "done";
      job.result = { outputId: id, totalWords: r.totalWords, segments: r.segments, removedSec: r.removedSec };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();

  return job;
}

/**
 * Create + run a Create job: AI writes a script (or one is supplied) → per-segment TTS voiceover +
 * Pexels stock footage matched to each scene → assembled MP4 with word-aligned captions. Runs async.
 */
export function createCreateJob(input: CreateInput, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "create", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "script → stock footage → voiceover → captions → graphics";
      const r = await runCreatePipeline(input, workDir, id);
      job.status = "done";
      job.result = {
        outputId: id,
        segments: r.segments,
        durationSec: r.durationSec,
        usedStock: r.usedStock,
        usedGenerative: r.usedGenerative,
        captionsApplied: r.captionsApplied,
        overlaysApplied: r.overlaysApplied,
      };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run an Overlay job: composite a graphics spec (titles/lower thirds/callouts/badges)
 * onto an existing video via ImageMagick + ffmpeg. The output is `${jobId}.mp4`. Runs async.
 */
export function createOverlayJob(inputPath: string, overlays: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "overlay", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "render graphics + composite";
      const dims = await ffprobeDimensions(inputPath);
      const r = await applyOverlays(inputPath, overlays, dims, workDir, id);
      job.status = "done";
      job.result = { outputId: id, overlaysApplied: r.applied };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Reframe job: reshape a video to a target aspect ratio (default 9:16 portrait)
 * with a "blur" (fit over blurred background, default) or "crop" (cover + center-crop) fit mode.
 * The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createReframeJob(
  inputPath: string,
  opts: { aspect?: ReframeAspect; mode?: ReframeMode },
  workDir: string,
): Job {
  const id = randomUUID();
  const job: Job = { id, type: "reframe", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "reframe (scale/crop/overlay)";
      const r = await runReframePipeline(inputPath, opts, workDir, id);
      job.status = "done";
      job.result = { outputId: id, width: r.width, height: r.height, mode: r.mode };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/** Generate an image with Higgsfield (text→image). Saved to `${jobId}.png`. Runs async. */
export function createImageGenJob(opts: { prompt: string; aspect?: string; model?: ImageModel }, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "image", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "generate image (Higgsfield)";
      const url = await generateImage(opts.prompt, opts.aspect ?? "16:9", opts.model ?? "soul");
      await downloadTo(url, `${workDir}/${id}.png`);
      job.status = "done";
      job.result = { outputId: id, kind: "image", sourceUrl: url };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Generate a video with Higgsfield. With an `imageUrl`, animates it (image→video); otherwise
 * generates a base image from `prompt` first (text→image→video). Saved to `${jobId}.mp4`. Async.
 */
export function createVideoGenJob(
  opts: { prompt: string; imageUrl?: string; model?: VideoModel; aspect?: string; duration?: number },
  workDir: string,
): Job {
  const id = randomUUID();
  const job: Job = { id, type: "video", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      let imageUrl = opts.imageUrl;
      if (!imageUrl) {
        job.step = "generate base image (Higgsfield)";
        imageUrl = await generateImage(opts.prompt, opts.aspect ?? "16:9");
      }
      job.step = "animate image → video (Higgsfield)";
      const videoUrl = await imageToVideo(imageUrl, opts.prompt, { model: opts.model, duration: opts.duration, aspect: opts.aspect });
      await downloadTo(videoUrl, `${workDir}/${id}.mp4`);
      job.status = "done";
      job.result = { outputId: id, kind: "video", sourceUrl: videoUrl };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

export interface Source {
  id: string;
  inputPath: string;
  words: Word[];
  duration: number;
  dims: { width: number; height: number };
}

const sources = new Map<string, Source>();
export function getSource(id: string): Source | undefined {
  return sources.get(id);
}

/** Upload → transcribe → store the source for later transcript-driven cuts. */
export async function transcribeSource(inputPath: string, workDir: string): Promise<Source> {
  const id = randomUUID();
  const audioPath = `${workDir}/src-${id}.wav`;
  const [duration, dims] = await Promise.all([ffprobeDuration(inputPath), ffprobeDimensions(inputPath)]);
  await extractAudio(inputPath, audioPath);
  const words = await transcribe(audioPath);
  const source: Source = { id, inputPath, words, duration, dims };
  sources.set(id, source);
  return source;
}

/** Apply transcript edits (remove word indices) to a stored source → render. */
export function createTranscriptCutJob(
  source: Source,
  removedIndices: number[],
  workDir: string,
  opts: { captions?: boolean },
): Job {
  const id = randomUUID();
  const job: Job = { id, type: "edit", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "cut + caption + render";
      const r = await runTranscriptCutPipeline(source.inputPath, source.words, removedIndices, source.duration, source.dims, workDir, id, opts);
      job.status = "done";
      job.result = { outputId: id, totalWords: r.totalWords, segments: r.segments, removedSec: r.removedSec };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Speed job: retime a video by a factor (>1 timelapse, <1 slow-motion), retiming
 * audio in lock-step when present. The output is `${jobId}.mp4`. Runs async; poll for status.
 */
export function createSpeedJob(inputPath: string, factor: number, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "speed", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "retime (setpts + atempo)";
      const r = await runSpeedPipeline(inputPath, factor, workDir, id);
      job.status = "done";
      job.result = { outputId: id, factor: r.factor, hadAudio: r.hadAudio };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Trim job: keep an explicit [start, end] window of the upload (clamped against the
 * clip's duration). The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createTrimJob(inputPath: string, rawStart: unknown, rawEnd: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "trim", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "trim window + re-encode";
      const r = await runTrimPipeline(inputPath, rawStart, rawEnd, workDir, id);
      job.status = "done";
      job.result = { outputId: id, start: r.start, end: r.end, durationSec: r.durationSec };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Color job: apply a named look (or custom brightness/contrast/saturation/gamma)
 * to the upload via ffmpeg `eq`. The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createColorJob(inputPath: string, input: ColorInput, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "color", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "color grade (eq)";
      const r = await runColorPipeline(inputPath, input, workDir, id);
      job.status = "done";
      job.result = { outputId: id, saturation: r.adjust.saturation, contrast: r.adjust.contrast };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Rotate job: rotate (90° cw/ccw, 180°) or flip (h/v) the upload. The output is
 * `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createRotateJob(inputPath: string, orientation: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "rotate", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "rotate / flip";
      const r = await runRotatePipeline(inputPath, orientation, workDir, id);
      job.status = "done";
      job.result = { outputId: id, orientation: r.orientation };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run an Audio job: scale the volume, mute, or normalize loudness on the upload. A clip
 * with no audio passes through untouched. The output is `${jobId}.mp4`. Runs async; poll for status.
 */
export function createAudioJob(inputPath: string, mode: unknown, level: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "audio", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "audio (volume / mute / normalize)";
      const r = await runAudioPipeline(inputPath, mode, level, workDir, id);
      job.status = "done";
      job.result = { outputId: id, audioMode: r.mode, hadAudio: r.hadAudio };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Fade job: add an intro fade-from-black and/or outro fade-to-black (with matching
 * audio fades). The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createFadeJob(inputPath: string, kind: unknown, dur: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "fade", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "fade (in / out)";
      const r = await runFadePipeline(inputPath, kind, dur, workDir, id);
      job.status = "done";
      job.result = { outputId: id, fadeKind: r.kind, dur: r.dur };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Reverse job: play the clip backwards ("reverse") or forward-then-reversed
 * ("boomerang"). The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createReverseJob(inputPath: string, mode: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "reverse", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "reverse / boomerang";
      const r = await runReversePipeline(inputPath, mode, workDir, id);
      job.status = "done";
      job.result = { outputId: id, reverseMode: r.mode, hadAudio: r.hadAudio };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Crop job: punch into a rectangular region of the frame (named preset or custom
 * fractions). The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createCropJob(inputPath: string, input: CropInput, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "crop", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "crop region";
      const r = await runCropPipeline(inputPath, input, workDir, id);
      job.status = "done";
      job.result = { outputId: id, cropW: r.rect.w, cropH: r.rect.h };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a GIF job: render the upload to a looping GIF. The output is `${jobId}.gif`
 * (served at /api/media/:id). Runs async; poll the job for status.
 */
export function createGifJob(inputPath: string, input: GifInput, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "gif", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "render gif (palettegen)";
      const r = await runGifPipeline(inputPath, input, workDir, id);
      job.status = "done";
      job.result = { outputId: id, fps: r.fps, width: r.width, ext: "gif" };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Loop job: repeat the upload end-to-end `count` times. The output is `${jobId}.mp4`.
 * Runs async; poll the job for status.
 */
export function createLoopJob(inputPath: string, count: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "loop", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "loop (split + concat)";
      const r = await runLoopPipeline(inputPath, count, workDir, id);
      job.status = "done";
      job.result = { outputId: id, count: r.count, hadAudio: r.hadAudio };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Thumbnail job: grab a poster frame from the upload at `time` (or the midpoint).
 * The output is `${jobId}.png`. Runs async; poll the job for status.
 */
export function createThumbnailJob(inputPath: string, time: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "thumbnail", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "grab poster frame";
      const r = await runThumbnailPipeline(inputPath, time, workDir, id);
      job.status = "done";
      job.result = { outputId: id, time: r.time, ext: "png" };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Stitch job: concatenate several uploaded clips (in order) into one. The output is
 * `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createStitchJob(inputPaths: string[], workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "stitch", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "normalize + concat clips";
      const r = await runStitchPipeline(inputPaths, workDir, id);
      job.status = "done";
      job.result = { outputId: id, clips: r.clips, hadAudio: r.hadAudio };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Watermark job: burn persistent corner text into the upload. The output is
 * `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createWatermarkJob(inputPath: string, text: string, corner: unknown, opacity: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "watermark", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "render + composite watermark";
      const r = await runWatermarkPipeline(inputPath, text, corner, opacity, workDir, id);
      job.status = "done";
      job.result = { outputId: id, corner: r.corner, opacity: r.opacity };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Picture-in-picture job: composite an overlay clip into a corner of the main clip.
 * The output is `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createPipJob(mainPath: string, overlayPath: string, corner: unknown, scale: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "pip", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "scale + composite picture-in-picture";
      const r = await runPipPipeline(mainPath, overlayPath, corner, scale, workDir, id);
      job.status = "done";
      job.result = { outputId: id, corner: r.corner, scale: r.scale };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Split-screen job: place two clips side-by-side or stacked. The output is
 * `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createSplitJob(leftPath: string, rightPath: string, layout: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "split", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "normalize + stack clips";
      const r = await runSplitPipeline(leftPath, rightPath, layout, workDir, id);
      job.status = "done";
      job.result = { outputId: id, layout: r.layout };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Freeze-frame job: hold the first or last frame still for `seconds`. The output is
 * `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createFreezeJob(inputPath: string, position: unknown, seconds: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "freeze", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "hold frame";
      const r = await runFreezePipeline(inputPath, position, seconds, workDir, id);
      job.status = "done";
      job.result = { outputId: id, freezePosition: r.position, freezeSeconds: r.seconds };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Ken Burns job: animate a still image with a slow pan/zoom. The output is
 * `${jobId}.mp4`. Runs async; poll the job for status.
 */
export function createKenBurnsJob(imagePath: string, direction: unknown, seconds: unknown, aspect: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "kenburns", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "animate still";
      const r = await runKenBurnsPipeline(imagePath, direction, seconds, aspect, workDir, id);
      job.status = "done";
      job.result = { outputId: id, kbDirection: r.direction, kbSeconds: r.seconds, width: r.width, height: r.height };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Chroma-key job: key the screen color out of `subjectPath` (the green/blue-screen
 * clip) and composite it over `backgroundPath`. The output is `${jobId}.mp4`. Runs async; poll it.
 */
export function createChromaKeyJob(subjectPath: string, backgroundPath: string, color: unknown, similarity: unknown, blend: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "chromakey", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "key + composite";
      const r = await runChromaKeyPipeline(backgroundPath, subjectPath, color, similarity, blend, workDir, id);
      job.status = "done";
      job.result = { outputId: id, chromaColor: r.color, chromaSimilarity: r.similarity, chromaBlend: r.blend };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Create + run a Border job: pad a clip with a solid colored frame. The output is `${jobId}.mp4`.
 * Runs async; poll the job for status.
 */
export function createBorderJob(inputPath: string, thickness: unknown, color: unknown, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "border", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "pad border";
      const r = await runBorderPipeline(inputPath, thickness, color, workDir, id);
      job.status = "done";
      job.result = { outputId: id, borderThickness: r.thickness, borderColor: r.color, width: r.width, height: r.height };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/** Burn word-aligned captions onto an uploaded video (no cutting). Output `${jobId}.mp4`. Async. */
export function createCaptionsJob(inputPath: string, workDir: string, opts: { position?: "bottom" | "top" } = {}): Job {
  const id = randomUUID();
  const job: Job = { id, type: "captions", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "transcribe + burn captions";
      const r = await runCaptionsPipeline(inputPath, workDir, id, opts);
      job.status = "done";
      job.result = { outputId: id, totalWords: r.totalWords, captionsApplied: r.captionsApplied };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}

/**
 * Build a "best moments" highlight reel from a transcribed source: pick the longest speech runs
 * and stitch them into one MP4. The output is `${jobId}.mp4`. Runs async.
 */
export function createHighlightsJob(source: Source, opts: HighlightOptions, workDir: string): Job {
  const id = randomUUID();
  const job: Job = { id, type: "highlights", status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  void (async () => {
    try {
      job.status = "running";
      job.step = "select highlights + stitch reel";
      const highlights = planHighlights(source.words, source.duration, opts);
      if (highlights.length === 0) throw new Error("no highlights found in this transcript");
      const r = await runHighlightsPipeline(source.inputPath, highlights, workDir, id);
      job.status = "done";
      job.result = { outputId: id, clips: r.clips, durationSec: r.durationSec };
    } catch (err) {
      job.status = "error";
      job.error = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[job]", id, "failed:", err);
    }
  })();
  return job;
}
