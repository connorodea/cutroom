import { CutroomClient, type Job } from "@cutroom/sdk";

const USAGE = `cutroom — AI video editing CLI

Usage:
  cutroom health
  cutroom clean-up <file> [--no-captions] [--out <file>]      auto: cut silences/filler + captions
  cutroom transcribe <file>                                    word-level transcript (+ sourceId)
  cutroom transcript-cut <sourceId> <i,j,k> [--no-captions] [--out <file>]   remove words by index
  cutroom status <jobId>
  cutroom download <outputId> <file>

Env:
  CUTROOM_API_URL    Cutroom API base (default: hosted worker)
  CUTROOM_API_TOKEN  API token (sent as Bearer)`;

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
