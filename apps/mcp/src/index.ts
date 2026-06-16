import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CutroomClient, type Job } from "@cutroom/sdk";

/**
 * Cutroom MCP server — lets any MCP-capable AI agent drive Cutroom:
 * transcribe a video, auto clean it up, edit by transcript, check jobs, download results.
 * Built on @cutroom/sdk; auth + base URL via CUTROOM_API_TOKEN / CUTROOM_API_URL.
 */

const client = new CutroomClient();

const server = new McpServer({ name: "cutroom", version: "0.0.0" });

const jobSummary = (job: Job) => ({
  jobId: job.id,
  status: job.status,
  ...(job.result
    ? { outputId: job.result.outputId, outputUrl: client.outputUrl(job.result.outputId), removedSec: job.result.removedSec, words: job.result.totalWords, segments: job.result.segments }
    : {}),
  ...(job.error ? { error: job.error } : {}),
});

const textResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

server.registerTool(
  "cutroom_health",
  {
    description: "Check the Cutroom API is reachable and whether the agent key is configured.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async () => textResult(await client.health()),
);

server.registerTool(
  "cutroom_clean_up",
  {
    description: "Auto-edit a video: transcribe, cut silences & filler words, burn captions, normalize audio. Waits for the render and returns the output URL.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to a local video file (mp4/mov)."),
      captions: z.boolean().optional().describe("Burn word captions (default true)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ filePath, captions }) => {
    const job = await client.cleanUp(filePath, { captions });
    return textResult(jobSummary(await client.pollJob(job.id)));
  },
);

server.registerTool(
  "cutroom_transcribe",
  {
    description: "Transcribe a video to a word-level transcript. Returns a sourceId (for cutroom_transcript_cut) and indexed words.",
    inputSchema: { filePath: z.string().describe("Absolute path to a local video file.") },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async ({ filePath }) => {
    const t = await client.transcribe(filePath);
    return textResult({ sourceId: t.sourceId, duration: t.duration, words: t.words.map((w, i) => ({ i, word: w.word, start: w.start })) });
  },
);

server.registerTool(
  "cutroom_transcript_cut",
  {
    description: "Edit a transcribed video by removing words: pass the sourceId from cutroom_transcribe and the word indices to delete. Their spans are cut from the video. Waits for the render.",
    inputSchema: {
      sourceId: z.string().describe("sourceId from cutroom_transcribe."),
      removedIndices: z.array(z.number().int()).describe("Word indices to remove (cut from the video)."),
      captions: z.boolean().optional().describe("Burn word captions (default true)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ sourceId, removedIndices, captions }) => {
    const job = await client.transcriptCut(sourceId, removedIndices, { captions });
    return textResult(jobSummary(await client.pollJob(job.id)));
  },
);

server.registerTool(
  "cutroom_get_job",
  {
    description: "Get the status (and result) of a Cutroom job by id.",
    inputSchema: { jobId: z.string() },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ jobId }) => textResult(jobSummary(await client.getJob(jobId))),
);

server.registerTool(
  "cutroom_download",
  {
    description: "Download a rendered output to a local file path.",
    inputSchema: { outputId: z.string(), destPath: z.string().describe("Absolute local path to write the MP4 to.") },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async ({ outputId, destPath }) => {
    await client.downloadOutput(outputId, destPath);
    return textResult({ savedTo: destPath, outputId });
  },
);

await server.connect(new StdioServerTransport());
// eslint-disable-next-line no-console
console.error(`[cutroom-mcp] ready · API ${client.baseUrl}`);
