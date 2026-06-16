import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { extname } from "node:path";
import { createEditJob, getJob } from "./jobs";

const exec = promisify(execFile);

/**
 * Cutroom media worker (Railway). Compute for both pipelines:
 *  - Edit:   upload → Whisper → cut silences/filler + burn captions + loudnorm → MP4
 *  - Create: script/idea → generated clips + TTS + captions → assembled MP4 (next)
 */

const MEDIA_DIR = process.env.MEDIA_DIR ?? "/tmp/cutroom-media";
await mkdir(MEDIA_DIR, { recursive: true });

const app = new Hono();
app.use("/api/*", cors()); // editor (cutroom.preecursor.com) is cross-origin

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

/** Poll a job. */
app.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json(job);
});

/** Serve a rendered output MP4 by job/output id. */
app.get("/api/media/:id", async (c) => {
  const id = c.req.param("id").replace(/[^a-zA-Z0-9-]/g, "");
  const path = `${MEDIA_DIR}/${id}.mp4`;
  try {
    const s = await stat(path);
    c.header("Content-Type", "video/mp4");
    c.header("Content-Length", String(s.size));
    c.header("Accept-Ranges", "bytes");
    return c.body(Readable.toWeb(createReadStream(path)) as ReadableStream);
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[cutroom-worker] listening on :${port} · media ${MEDIA_DIR}`);
