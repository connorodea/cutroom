/** Client for the Cutroom media worker (Railway) — real upload/edit/playback. */

import type { OverlayElement } from "./overlaySpec";

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined) ||
  "https://cutroom-worker-production-74b1.up.railway.app";

export interface EditJob {
  id: string;
  type: "edit" | "create" | "overlay" | "reframe" | "highlights" | "captions" | "speed" | "trim" | "color" | "rotate" | "image" | "video";
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
    /** For reframe jobs: the output dimensions + fit mode. */
    width?: number;
    height?: number;
    mode?: "blur" | "crop";
    /** For highlights jobs: number of clips stitched into the reel. */
    clips?: number;
    /** For speed jobs: the applied retime factor + whether audio was retimed. */
    factor?: number;
    hadAudio?: boolean;
    /** For trim jobs: the kept window (seconds). */
    start?: number;
    end?: number;
    /** For color jobs: the applied saturation + contrast. */
    saturation?: number;
    contrast?: number;
    /** For rotate jobs: the applied orientation. */
    orientation?: string;
  };
  error?: string;
}

export interface ReframeOptions {
  aspect?: "portrait" | "square" | "landscape";
  mode?: "blur" | "crop";
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

/** Burn word-aligned captions onto a video (no cutting): multipart { file, position }. */
export async function submitCaptionsJob(file: File, opts: { position?: "bottom" | "top" } = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("position", opts.position ?? "bottom");
  const res = await fetch(`${WORKER_URL}/api/captions`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `captions failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Rotate (cw/ccw/180) or flip (flip-h/flip-v) a video: multipart { file, orientation }. */
export async function submitRotateJob(file: File, opts: { orientation?: string } = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("orientation", opts.orientation ?? "cw");
  const res = await fetch(`${WORKER_URL}/api/rotate`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `rotate failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Color-grade a video with a named look: multipart { file, preset }. */
export async function submitColorJob(file: File, opts: { preset?: string } = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("preset", opts.preset ?? "none");
  const res = await fetch(`${WORKER_URL}/api/color`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `color failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Keep an explicit [start,end] second window of a video: multipart { file, start, end }. */
export async function submitTrimJob(file: File, opts: { start?: number; end?: number } = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("start", String(opts.start ?? 0));
  fd.append("end", opts.end == null ? "" : String(opts.end));
  const res = await fetch(`${WORKER_URL}/api/trim`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `trim failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Retime a video by a speed factor (>1 timelapse, <1 slow-motion): multipart { file, factor }. */
export async function submitSpeedJob(file: File, opts: { factor?: number } = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("factor", String(opts.factor ?? 2));
  const res = await fetch(`${WORKER_URL}/api/speed`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `speed failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Composite on-screen graphics onto a video: multipart { file, overlays: JSON string }. */
export async function submitOverlayJob(file: File, overlays: OverlayElement[]): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("overlays", JSON.stringify(overlays));
  const res = await fetch(`${WORKER_URL}/api/overlay`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `overlay failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Reframe a video to a target aspect ratio (blur/crop fit): multipart { file, aspect, mode }. */
export async function submitReframeJob(file: File, opts: ReframeOptions = {}): Promise<EditJob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("aspect", opts.aspect ?? "portrait");
  fd.append("mode", opts.mode ?? "blur");
  const res = await fetch(`${WORKER_URL}/api/reframe`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `reframe failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
}

/** Chain an op onto an existing output by id (no re-upload): JSON { outputId, op, aspect?, mode? }. */
export async function submitChainJob(
  outputId: string,
  op: "reframe" | "captions" | "speed" | "color",
  opts: { aspect?: "portrait" | "square" | "landscape"; mode?: "blur" | "crop"; factor?: number; preset?: string } = {},
): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/chain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outputId, op, ...opts }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `chain failed (${res.status})`);
  }
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

/** Build a "best moments" highlight reel from a transcribed source (sourceId from transcribeVideo). */
export async function submitHighlightsJob(sourceId: string, count?: number): Promise<EditJob> {
  const res = await fetch(`${WORKER_URL}/api/jobs/highlights`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceId, count }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `highlights failed (${res.status})`);
  }
  return (await res.json()) as EditJob;
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
