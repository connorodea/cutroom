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
  createCaptionsJob,
  createCreateJob,
  createEditJob,
  createHighlightsJob,
  createImageGenJob,
  createOverlayJob,
  createAudioJob,
  createColorJob,
  createCropJob,
  createFadeJob,
  createGifJob,
  createReframeJob,
  createReverseJob,
  createRotateJob,
  createSpeedJob,
  createTrimJob,
  createTranscriptCutJob,
  createVideoGenJob,
  getJob,
  getSource,
  transcribeSource,
} from "./jobs";
import { parseTokens, isAuthorized } from "./auth";
import { safeOutputId, parseChainOp } from "./chain";
import { normalizeSpeed } from "./speed";

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

// Opt-in API-token gate: enforced only when token(s) are configured. Supports MULTIPLE keys
// (per-user/per-integration) via CUTROOM_API_TOKENS (comma-separated), plus the legacy single
// CUTROOM_API_TOKEN. Clients send `Authorization: Bearer <token>`; /health stays open for probes.
const API_TOKENS = new Set([...parseTokens(process.env.CUTROOM_API_TOKENS), ...parseTokens(process.env.CUTROOM_API_TOKEN)]);
if (API_TOKENS.size > 0) {
  app.use("/api/*", async (c, next) => {
    if (c.req.path.endsWith("/health")) return next();
    if (isAuthorized(c.req.header("authorization"), API_TOKENS)) return next();
    return c.json({ error: "unauthorized — send Authorization: Bearer <token>" }, 401);
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

/** Burn captions onto a video without cutting: multipart { file }. Returns the job to poll. */
app.post("/api/captions", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/cap-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const position = body["position"] === "top" ? "top" : "bottom";
  const job = createCaptionsJob(inputPath, MEDIA_DIR, { position });
  return c.json(job, 202);
});

/**
 * Chain an op onto an existing rendered output (no re-upload): JSON { outputId, op, aspect?, mode? }.
 * op = "reframe" | "captions". Returns a new job to poll.
 */
app.post("/api/chain", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    outputId?: unknown; op?: unknown; aspect?: unknown; mode?: unknown; factor?: unknown;
    preset?: unknown; brightness?: unknown; contrast?: unknown; saturation?: unknown; gamma?: unknown;
    orientation?: unknown; level?: unknown; kind?: unknown; duration?: unknown;
  };
  const id = typeof body.outputId === "string" ? safeOutputId(body.outputId) : null;
  const op = parseChainOp(body.op);
  if (!id || !op) return c.json({ error: "provide 'outputId' (string) and 'op' (reframe|captions|speed|color|rotate|audio|fade|reverse)" }, 400);
  const inputPath = `${MEDIA_DIR}/${id}.mp4`;
  try {
    await stat(inputPath);
  } catch {
    return c.json({ error: "unknown outputId — nothing to chain" }, 404);
  }
  if (op === "reframe") {
    const aspect = body.aspect === "square" || body.aspect === "landscape" ? body.aspect : "portrait";
    const mode = body.mode === "crop" ? "crop" : "blur";
    return c.json(createReframeJob(inputPath, { aspect, mode }, MEDIA_DIR), 202);
  }
  if (op === "speed") {
    return c.json(createSpeedJob(inputPath, normalizeSpeed(body.factor), MEDIA_DIR), 202);
  }
  if (op === "color") {
    const { preset, brightness, contrast, saturation, gamma } = body;
    return c.json(createColorJob(inputPath, { preset, brightness, contrast, saturation, gamma }, MEDIA_DIR), 202);
  }
  if (op === "rotate") {
    return c.json(createRotateJob(inputPath, body.orientation, MEDIA_DIR), 202);
  }
  if (op === "audio") {
    return c.json(createAudioJob(inputPath, body.mode, body.level, MEDIA_DIR), 202);
  }
  if (op === "fade") {
    return c.json(createFadeJob(inputPath, body.kind, body.duration, MEDIA_DIR), 202);
  }
  if (op === "reverse") {
    return c.json(createReverseJob(inputPath, body.mode, MEDIA_DIR), 202);
  }
  return c.json(createCaptionsJob(inputPath, MEDIA_DIR), 202);
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

/**
 * Reframe a video to a target aspect ratio: multipart { file, aspect?, mode? }.
 * aspect: "portrait" (9:16, default) | "square" (1:1) | "landscape" (16:9).
 * mode:   "blur" (fit over a blurred zoomed background, default) | "crop" (cover + center-crop).
 * Returns the job to poll; output served at /api/media/:id.
 */
app.post("/api/reframe", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const aspect = body["aspect"] === "square" || body["aspect"] === "landscape" ? (body["aspect"] as "square" | "landscape") : "portrait";
  const mode = body["mode"] === "crop" ? "crop" : "blur";
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/rf-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createReframeJob(inputPath, { aspect, mode }, MEDIA_DIR);
  return c.json(job, 202);
});

/** Speed change — retime an upload (>1 timelapse, <1 slow-motion): multipart { file, factor }. */
app.post("/api/speed", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const factor = normalizeSpeed(body["factor"]);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/sp-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createSpeedJob(inputPath, factor, MEDIA_DIR);
  return c.json(job, 202);
});

/** Trim — keep an explicit [start,end] window of an upload: multipart { file, start, end }. */
app.post("/api/trim", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/tr-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createTrimJob(inputPath, body["start"], body["end"], MEDIA_DIR);
  return c.json(job, 202);
});

/** Color grade — apply a named look or custom adjustments: multipart { file, preset, brightness, … }. */
app.post("/api/color", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/col-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createColorJob(
    inputPath,
    { preset: body["preset"], brightness: body["brightness"], contrast: body["contrast"], saturation: body["saturation"], gamma: body["gamma"] },
    MEDIA_DIR,
  );
  return c.json(job, 202);
});

/** Rotate / flip — fix orientation or mirror an upload: multipart { file, orientation }. */
app.post("/api/rotate", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/rot-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createRotateJob(inputPath, body["orientation"], MEDIA_DIR);
  return c.json(job, 202);
});

/** Audio — scale volume / mute / normalize loudness: multipart { file, mode, level }. */
app.post("/api/audio", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/aud-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createAudioJob(inputPath, body["mode"], body["level"], MEDIA_DIR);
  return c.json(job, 202);
});

/** Fade — add an intro/outro fade-from/to-black: multipart { file, kind, duration }. */
app.post("/api/fade", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/fade-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createFadeJob(inputPath, body["kind"], body["duration"], MEDIA_DIR);
  return c.json(job, 202);
});

/** Reverse / boomerang — play a clip backwards or forward-then-reversed: multipart { file, mode }. */
app.post("/api/reverse", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/rev-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createReverseJob(inputPath, body["mode"], MEDIA_DIR);
  return c.json(job, 202);
});

/** Crop — punch into a region of the frame: multipart { file, preset, x, y, w, h }. */
app.post("/api/crop", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/crop-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createCropJob(
    inputPath,
    { preset: body["preset"], x: body["x"], y: body["y"], w: body["w"], h: body["h"] },
    MEDIA_DIR,
  );
  return c.json(job, 202);
});

/** GIF export — render an upload to a looping GIF: multipart { file, fps, width }. */
app.post("/api/gif", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "missing 'file' (multipart)" }, 400);
  const ext = extname(file.name || "") || ".mp4";
  const inputPath = `${MEDIA_DIR}/gif-${Date.now()}${ext}`;
  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  const job = createGifJob(inputPath, { fps: body["fps"], width: body["width"] }, MEDIA_DIR);
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

/** Auto-highlights: build a "best moments" reel from a transcribed source. JSON { sourceId, count? }. */
app.post("/api/jobs/highlights", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { sourceId?: string; count?: unknown };
  const source = body.sourceId ? getSource(body.sourceId) : undefined;
  if (!source) return c.json({ error: "unknown sourceId — re-upload" }, 404);
  const count = typeof body.count === "number" && body.count > 0 ? Math.floor(body.count) : undefined;
  const job = createHighlightsJob(source, { count }, MEDIA_DIR);
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
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Serve a rendered/generated output (MP4 or image) by job/output id. */
app.get("/api/media/:id", async (c) => {
  const id = c.req.param("id").replace(/[^a-zA-Z0-9-]/g, "");
  for (const ext of [".mp4", ".gif", ".png", ".jpg", ".jpeg", ".webp"]) {
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
