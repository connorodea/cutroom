import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { extname } from "node:path";
import {
  createCreateJob,
  createEditJob,
  createImageGenJob,
  createOverlayJob,
  createTranscriptCutJob,
  createVideoGenJob,
  getJob,
  getSource,
  transcribeSource,
} from "./jobs";

const exec = promisify(execFile);

/**
 * Cutroom media worker (Railway). Compute for both pipelines:
 *  - Edit:   upload → Whisper → cut silences/filler + burn captions + loudnorm → MP4
 *  - Create: prompt/script → AI script → Pexels stock + TTS voiceover + captions → assembled MP4
 */

const MEDIA_DIR = process.env.MEDIA_DIR ?? "/tmp/cutroom-media";
await mkdir(MEDIA_DIR, { recursive: true });

const app = new Hono();
app.use("/api/*", cors()); // editor (cutroom.preecursor.com) is cross-origin

// Opt-in API-token gate: only enforced when CUTROOM_API_TOKEN is set. The CLI / MCP / external
// agents send `Authorization: Bearer <token>`; /health stays open for probes.
const API_TOKEN = process.env.CUTROOM_API_TOKEN;
if (API_TOKEN) {
  app.use("/api/*", async (c, next) => {
    if (c.req.path.endsWith("/health")) return next();
    if (c.req.header("authorization") === `Bearer ${API_TOKEN}`) return next();
    return c.json({ error: "unauthorized — send Authorization: Bearer <CUTROOM_API_TOKEN>" }, 401);
  });
}

app.get("/health", (c) => c.json({ ok: true, service: "cutroom-worker" }));
app.get("/api/worker/health", (c) => c.json({ ok: true, service: "cutroom-worker" }));

app.get("/api/worker/ffmpeg", async (c) => {
  try {
    const [ff, fp] = await Promise.all([exec("ffmpeg", ["-version"]), exec("ffprobe", ["-version"])]);
    return c.json({ ok: true, ffmpeg: ff.stdout.split("\n")[0], ffprobe: fp.stdout.split("\n")[0] });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

/** Submit an Edit job: multipart { file, captions? }. Returns the job to poll. */
app.post("/api/jobs", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);

  const captions = body["captions"] !== "false";
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/in-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

  const job = createEditJob(inputPath, MEDIA_DIR, { captions });
  return c.json(job, 202);
});

/**
 * Submit a Create job: JSON { prompt? , script?, aspect?, captions? }.
 * The AI writes a script from `prompt` (or uses the supplied `script`), pulls Pexels stock footage
 * matched to each scene, lays an OpenAI TTS voiceover, and burns word-aligned captions. Poll the job.
 */
app.post("/api/create", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    prompt?: unknown;
    script?: unknown;
    aspect?: unknown;
    captions?: unknown;
    overlays?: unknown;
    autoGraphics?: unknown;
    source?: unknown;
    videoModel?: unknown;
  };
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : undefined;
  const script = Array.isArray(body.script)
    ? body.script
        .map((s) => ({ text: String((s as { text?: unknown }).text ?? "").trim(), query: String((s as { query?: unknown }).query ?? "").trim() }))
        .filter((s) => s.text.length > 0)
    : undefined;
  if (!prompt && !(script && script.length)) {
    return c.json({ error: "provide 'prompt' (string) or 'script' ([{text, query}])" }, 400);
  }
  const aspect = body.aspect === "portrait" ? "portrait" : "landscape";
  const overlays = Array.isArray(body.overlays) ? body.overlays : undefined;
  const source = body.source === "generative" ? "generative" : "stock";
  const videoModel = ["dop", "kling", "seedance"].includes(String(body.videoModel)) ? (String(body.videoModel) as "dop" | "kling" | "seedance") : undefined;
  const job = createCreateJob(
    { prompt, script, aspect, captions: body.captions !== false, overlays, autoGraphics: body.autoGraphics !== false, source, videoModel },
    MEDIA_DIR,
  );
  return c.json(job, 202);
});

/**
 * Apply graphics overlays to a video: multipart { file, overlays }.
 * `overlays` is a JSON-string array of elements: title/lower_third/callout/badge with timing.
 * Returns the job to poll; output served at /api/media/:id.
 */
app.post("/api/overlay", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  let overlays: unknown = [];
  const spec = body["overlays"];
  if (typeof spec === "string" && spec.trim()) {
    try {
      overlays = JSON.parse(spec);
    } catch {
      return c.json({ error: "'overlays' must be a JSON array string" }, 400);
    }
  }
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/ov-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createOverlayJob(inputPath, overlays, MEDIA_DIR);
  return c.json(job, 202);
});

/** Transcript editor — step 1: upload → word-level transcript + sourceId. */
app.post("/api/transcribe", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/src-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const source = await transcribeSource(inputPath, MEDIA_DIR);
  return c.json({ sourceId: source.id, duration: source.duration, words: source.words });
});

/** Transcript editor — step 2: apply edits (remove word indices) → render. */
app.post("/api/jobs/transcript-cut", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { sourceId?: string; removedIndices?: unknown; captions?: unknown };
  const source = body.sourceId ? getSource(body.sourceId) : undefined;
  if (!source) return c.json({ error: "unknown sourceId — re-upload" }, 404);
  const removedIndices = Array.isArray(body.removedIndices)
    ? body.removedIndices.filter((n): n is number => Number.isInteger(n))
    : [];
  const job = createTranscriptCutJob(source, removedIndices, MEDIA_DIR, { captions: body.captions !== false });
  return c.json(job, 202);
});

/** Generate an image with Higgsfield: JSON { prompt, aspect?, model? }. Poll the job. */
app.post("/api/generate/image", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: unknown; aspect?: unknown; model?: unknown };
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : undefined;
  if (!prompt) return c.json({ error: "provide 'prompt' (string)" }, 400);
  const aspect = typeof body.aspect === "string" ? body.aspect : undefined;
  const model = body.model === "reve" ? "reve" : "soul";
  const job = createImageGenJob({ prompt, aspect, model }, MEDIA_DIR);
  return c.json(job, 202);
});

/**
 * Generate a video with Higgsfield: JSON { prompt, imageUrl?, model?, aspect?, duration? }.
 * With imageUrl it animates that image; otherwise it makes a base image from prompt first. Poll the job.
 */
app.post("/api/generate/video", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    prompt?: unknown;
    imageUrl?: unknown;
    model?: unknown;
    aspect?: unknown;
    duration?: unknown;
  };
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : undefined;
  if (!prompt && !imageUrl) return c.json({ error: "provide 'prompt' or 'imageUrl'" }, 400);
  const model = ["dop", "kling", "seedance"].includes(String(body.model)) ? (String(body.model) as "dop" | "kling" | "seedance") : undefined;
  const aspect = typeof body.aspect === "string" ? body.aspect : undefined;
  const duration = typeof body.duration === "number" ? body.duration : undefined;
  const job = createVideoGenJob({ prompt, imageUrl, model, aspect, duration }, MEDIA_DIR);
  return c.json(job, 202);
});

/** Poll a job. */
app.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json(job);
});

const MEDIA_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Serve a rendered/generated output (MP4 or image) by job/output id. */
app.get("/api/media/:id", async (c) => {
  const id = c.req.param("id").replace(/[^a-zA-Z0-9-]/g, "");
  for (const ext of [".mp4", ".png", ".jpg", ".jpeg", ".webp"]) {
    const path = `${MEDIA_DIR}/${id}${ext}`;
    try {
      const s = await stat(path);
      c.header("Content-Type", MEDIA_TYPES[ext]);
      c.header("Content-Length", String(s.size));
      if (ext === ".mp4") c.header("Accept-Ranges", "bytes");
      return c.body(Readable.toWeb(createReadStream(path)) as ReadableStream);
    } catch {
      // try next extension
    }
  }
  return c.json({ error: "not found" }, 404);
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[cutroom-worker] listening on :${port} · media ${MEDIA_DIR}`);
