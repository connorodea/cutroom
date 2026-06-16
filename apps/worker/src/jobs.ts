import { randomUUID } from "node:crypto";
import { runEditPipeline, runTranscriptCutPipeline } from "./edit";
import { extractAudio, ffprobeDimensions, ffprobeDuration } from "./ffmpeg";
import { transcribe, type Word } from "./transcribe";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  type: "edit" | "create";
  status: JobStatus;
  step?: string;
  result?: { outputId: string; totalWords: number; segments: number; removedSec: number };
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
