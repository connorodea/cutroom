import { randomUUID } from "node:crypto";
import { runEditPipeline } from "./edit";

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
