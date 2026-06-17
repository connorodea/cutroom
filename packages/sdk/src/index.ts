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
  type: "edit" | "create" | "overlay" | "reframe" | "image" | "video";
  status: "queued" | "running" | "done" | "error";
  step?: string;
  result?: { outputId: string; [key: string]: unknown };
  error?: string;
}

/** A script scene: narration line + the stock-footage search query for it. */
export interface ScriptSegment {
  text: string;
  query: string;
}

/** A graphics overlay element (title / lower third / callout / badge) with a time window. */
export type OverlaySpec =
  | { type: "title"; text: string; subtitle?: string; start: number; end: number }
  | { type: "lower_third"; text: string; subtitle?: string; start: number; end: number }
  | { type: "callout"; text: string; x: number; y: number; start: number; end: number }
  | { type: "badge"; text: string; corner?: "tl" | "tr" | "bl" | "br"; start: number; end: number };

/** Permissive overlay shape accepted by the API (validated/normalized server-side). */
export interface OverlayInput {
  type: "title" | "lower_third" | "callout" | "badge";
  text: string;
  subtitle?: string;
  x?: number;
  y?: number;
  corner?: "tl" | "tr" | "bl" | "br";
  start: number;
  end: number;
}

export interface CreateOptions {
  /** A topic/idea — the AI writes the script and picks stock footage. */
  prompt?: string;
  /** Or supply the script scenes directly (skips AI script-writing). */
  script?: ScriptSegment[];
  aspect?: "landscape" | "portrait";
  /** Burn word-aligned captions (default true). */
  captions?: boolean;
  /** Explicit graphics spec; when omitted, the AI designs overlays (unless autoGraphics is false). */
  overlays?: OverlayInput[];
  /** Let the AI design on-screen graphics (default true). */
  autoGraphics?: boolean;
  /** Footage source: "stock" (Pexels, default) or "generative" (Higgsfield text→image→video). */
  source?: "stock" | "generative";
  /** Higgsfield video model for the generative source. */
  videoModel?: "dop" | "kling" | "seedance";
}

/** Target aspect for reframe: portrait (9:16), square (1:1), or landscape (16:9). */
export type ReframeAspect = "portrait" | "square" | "landscape";
/** Fit mode for reframe: "blur" (fit over blurred background) or "crop" (cover + center-crop). */
export type ReframeMode = "blur" | "crop";

export interface ReframeOptions {
  /** Target aspect ratio (default "portrait" — 9:16). */
  aspect?: ReframeAspect;
  /** Fit mode (default "blur"). */
  mode?: ReframeMode;
}

export interface ImageGenOptions {
  prompt: string;
  aspect?: string;
  model?: "soul" | "reve";
}

export interface VideoGenOptions {
  /** Motion prompt (and the base-image prompt when no imageUrl is given). */
  prompt?: string;
  /** Animate this image (image→video); omit to generate a base image first (text→image→video). */
  imageUrl?: string;
  model?: "dop" | "kling" | "seedance";
  aspect?: string;
  duration?: number;
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

  /**
   * Create a video from a prompt or script: AI writes narration → Pexels stock footage matched per
   * scene → TTS voiceover → word-aligned captions → AI-designed graphics overlays → job.
   */
  async create(opts: CreateOptions): Promise<Job> {
    return this.json(
      await fetch(`${this.baseUrl}/api/create`, {
        method: "POST",
        headers: this.authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(opts),
      }),
    );
  }

  /** Composite graphics overlays (titles/lower thirds/callouts/badges) onto a video → job. */
  async overlay(filePath: string, overlays: OverlayInput[]): Promise<Job> {
    const fd = await this.fileForm(filePath, { overlays: JSON.stringify(overlays) });
    return this.json(await fetch(`${this.baseUrl}/api/overlay`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /**
   * Reframe a video to a target aspect ratio (default 9:16 portrait) → job. `mode` "blur" (default)
   * fits the video over a blurred zoomed background; "crop" covers the frame and center-crops.
   */
  async reframe(filePath: string, opts: ReframeOptions = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { aspect: opts.aspect ?? "portrait", mode: opts.mode ?? "blur" });
    return this.json(await fetch(`${this.baseUrl}/api/reframe`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Generate an image from a prompt via Higgsfield → job (output served at /api/media/:id). */
  async generateImage(opts: ImageGenOptions): Promise<Job> {
    return this.json(
      await fetch(`${this.baseUrl}/api/generate/image`, {
        method: "POST",
        headers: this.authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(opts),
      }),
    );
  }

  /** Generate a video via Higgsfield (text→image→video, or image→video with imageUrl) → job. */
  async generateVideo(opts: VideoGenOptions): Promise<Job> {
    return this.json(
      await fetch(`${this.baseUrl}/api/generate/video`, {
        method: "POST",
        headers: this.authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(opts),
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
