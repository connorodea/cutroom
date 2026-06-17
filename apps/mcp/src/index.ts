import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CutroomClient, type Job } from "@cutroom/sdk";

/**
 * Cutroom MCP server — lets any MCP-capable AI agent drive Cutroom:
 * create videos from a prompt (script → stock footage → voiceover → captions → graphics),
 * transcribe, auto clean-up, transcript-edit, composite graphics overlays, check jobs, download.
 * Built on @cutroom/sdk; auth + base URL via CUTROOM_API_TOKEN / CUTROOM_API_URL.
 */

const client = new CutroomClient();

const server = new McpServer({ name: "cutroom", version: "0.0.0" });

const jobSummary = (job: Job) => ({
  jobId: job.id,
  status: job.status,
  ...(job.result ? { ...job.result, outputUrl: client.outputUrl(job.result.outputId) } : {}),
  ...(job.error ? { error: job.error } : {}),
});

const overlayElement = z.object({
  type: z.enum(["title", "lower_third", "callout", "badge"]).describe("Graphic kind."),
  text: z.string().describe("Primary text (keep short)."),
  subtitle: z.string().optional().describe("Secondary line (title / lower_third)."),
  x: z.number().optional().describe("Callout x position, 0–1 screen fraction."),
  y: z.number().optional().describe("Callout y position, 0–1 screen fraction."),
  corner: z.enum(["tl", "tr", "bl", "br"]).optional().describe("Badge corner."),
  start: z.number().describe("Start time in seconds."),
  end: z.number().describe("End time in seconds."),
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
  "cutroom_create",
  {
    description:
      "Generate a video from an idea: the AI writes a narration script, pulls Pexels stock footage matched to each scene, lays a TTS voiceover, burns word-aligned captions, and adds on-screen graphics (title, lower thirds, callouts). Give a `prompt` (the AI writes everything) or a `script` of scenes. Waits for the render and returns the output URL.",
    inputSchema: {
      prompt: z.string().optional().describe("A topic/idea — the AI writes the script and picks footage."),
      script: z
        .array(z.object({ text: z.string(), query: z.string().describe("Stock-footage search query for this scene.") }))
        .optional()
        .describe("Or supply scenes directly: [{text, query}]."),
      aspect: z.enum(["landscape", "portrait"]).optional().describe("16:9 (default) or 9:16."),
      captions: z.boolean().optional().describe("Burn word captions (default true)."),
      overlays: z.array(overlayElement).optional().describe("Explicit graphics; omit to let the AI design them."),
      autoGraphics: z.boolean().optional().describe("Let the AI design on-screen graphics (default true)."),
      source: z.enum(["stock", "generative"]).optional().describe("Footage: stock (Pexels, default) or generative (Higgsfield)."),
      videoModel: z.enum(["dop", "kling", "seedance"]).optional().describe("Higgsfield video model for the generative source."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ prompt, script, aspect, captions, overlays, autoGraphics, source, videoModel }) => {
    const job = await client.create({ prompt, script, aspect, captions, overlays, autoGraphics, source, videoModel });
    return textResult(jobSummary(await client.pollJob(job.id)));
  },
);

server.registerTool(
  "cutroom_generate_image",
  {
    description: "Generate an image from a text prompt via Higgsfield. Waits for the render and returns the output URL.",
    inputSchema: {
      prompt: z.string().describe("What to generate."),
      aspect: z.string().optional().describe('Aspect ratio, e.g. "16:9" or "9:16" (default 16:9).'),
      model: z.enum(["soul", "reve"]).optional().describe("Image model (default soul)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ prompt, aspect, model }) => {
    const job = await client.generateImage({ prompt, aspect, model });
    return textResult(jobSummary(await client.pollJob(job.id)));
  },
);

server.registerTool(
  "cutroom_generate_video",
  {
    description:
      "Generate a video via Higgsfield. With imageUrl it animates that image (image→video); otherwise it generates a base image from the prompt first (text→image→video). Waits for the render and returns the output URL.",
    inputSchema: {
      prompt: z.string().optional().describe("Motion prompt (and base-image prompt when no imageUrl)."),
      imageUrl: z.string().optional().describe("Animate this image instead of generating one."),
      model: z.enum(["dop", "kling", "seedance"]).optional().describe("Video model (default dop)."),
      aspect: z.string().optional().describe('Aspect ratio, e.g. "16:9" (default 16:9).'),
      duration: z.number().optional().describe("Clip duration in seconds (model-dependent)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ prompt, imageUrl, model, aspect, duration }) => {
    const job = await client.generateVideo({ prompt, imageUrl, model, aspect, duration });
    return textResult(jobSummary(await client.pollJob(job.id)));
  },
);

server.registerTool(
  "cutroom_overlay",
  {
    description:
      "Composite graphics overlays onto an existing video: titles, lower thirds, callouts, and corner badges, each with a time window. Waits for the render and returns the output URL.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to a local video file."),
      overlays: z.array(overlayElement).describe("Graphics elements to burn in."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ filePath, overlays }) => {
    const job = await client.overlay(filePath, overlays);
    return textResult(jobSummary(await client.pollJob(job.id)));
  },
);

server.registerTool(
  "cutroom_reframe",
  {
    description:
      "Reframe a video to a target aspect ratio — make it vertical 9:16 (portrait, default), square 1:1, or 16:9 (landscape). mode 'blur' (default) fits the video over a blurred zoomed copy of itself (the popular social style); mode 'crop' covers the frame and center-crops the edges. Waits for the render and returns the output URL.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to a local video file (mp4/mov)."),
      aspect: z.enum(["portrait", "square", "landscape"]).optional().describe("Target aspect: portrait 9:16 (default), square 1:1, landscape 16:9."),
      mode: z.enum(["blur", "crop"]).optional().describe("Fit mode: blur (fit over blurred background, default) or crop (cover + center-crop)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ filePath, aspect, mode }) => {
    const job = await client.reframe(filePath, { aspect, mode });
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
