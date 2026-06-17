/** Client for the Cutroom media worker (Railway) — real upload/edit/playback. */

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined) ||
  "https://cutroom-worker-production-74b1.up.railway.app";

export interface EditJob {
  id: string;
  type: "edit" | "create" | "overlay" | "image" | "video";
  status: "queued" | "running" | "done" | "error";
  step?: string;
  result?: {
    outputId: string;
    totalWords?: number;
    segments?: number;
    removedSec?: number;
    captionsApplied?: boolean;
    durationSec?: number;
    usedStock?: number;
    usedGenerative?: number;
    overlaysApplied?: number;
    /** For generation jobs: which medium was produced. */
    kind?: "image" | "video";
    /** For generation jobs: the upstream (Higgsfield) source URL. */
    sourceUrl?: string;
  };
  error?: string;
}

export interface ImageGenOptions {
  prompt: string;
  aspect?: "16:9" | "9:16";
  model?: "soul" | "reve";
}

export interface VideoGenOptions {
  prompt: string;
  imageUrl?: string;
  model?: "dop" | "kling" | "seedance";
  aspect?: "16:9" | "9:16";
  duration?: number;
}

/** Generate an image from a text prompt (Higgsfield). */
export async function submitImageGenJob(opts: ImageGenOptions): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/generate/image`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `image generation failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Generate a video clip from a text prompt (Higgsfield). */
export async function submitVideoGenJob(opts: VideoGenOptions): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/generate/video`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `video generation failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

export interface CreateOptions {
  prompt: string;
  aspect?: "landscape" | "portrait";
  captions?: boolean;
  autoGraphics?: boolean;
  source?: "stock" | "generative";
}

/** Submit an AI Create job: prompt → script → footage → voiceover → captions → graphics. */
export async function submitCreateJob(opts: CreateOptions): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `create failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
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
