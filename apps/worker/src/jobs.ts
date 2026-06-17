import { randomUUID } from "node:crypto";
import { runEditPipeline, runTranscriptCutPipeline } from "./edit";
import { runCreatePipeline, type CreateInput } from "./create";
import { applyOverlays } from "./overlay";
import { generateImage, imageToVideo, downloadTo, type ImageModel, type VideoModel } from "./higgsfield";
import { extractAudio, ffprobeDimensions, ffprobeDuration } from "./ffmpeg";
import { transcribe, type Word } from "./transcribe";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  type: "edit" | "create" | "overlay" | "image" | "video";
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
