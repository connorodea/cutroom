import { readFile } from "node:fs/promises";
import { CutroomClient, type Job } from "@cutroom/sdk";

const USAGE = `cutroom — AI video editing CLI

Usage:
  cutroom health
  cutroom clean-up <file> [--no-captions] [--out <file>]      auto: cut silences/filler + captions
  cutroom transcribe <file>                                    word-level transcript (+ sourceId)
  cutroom transcript-cut <sourceId> <i,j,k> [--no-captions] [--out <file>]   remove words by index
  cutroom captions <file> [--out <file>]                       burn word-aligned captions onto a video
  cutroom chain <outputId> <reframe|captions> [--aspect ...] [--mode ...] [--out <file>]   chain an op onto an output
  cutroom highlights <sourceId> [--count N] [--out <file>]    best-moments reel from a transcribed source
  cutroom create "<prompt>" [--portrait] [--no-captions] [--no-graphics] [--generative] [--video-model dop|kling|seedance] [--overlays <json|@file>] [--out <file>]
                                                               AI: script → stock/generative footage → voiceover → captions → graphics
  cutroom overlay <file> <json|@file> [--out <file>]           composite titles/lower-thirds/callouts/badges onto a video
  cutroom reframe <file> [--aspect portrait|square|landscape] [--mode blur|crop] [--out <file>]   reframe to 9:16 / 1:1 / 16:9
  cutroom generate-image "<prompt>" [--aspect 16:9] [--model soul|reve] [--out <file.png>]   Higgsfield text→image
  cutroom generate-video "<prompt>" [--image-url <url>] [--model dop|kling|seedance] [--aspect 16:9] [--duration <s>] [--out <file.mp4>]
                                                               Higgsfield text→image→video (or image→video with --image-url)
  cutroom status <jobId>
  cutroom download <outputId> <file>

Env:
  CUTROOM_API_URL    Cutroom API base (default: hosted worker)
  CUTROOM_API_TOKEN  API token (sent as Bearer)`;

/** Parse an arg that's either inline JSON or @path-to-json-file. */
async function readJsonArg(arg: string): Promise<unknown> {
  const text = arg.startsWith("@") ? await readFile(arg.slice(1), "utf8") : arg;
  return JSON.parse(text);
}

const flag = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (args: string[], name: string): boolean => args.includes(`--${name}`);

async function finish(client: CutroomClient, job: Job, out?: string): Promise<void> {
  process.stderr.write(`job ${job.id} ${job.status}…\n`);
  const final = await client.pollJob(job.id);
  if (final.status !== "done") {
    console.error("error:", final.error || "job failed");
    process.exit(1);
  }
  console.log(JSON.stringify(final.result, null, 2));
  if (out && final.result) {
    await client.downloadOutput(final.result.outputId, out);
    process.stderr.write(`saved → ${out}\n`);
  } else if (final.result) {
    process.stderr.write(`output: ${client.outputUrl(final.result.outputId)}\n`);
  }
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const client = new CutroomClient();

  switch (cmd) {
    case "health":
      console.log(JSON.stringify(await client.health(), null, 2));
      break;

    case "clean-up": {
      if (!args[0]) throw new Error("usage: cutroom clean-up <file>");
      const job = await client.cleanUp(args[0], { captions: !has(args, "no-captions") });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "transcribe": {
      if (!args[0]) throw new Error("usage: cutroom transcribe <file>");
      const t = await client.transcribe(args[0]);
      console.log(JSON.stringify({ sourceId: t.sourceId, duration: t.duration, words: t.words.map((w, i) => `${i}:${w.word}`) }, null, 2));
      break;
    }

    case "transcript-cut": {
      if (!args[0]) throw new Error("usage: cutroom transcript-cut <sourceId> <i,j,k>");
      const indices = (args[1] || "").split(",").map((s) => Number(s.trim())).filter(Number.isInteger);
      const job = await client.transcriptCut(args[0], indices, { captions: !has(args, "no-captions") });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "create": {
      if (!args[0]) throw new Error('usage: cutroom create "<prompt>" [--portrait] [--no-graphics] [--generative] [--out <file>]');
      const overlaysArg = flag(args, "overlays");
      const vm = flag(args, "video-model");
      const job = await client.create({
        prompt: args[0],
        aspect: has(args, "portrait") ? "portrait" : "landscape",
        captions: !has(args, "no-captions"),
        autoGraphics: !has(args, "no-graphics"),
        source: has(args, "generative") ? "generative" : "stock",
        videoModel: vm === "kling" || vm === "seedance" ? vm : vm === "dop" ? "dop" : undefined,
        overlays: overlaysArg ? ((await readJsonArg(overlaysArg)) as never) : undefined,
      });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "generate-image": {
      if (!args[0]) throw new Error('usage: cutroom generate-image "<prompt>" [--aspect 16:9] [--model soul|reve] [--out <file.png>]');
      const model = flag(args, "model");
      const job = await client.generateImage({
        prompt: args[0],
        aspect: flag(args, "aspect"),
        model: model === "reve" ? "reve" : model === "soul" ? "soul" : undefined,
      });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "generate-video": {
      if (!args[0] && !flag(args, "image-url")) {
        throw new Error('usage: cutroom generate-video "<prompt>" [--image-url <url>] [--model dop|kling|seedance] [--out <file.mp4>]');
      }
      const model = flag(args, "model");
      const duration = flag(args, "duration");
      const job = await client.generateVideo({
        prompt: args[0],
        imageUrl: flag(args, "image-url"),
        model: model === "kling" || model === "seedance" ? model : model === "dop" ? "dop" : undefined,
        aspect: flag(args, "aspect"),
        duration: duration ? Number(duration) : undefined,
      });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "overlay": {
      if (!args[0] || !args[1]) throw new Error("usage: cutroom overlay <file> <json|@file> [--out <file>]");
      const overlays = (await readJsonArg(args[1])) as never;
      const job = await client.overlay(args[0], overlays);
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "reframe": {
      if (!args[0]) throw new Error("usage: cutroom reframe <file> [--aspect portrait|square|landscape] [--mode blur|crop] [--out <file>]");
      const aspect = flag(args, "aspect");
      const mode = flag(args, "mode");
      const job = await client.reframe(args[0], {
        aspect: aspect === "square" || aspect === "landscape" ? aspect : aspect === "portrait" ? "portrait" : undefined,
        mode: mode === "crop" ? "crop" : mode === "blur" ? "blur" : undefined,
      });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "captions": {
      if (!args[0]) throw new Error("usage: cutroom captions <file> [--out <file>]");
      await finish(client, await client.captions(args[0]), flag(args, "out"));
      break;
    }

    case "chain": {
      if (!args[0] || !args[1]) throw new Error("usage: cutroom chain <outputId> <reframe|captions> [--aspect ...] [--mode ...] [--out <file>]");
      const op = args[1] === "captions" ? "captions" : "reframe";
      const a = flag(args, "aspect");
      const m = flag(args, "mode");
      const job = await client.chain(args[0], op, {
        aspect: a === "square" || a === "landscape" ? a : a === "portrait" ? "portrait" : undefined,
        mode: m === "crop" ? "crop" : m === "blur" ? "blur" : undefined,
      });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "highlights": {
      if (!args[0]) throw new Error("usage: cutroom highlights <sourceId> [--count N] [--out <file>]");
      const count = flag(args, "count");
      const job = await client.highlights(args[0], { count: count ? Number(count) : undefined });
      await finish(client, job, flag(args, "out"));
      break;
    }

    case "status":
      if (!args[0]) throw new Error("usage: cutroom status <jobId>");
      console.log(JSON.stringify(await client.getJob(args[0]), null, 2));
      break;

    case "download":
      if (!args[0] || !args[1]) throw new Error("usage: cutroom download <outputId> <file>");
      await client.downloadOutput(args[0], args[1]);
      process.stderr.write(`saved → ${args[1]}\n`);
      break;

    default:
      console.log(USAGE);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("error:", (err as Error).message);
  process.exit(1);
});
