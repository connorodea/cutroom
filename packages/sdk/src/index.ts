import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";

/**
 * Cutroom SDK — the programmatic harness for the Cutroom API.
 *
 * Used by the `cutroom` CLI, the MCP server, and any external agent that wants to
 * drive Cutroom (transcribe, edit, transcript-cut, create). Token-aware: pass a token
 * or set `CUTROOM_API_TOKEN`; base URL via `CUTROOM_API_URL`.
 */

export const DEFAULT_BASE_URL = "https://cutroom-worker-production-74b1.up.railway.app";

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface Job {
  id: string;
  type: "edit" | "create";
  status: "queued" | "running" | "done" | "error";
  step?: string;
  result?: { outputId: string; totalWords: number; segments: number; removedSec: number };
  error?: string;
}

export interface Transcript {
  sourceId: string;
  duration: number;
  words: TranscriptWord[];
}

export interface CutroomClientOptions {
  /** Base URL of the Cutroom API. Defaults to $CUTROOM_API_URL or the hosted worker. */
  baseUrl?: string;
  /** API token. Defaults to $CUTROOM_API_TOKEN. Sent as `Authorization: Bearer`. */
  token?: string;
}

export class CutroomClient {
  readonly baseUrl: string;
  private readonly token?: string;

  constructor(opts: CutroomClientOptions = {}) {
    this.baseUrl = (opts.baseUrl || process.env.CUTROOM_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.token = opts.token || process.env.CUTROOM_API_TOKEN;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return this.token ? { ...extra, Authorization: `Bearer ${this.token}` } : extra;
  }

  private async fileForm(path: string, extra: Record<string, string> = {}): Promise<FormData> {
    const buf = await readFile(path);
    const fd = new FormData();
    fd.append("file", new File([buf], basename(path)));
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return fd;
  }

  private async json<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Cutroom API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** Liveness + whether the agent key is configured. */
  async health(): Promise<{ ok: boolean; agent?: string; keyPresent?: boolean }> {
    return this.json(await fetch(`${this.baseUrl}/api/worker/health`, { headers: this.authHeaders() }));
  }

  /** Auto clean-up: cut silences/filler + (optionally) burn captions → job. */
  async cleanUp(filePath: string, opts: { captions?: boolean } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { captions: String(opts.captions ?? true) });
    return this.json(await fetch(`${this.baseUrl}/api/jobs`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Transcribe a video → word-level transcript + sourceId (for transcript edits). */
  async transcribe(filePath: string): Promise<Transcript> {
    const fd = await this.fileForm(filePath);
    return this.json(await fetch(`${this.baseUrl}/api/transcribe`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Apply transcript edits: remove the given word indices → job. */
  async transcriptCut(sourceId: string, removedIndices: number[], opts: { captions?: boolean } = {}): Promise<Job> {
    return this.json(
      await fetch(`${this.baseUrl}/api/jobs/transcript-cut`, {
        method: "POST",
        headers: this.authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ sourceId, removedIndices, captions: opts.captions ?? true }),
      }),
    );
  }

  async getJob(id: string): Promise<Job> {
    return this.json(await fetch(`${this.baseUrl}/api/jobs/${id}`, { headers: this.authHeaders() }));
  }

  /** Poll a job until it reaches a terminal state. */
  async pollJob(id: string, opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<Job> {
    const interval = opts.intervalMs ?? 1500;
    const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60_000);
    let job = await this.getJob(id);
    while (job.status === "queued" || job.status === "running") {
      if (Date.now() > deadline) throw new Error(`job ${id} timed out (${job.status})`);
      await new Promise((r) => setTimeout(r, interval));
      job = await this.getJob(id);
    }
    return job;
  }

  /** Public URL of a rendered output. */
  outputUrl(outputId: string): string {
    return `${this.baseUrl}/api/media/${outputId}`;
  }

  /** Download a rendered output to a local path. */
  async downloadOutput(outputId: string, destPath: string): Promise<void> {
    const res = await fetch(this.outputUrl(outputId), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`download ${outputId} failed (${res.status})`);
    await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  }
}
