# Anthropic Managed Agents — research & implementation notes

**For:** Cutroom's ⌘K AI Agent server (`apps/server`).
**Date:** 2026-06-16. **Sources:** Anthropic `claude-api` skill (cached 2026-04-15) + `platform.claude.com/docs/en/managed-agents/*`.

## TL;DR for Cutroom

We already have a **published agent**: `agent_01NCvSDKu8D2zzCEZ4PHSEuX` (`Cutroom Agent`, model `claude-sonnet-4-6`).
The server does **not** create an agent at runtime — it references that ID. Per request it: creates a **session**
(pointing at the agent + a reusable **environment**) → sends the user's prompt as a `user.message` → streams events
until the session goes **idle** → extracts a structured `AgentPlan` → validates with `agentPlanSchema` → falls back to
`baseEditSteps` on any error. The plan drives the palette's animated run.

## What Managed Agents is

A **first-party, beta** surface (beta header `managed-agents-2026-04-01`, set automatically by the SDK). It is the
right tier when you want **Anthropic to run the agent loop and host a per-session container** where the agent's tools
(bash, file ops, code execution) run. Not available on Bedrock / Vertex / Foundry (use Messages API + tool use there).

**Three objects:**
- **Agent** — a *persisted, versioned* config. `model`, `system`, `tools`, `mcp_servers`, `skills` live here. Created
  **once**; every update bumps an immutable version.
- **Environment** — a cloud workspace config (`config.type: "cloud"`). Created once, reused across sessions.
- **Session** — one run. References an agent (by ID or `{type:"agent", id, version}`) + an `environment_id`. Streams
  events; you send `user.message` / tool results in.

### ⚠️ The mandatory flow: Agent (once) → Session (every run)

The session's `agent` field takes **only** a pointer — never `model`/`system`/`tools`. Calling `agents.create()` in the
request path accumulates orphaned agents and pays create latency for nothing. Create the agent in setup (console, CLI,
or a guarded script), store the ID, and reference it. To change behavior: `POST /v1/agents/{id}` (new version) — don't
re-create.

## Implementation — TypeScript (`@anthropic-ai/sdk`)

This is the path Cutroom's Hono server uses.

```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic(); // ANTHROPIC_API_KEY from env

// --- setup, once: reuse across requests (store env id in config) ---
const environment = await client.beta.environments.create({
  name: "cutroom-agent",
  config: { type: "cloud", networking: { type: "unrestricted" } },
});

// --- per request ---
const AGENT_ID = "agent_01NCvSDKu8D2zzCEZ4PHSEuX";

const session = await client.beta.sessions.create({
  agent: AGENT_ID, // string shorthand = latest version
  environment_id: environment.id,
  title: "Edit plan",
});

// Stream-first: open the stream, then send the message concurrently.
const stream = await client.beta.sessions.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{ type: "user.message", content: [{ type: "text", text: prompt }] }],
});

let text = "";
for await (const event of stream) {
  if (event.type === "agent.message") {
    for (const block of event.content) if (block.type === "text") text += block.text;
  } else if (
    event.type === "session.status_idle" &&
    event.stop_reason?.type !== "requires_action" // the correct idle gate
  ) {
    break;
  } else if (event.type === "session.status_terminated") {
    break;
  }
}
// `text` now holds the agent's final output -> extract + validate JSON plan.
```

## Implementation — Python (`anthropic`)

```python
import anthropic
client = anthropic.Anthropic()  # ANTHROPIC_API_KEY from env

# setup, once
environment = client.beta.environments.create(
    name="cutroom-agent",
    config={"type": "cloud", "networking": {"type": "unrestricted"}},
)

# per request
AGENT_ID = "agent_01NCvSDKu8D2zzCEZ4PHSEuX"
session = client.beta.sessions.create(agent=AGENT_ID, environment_id=environment.id)

text = ""
with client.beta.sessions.stream(session_id=session.id) as stream:
    client.beta.sessions.events.send(
        session_id=session.id,
        events=[{"type": "user.message", "content": [{"type": "text", "text": prompt}]}],
    )
    for event in stream:
        if event.type == "agent.message":
            for block in event.content:
                if block.type == "text":
                    text += block.text
        elif event.type == "session.status_idle" and getattr(event, "stop_reason", None) and event.stop_reason.type != "requires_action":
            break
        elif event.type == "session.status_terminated":
            break
```

## Getting *structured* output (a validated `AgentPlan`)

Three options, easiest → most robust:

1. **Prompt for JSON + validate (Cutroom v1).** Instruct the agent (via the `user.message`) to end its reply with a
   single fenced JSON block matching our schema; extract it, `agentPlanSchema.parse()`, fall back to `baseEditSteps` on
   failure. No agent mutation; works with the agent as-published.
2. **Custom tool `propose_edit_plan` (robust upgrade).** Add a `{type:"custom", name:"propose_edit_plan", input_schema}`
   tool to the agent (`agents.update`). The agent calls it; capture the `agent.custom_tool_use` event's `input` (already
   structured JSON), validate, then reply with `user.custom_tool_result`. Guaranteed shape, but mutates the published agent.
3. **Outcomes (`user.define_outcome` + rubric).** A grade→revise loop that produces a deliverable file. Overkill for a
   fast palette plan; reserve for "render a real artifact" tasks.

## Gotchas (from the docs)

- **Agent once, not per request.** Reference by ID; create in setup.
- **Idle gate:** break on `session.status_idle` **only when** `stop_reason?.type !== "requires_action"` — otherwise you
  cut off a turn that's waiting on a tool result.
- **Stream-first ordering:** open the stream before/concurrently with sending the message, or early events arrive in one
  buffered batch.
- **SSE has no replay.** On reconnect, also `events.list()` and dedupe by event ID, or a pending tool confirmation can
  deadlock the session.
- **HTTP timeouts are per-chunk, not wall-clock.** For a hard deadline use a monotonic loop timer; prefer the SDK stream.
- **Archive is permanent** on every resource — never archive a production agent/environment as cleanup.
- **Latency:** each session provisions a container. For a snappy ⌘K palette, keep the `baseEditSteps` fallback and a
  short server-side deadline so the UI never stalls.
- **Cost/model:** the model lives on the agent (`claude-sonnet-4-6` here) — sessions don't pass a model.

## Cutroom server design (decided)

`apps/server` (Hono, Node) exposes `POST /api/agent/plan { prompt }`:
1. Ensure an environment (created once at boot or from `CUTROOM_AGENT_ENV_ID`; cached in memory).
2. `sessions.create({ agent: CUTROOM_AGENT_ID, environment_id })`.
3. Stream-first send the prompt + a JSON-plan instruction; drain to idle with the correct gate; enforce a wall-clock deadline.
4. Extract JSON → `agentPlanSchema.parse` → return `AgentPlan`. On any error/timeout → `{ plan: baseEditSteps, source: "fallback" }`.
`ANTHROPIC_API_KEY` stays server-side. Setup script: `apps/server/scripts/setup-agent-env.ts` prints the env id for `.env`.

## Vision / image input (frame analysis)

Cutroom's "Analyzing clips" step is vision-driven: extract representative frames and let Claude reason over them. Images
are passed as **content blocks** — base64 or URL — in both the Messages API and managed-agent `user.message` events:

```python
# Messages API — base64 image block
import base64, anthropic
client = anthropic.Anthropic()
data = base64.b64encode(open("frame.jpg", "rb").read()).decode()
client.messages.create(model="claude-sonnet-4-6", max_tokens=1024, messages=[{
    "role": "user",
    "content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
        {"type": "text", "text": "Rank these keyframes by visual energy."},
    ],
}])
# URL source also works: {"type": "image", "source": {"type": "url", "url": "https://.../frame.jpg"}}
```

In a managed-agent session the same image blocks go inside a `user.message` event's `content`; alternatively, mount the
source video as a file resource and let the agent extract frames in its container (ffmpeg) before reasoning. For the
palette's plan step, pre-extracted keyframes as image blocks are the lighter path. (The 2024 tutorial uses
`claude-opus-4-1`; current models incl. `claude-sonnet-4-6` take the identical image-block shape.)

## Canonical docs (WebFetch for the latest)

- Overview — `https://platform.claude.com/docs/en/managed-agents/overview.md`
- Quickstart — `https://platform.claude.com/docs/en/managed-agents/quickstart.md`
- Sessions — `https://platform.claude.com/docs/en/managed-agents/sessions.md`
- Events & streaming — `https://platform.claude.com/docs/en/managed-agents/events-and-streaming.md`
- Tools — `https://platform.claude.com/docs/en/managed-agents/tools.md`
- Define outcomes — `https://platform.claude.com/docs/en/managed-agents/define-outcomes.md`
- Anthropic CLI (`ant`) — `https://platform.claude.com/docs/en/api/sdks/cli.md`
