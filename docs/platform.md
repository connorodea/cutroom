# Cutroom platform — SDK · CLI · MCP

Cutroom is programmable. Three layers, all on top of the worker API:

```
@cutroom/sdk   — the harness (CutroomClient): used by the CLI, the MCP server, and any agent code
cutroom (CLI)  — terminal access, uses an API token
cutroom-mcp    — MCP server: external AI agents drive Cutroom as tools
```

## Auth

- `CUTROOM_API_URL` — API base (default: the hosted Railway worker).
- `CUTROOM_API_TOKEN` — sent as `Authorization: Bearer`. The worker only **enforces** a token when `CUTROOM_API_TOKEN` is set on the worker itself (opt-in); the public demo runs open.

## SDK (`@cutroom/sdk`)

```ts
import { CutroomClient } from "@cutroom/sdk";
const cutroom = new CutroomClient({ token: process.env.CUTROOM_API_TOKEN });

const job = await cutroom.cleanUp("/path/clip.mp4", { captions: true });
const done = await cutroom.pollJob(job.id);
await cutroom.downloadOutput(done.result!.outputId, "out.mp4");

// transcript-driven (Descript-style)
const t = await cutroom.transcribe("/path/clip.mp4");
const cut = await cutroom.pollJob((await cutroom.transcriptCut(t.sourceId, [3, 4, 5])).id);
```

## CLI (`cutroom`)

```bash
pnpm --filter @cutroom/cli build      # → apps/cli/dist/index.mjs (bin: cutroom)

cutroom health
cutroom clean-up clip.mp4 --out out.mp4         # cut silences/filler + captions
cutroom transcribe clip.mp4                      # word-level transcript (+ sourceId)
cutroom transcript-cut <sourceId> 3,4,5 --out out.mp4
cutroom status <jobId>
cutroom download <outputId> out.mp4
```

## MCP server (`cutroom-mcp`)

Exposes six tools to any MCP-capable agent: `cutroom_health`, `cutroom_clean_up`,
`cutroom_transcribe`, `cutroom_transcript_cut`, `cutroom_get_job`, `cutroom_download`.

```bash
pnpm --filter @cutroom/mcp build      # → apps/mcp/dist/index.mjs (bin: cutroom-mcp, stdio)
```

Add to an MCP client (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cutroom": {
      "command": "node",
      "args": ["/Users/connorodea/Developer/cutroom/apps/mcp/dist/index.mjs"],
      "env": {
        "CUTROOM_API_URL": "https://cutroom-worker-production-74b1.up.railway.app",
        "CUTROOM_API_TOKEN": ""
      }
    }
  }
}
```

An agent can then: transcribe a clip → reason over the words → call `cutroom_transcript_cut`
with the indices to remove → get back a finished, downloadable MP4.
