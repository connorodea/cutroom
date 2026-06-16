import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Cutroom media worker (Railway). The compute service both pipelines run on:
 *  - Edit:   upload → Whisper ASR → cut silences/filler + burn captions + loudnorm → MP4
 *  - Create: script/idea → generated clips (fal.ai) + TTS + captions → assembled MP4
 *
 * This entrypoint stands up the service + proves ffmpeg is available in the container.
 * The job API and pipelines are layered on next.
 */

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "cutroom-worker" }));
app.get("/api/worker/health", (c) => c.json({ ok: true, service: "cutroom-worker" }));

/** Proves ffmpeg + ffprobe are present in the runtime image. */
app.get("/api/worker/ffmpeg", async (c) => {
  try {
    const [ff, fp] = await Promise.all([
      exec("ffmpeg", ["-version"]),
      exec("ffprobe", ["-version"]),
    ]);
    return c.json({
      ok: true,
      ffmpeg: ff.stdout.split("\n")[0],
      ffprobe: fp.stdout.split("\n")[0],
    });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[cutroom-worker] listening on :${port}`);
