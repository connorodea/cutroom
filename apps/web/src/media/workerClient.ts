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
