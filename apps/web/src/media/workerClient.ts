/** Client for the Cutroom media worker (Railway) — real upload/edit/playback. */

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined) ||
  "https://cutroom-worker-production-74b1.up.railway.app";

export interface EditJob {
  id: string;
  type: "edit" | "create";
  status: "queued" | "running" | "done" | "error";
  step?: string;
  result?: {
    outputId: string;
    totalWords: number;
    segments: number;
    removedSec: number;
    captionsApplied?: boolean;
  };
  error?: string;
}

/** Submit a video for the Edit pipeline (cut silences/filler + burn captions). */
export async function submitEditJob(file: File, opts: { captions?: boolean } = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("captions", String(opts.captions ?? true));
  const res = await fetch(`${WORKER_URL}/api/jobs`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return (await res.json()) as EditJob;
}

export async function getJob(id: string): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/jobs/${id}`);
  if (!res.ok) throw new Error(`job ${id} (${res.status})`);
  return (await res.json()) as EditJob;
}

/** Public URL of a rendered output. */
export function outputUrl(outputId: string): string {
  return `${WORKER_URL}/api/media/${outputId}`;
}

// ---- Transcript editor (Descript-style) ----

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

/** Upload a video and get its word-level transcript (+ a sourceId for later edits). */
export async function transcribeVideo(file: File): Promise<{ sourceId: string; duration: number; words: TranscriptWord[] }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${WORKER_URL}/api/transcribe`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`transcribe failed (${res.status})`);
  return res.json();
}

/** Apply transcript edits: remove the given word indices and re-render. */
export async function submitTranscriptCut(sourceId: string, removedIndices: number[], captions: boolean): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/jobs/transcript-cut`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceId, removedIndices, captions }),
  });
  if (!res.ok) throw new Error(`apply failed (${res.status})`);
  return res.json();
}

/** Poll a job until it reaches a terminal state. */
export async function pollJob(id: string, intervalMs = 1500): Promise<EditJob> {
  let job = await getJob(id);
  while (job.status === "queued" || job.status === "running") {
    await new Promise((r) => setTimeout(r, intervalMs));
    job = await getJob(id);
  }
  return job;
}
