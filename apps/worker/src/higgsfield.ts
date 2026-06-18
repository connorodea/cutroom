import { writeFile } from "node:fs/promises";

/**
 * Higgsfield generative engine — text→image and image→video via platform.higgsfield.ai.
 *
 * Auth: `Authorization: Key {API_KEY_ID}:{API_KEY_SECRET}`.
 * Submit: POST https://platform.higgsfield.ai/{modelId} → { request_id }.
 * Poll:   GET  https://platform.higgsfield.ai/requests/{request_id}/status → { status, images|video }.
 * Status values: queued | in_progress | completed | failed | nsfw.
 */

const BASE = "https://platform.higgsfield.ai";

export const IMAGE_MODELS = {
  soul: "higgsfield-ai/soul/standard",
  reve: "reve/text-to-image",
} as const;

export const VIDEO_MODELS = {
  dop: "higgsfield-ai/dop/standard",
  kling: "kling-video/v2.1/pro/image-to-video",
  seedance: "bytedance/seedance/v1/pro/image-to-video",
} as const;

export type ImageModel = keyof typeof IMAGE_MODELS;
export type VideoModel = keyof typeof VIDEO_MODELS;

const TERMINAL = new Set(["completed", "failed", "nsfw", "succeeded", "error", "canceled"]);

export const authHeader = (id: string, secret: string): string => `Key ${id}:${secret}`;

export function imageBody(prompt: string, aspect: string, resolution = "720p"): Record<string, unknown> {
  return { prompt, aspect_ratio: aspect, resolution };
}

export function videoBody(opts: { imageUrl: string; prompt: string; duration?: number; aspect?: string }): Record<string, unknown> {
  const body: Record<string, unknown> = { image_url: opts.imageUrl, prompt: opts.prompt };
  if (opts.aspect) body.aspect_ratio = opts.aspect;
  if (typeof opts.duration === "number") body.duration = opts.duration;
  return body;
}

export function pickRequestId(resp: unknown): string | undefined {
  if (!resp || typeof resp !== "object") return undefined;
  const o = resp as Record<string, unknown>;
  const v = o.request_id ?? o.id ?? o.requestId;
  return typeof v === "string" ? v : undefined;
}

/** Pull the first usable media URL from a (varied) completed-request payload. */
export function extractMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const o = result as Record<string, unknown>;
  const urlOf = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string") return (v as { url: string }).url;
    return null;
  };
  const firstOf = (v: unknown): string | null => (Array.isArray(v) ? v.map(urlOf).find((u): u is string => !!u) ?? null : null);

  return (
    urlOf(o.video) ??
    urlOf(o.image) ??
    firstOf(o.images) ??
    firstOf(o.videos) ??
    firstOf(o.results) ??
    firstOf(o.output) ??
    urlOf(o.output) ??
    null
  );
}

export const isTerminal = (status: string): boolean => TERMINAL.has(status.toLowerCase());

function creds(): { id: string; secret: string } {
  const id = process.env.HIGGSFIELD_API_KEY_ID;
  const secret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!id || !secret) throw new Error("Higgsfield not configured — set HIGGSFIELD_API_KEY_ID and HIGGSFIELD_API_KEY_SECRET");
  return { id, secret };
}

function headers(): Record<string, string> {
  const { id, secret } = creds();
  return { Authorization: authHeader(id, secret), "Content-Type": "application/json", Accept: "application/json" };
}

async function submit(modelId: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${BASE}/${modelId}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }
  if (!res.ok) {
    const detail = (json as { detail?: string })?.detail ?? text.slice(0, 160);
    throw new Error(`Higgsfield ${modelId} ${res.status}: ${detail}`);
  }
  const id = pickRequestId(json);
  if (!id) throw new Error(`Higgsfield ${modelId}: no request_id in response (${text.slice(0, 160)})`);
  return id;
}

/** Poll a Higgsfield request to a terminal state and return the media URL. */
export async function pollRequest(requestId: string, opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<string> {
  const interval = opts.intervalMs ?? 3000;
  const deadline = Date.now() + (opts.timeoutMs ?? 8 * 60_000);
  for (;;) {
    const res = await fetch(`${BASE}/requests/${requestId}/status`, { headers: headers() });
    const result = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const status = String(result.status ?? "").toLowerCase();
    if (status === "failed" || status === "error" || status === "nsfw" || status === "canceled") {
      throw new Error(`Higgsfield request ${requestId} ${status}: ${JSON.stringify(result).slice(0, 200)}`);
    }
    if (isTerminal(status) || extractMediaUrl(result)) {
      const url = extractMediaUrl(result);
      if (!url) throw new Error(`Higgsfield request ${requestId} completed without media`);
      return url;
    }
    if (Date.now() > deadline) throw new Error(`Higgsfield request ${requestId} timed out (${status || "unknown"})`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

/** Text → image. Returns the generated image URL (Higgsfield-hosted). */
export async function generateImage(prompt: string, aspect: string, model: ImageModel = "soul"): Promise<string> {
  const requestId = await submit(IMAGE_MODELS[model], imageBody(prompt, aspect));
  return pollRequest(requestId);
}

/** Image → video. Returns the generated video URL (Higgsfield-hosted). */
export async function imageToVideo(
  imageUrl: string,
  prompt: string,
  opts: { model?: VideoModel; duration?: number; aspect?: string } = {},
): Promise<string> {
  const requestId = await submit(VIDEO_MODELS[opts.model ?? "dop"], videoBody({ imageUrl, prompt, duration: opts.duration, aspect: opts.aspect }));
  return pollRequest(requestId);
}

/** Download a remote media URL to a local path. */
export async function downloadTo(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} failed (${res.status})`);
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

export const isConfigured = (): boolean => !!(process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET);
