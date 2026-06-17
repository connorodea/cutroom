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
  type: "edit" | "create" | "overlay" | "reframe" | "highlights" | "captions" | "speed" | "trim" | "color" | "rotate" | "audio" | "fade" | "reverse" | "crop" | "gif" | "loop" | "thumbnail" | "stitch" | "watermark" | "pip" | "split" | "image" | "video";
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

  /** Burn word-aligned captions onto a video (no cutting), at the bottom (default) or top → job. */
  async captions(filePath: string, opts: { position?: "bottom" | "top" } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { position: opts.position ?? "bottom" });
    return this.json(await fetch(`${this.baseUrl}/api/captions`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Retime a video by a speed factor (>1 timelapse, <1 slow-motion), retiming audio too → job. */
  async speed(filePath: string, opts: { factor?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { factor: String(opts.factor ?? 2) });
    return this.json(await fetch(`${this.baseUrl}/api/speed`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Split-screen: place two clips side-by-side ("horizontal") or stacked ("vertical") → job. */
  async splitScreen(leftPath: string, rightPath: string, opts: { layout?: "horizontal" | "vertical" } = {}): Promise<Job> {
    const fd = new FormData();
    fd.append("file", new File([await readFile(leftPath)], basename(leftPath)));
    fd.append("right", new File([await readFile(rightPath)], basename(rightPath)));
    fd.append("layout", opts.layout ?? "horizontal");
    return this.json(await fetch(`${this.baseUrl}/api/split`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Picture-in-picture: composite `overlayPath` into a corner of `mainPath` → job. corner tl/tr/bl/br, scale 0.1–0.5. */
  async pip(mainPath: string, overlayPath: string, opts: { corner?: "tl" | "tr" | "bl" | "br"; scale?: number } = {}): Promise<Job> {
    const fd = new FormData();
    fd.append("file", new File([await readFile(mainPath)], basename(mainPath)));
    fd.append("overlay", new File([await readFile(overlayPath)], basename(overlayPath)));
    fd.append("corner", opts.corner ?? "br");
    fd.append("scale", String(opts.scale ?? 0.3));
    return this.json(await fetch(`${this.baseUrl}/api/pip`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Burn a persistent corner watermark (text) into a video → job. corner tl/tr/bl/br, opacity 0.1–1. */
  async watermark(filePath: string, text: string, opts: { corner?: "tl" | "tr" | "bl" | "br"; opacity?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { text, corner: opts.corner ?? "br", opacity: String(opts.opacity ?? 0.5) });
    return this.json(await fetch(`${this.baseUrl}/api/watermark`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Concatenate several clips (in order) into one video → job. Pass 2+ file paths. */
  async stitch(filePaths: string[]): Promise<Job> {
    const fd = new FormData();
    for (const p of filePaths) fd.append("files", new File([await readFile(p)], basename(p)));
    return this.json(await fetch(`${this.baseUrl}/api/stitch`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Grab a poster frame from a video at `time` seconds (default: the clip midpoint) → job; output a .png. */
  async thumbnail(filePath: string, opts: { time?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, opts.time != null ? { time: String(opts.time) } : {});
    return this.json(await fetch(`${this.baseUrl}/api/thumbnail`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Repeat a video end-to-end `count` times (2–10, default 2) → job. */
  async loop(filePath: string, opts: { count?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { count: String(opts.count ?? 2) });
    return this.json(await fetch(`${this.baseUrl}/api/loop`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Render a video to a looping GIF (fps default 12, width default 480px) → job; output served as a .gif. */
  async gif(filePath: string, opts: { fps?: number; width?: number } = {}): Promise<Job> {
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts)) if (v != null) extra[k] = String(v);
    const fd = await this.fileForm(filePath, extra);
    return this.json(await fetch(`${this.baseUrl}/api/gif`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Crop a video to a region — a named preset (center/top/bottom/left/right) or custom fractions → job. */
  async crop(filePath: string, opts: { preset?: string; x?: number; y?: number; w?: number; h?: number } = {}): Promise<Job> {
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts)) if (v != null) extra[k] = String(v);
    const fd = await this.fileForm(filePath, extra);
    return this.json(await fetch(`${this.baseUrl}/api/crop`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Reverse a video ("reverse") or play it forward-then-reversed ("boomerang") → job. */
  async reverse(filePath: string, opts: { mode?: "reverse" | "boomerang" } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { mode: opts.mode ?? "reverse" });
    return this.json(await fetch(`${this.baseUrl}/api/reverse`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Add an intro/outro fade (kind "in" | "out" | "both") of `duration` seconds to a video → job. */
  async fade(filePath: string, opts: { kind?: "in" | "out" | "both"; duration?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { kind: opts.kind ?? "both", duration: String(opts.duration ?? 0.5) });
    return this.json(await fetch(`${this.baseUrl}/api/fade`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Audio op on a video: scale the volume (mode "volume" + level), "mute", or "normalize" loudness → job. */
  async audio(filePath: string, opts: { mode?: "volume" | "mute" | "normalize"; level?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { mode: opts.mode ?? "volume", level: String(opts.level ?? 1) });
    return this.json(await fetch(`${this.baseUrl}/api/audio`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Rotate (cw/ccw/180) or flip (flip-h/flip-v) a video → job. */
  async rotate(filePath: string, opts: { orientation?: "cw" | "ccw" | "180" | "flip-h" | "flip-v" } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { orientation: opts.orientation ?? "cw" });
    return this.json(await fetch(`${this.baseUrl}/api/rotate`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Color-grade a video with a named look (vivid/warm/cool/bw/cinematic) or custom adjustments → job. */
  async color(filePath: string, opts: { preset?: string; brightness?: number; contrast?: number; saturation?: number; gamma?: number } = {}): Promise<Job> {
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts)) if (v != null) extra[k] = String(v);
    const fd = await this.fileForm(filePath, extra);
    return this.json(await fetch(`${this.baseUrl}/api/color`, { method: "POST", headers: this.authHeaders(), body: fd }));
  }

  /** Keep an explicit [start, end] second window of a video (clamped to its duration) → job. */
  async trim(filePath: string, opts: { start?: number; end?: number } = {}): Promise<Job> {
    const fd = await this.fileForm(filePath, { start: String(opts.start ?? 0), end: String(opts.end ?? "") });
    return this.json(await fetch(`${this.baseUrl}/api/trim`, { method: "POST", headers: this.authHeaders(), body: fd }));
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

  /** Build a "best moments" highlight reel from a transcribed source (from transcribe) → job. */
  async highlights(sourceId: string, opts: { count?: number } = {}): Promise<Job> {
    return this.json(
      await fetch(`${this.baseUrl}/api/jobs/highlights`, {
        method: "POST",
        headers: this.authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ sourceId, count: opts.count }),
      }),
    );
  }

  /** Chain an op onto an existing rendered output by id (no re-upload): reframe / captions / speed / color / rotate / audio / fade / reverse / crop / gif / loop / thumbnail. */
  async chain(
    outputId: string,
    op: "reframe" | "captions" | "speed" | "color" | "rotate" | "audio" | "fade" | "reverse" | "crop" | "gif" | "loop" | "thumbnail",
    opts: { aspect?: ReframeAspect; mode?: ReframeMode | string; factor?: number; preset?: string; orientation?: string; level?: number; kind?: string; duration?: number; x?: number; y?: number; w?: number; h?: number; fps?: number; width?: number; count?: number; time?: number } = {},
  ): Promise<Job> {
    return this.json(
      await fetch(`${this.baseUrl}/api/chain`, {
        method: "POST",
        headers: this.authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ outputId, op, ...opts }),
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
