import Anthropic from "@anthropic-ai/sdk";
import {
  CUTROOM_AGENT_ID,
  agentPlanSchema,
  baseEditSteps,
  type AgentPlan,
} from "@cutroom/core";

/**
 * Managed-agents integration for the ⌘K palette.
 *
 * References the published Cutroom Agent by ID, opens a session against a reusable cloud
 * environment, sends the user's prompt, drains the event stream to idle, then extracts +
 * validates a structured {@link AgentPlan}. Hardened for production: the client is created
 * lazily and fail-soft (the server boots and serves fallback plans even with no API key),
 * transient errors are retried, and any failure/timeout degrades to {@link baseEditSteps}.
 */

/** Instruction appended to the user's request to force a structured, prose-free plan. */
const PLAN_INSTRUCTION = `You are generating an edit PLAN for the Cutroom timeline — do not execute it yet.
Given the user's request, output a concise plan of 4–8 steps.
Respond with ONLY a single JSON object (no prose, no markdown fences) of exactly this shape:
{"title": string, "steps": [{"label": string, "tool": string, "result": string}]}
- "label": imperative, present-tense action (e.g. "Removing silences & filler words")
- "tool": short tag — one of vision·asr, edit, reasoning, reframe, caption, color, audio
- "result": one-line outcome summary (e.g. "14 cuts · −2:18 runtime")`;

/** Whether an Anthropic API key is configured (surfaced by /health, never the value). */
export function agentKeyPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Lazy, fail-soft client. The Anthropic constructor throws when no key resolves, so we guard
// it — a keyless server still boots and serves fallback plans instead of crashing.
let client: Anthropic | null = null;
let clientFailed = false;
function getClient(): Anthropic | null {
  if (clientFailed) return null;
  if (!client) {
    try {
      client = new Anthropic();
    } catch (err) {
      clientFailed = true;
      console.warn("[agent] ANTHROPIC_API_KEY missing/invalid — serving fallback plans:", (err as Error).message);
      return null;
    }
  }
  return client;
}

/** Lazily create (or reuse) one cloud environment for all sessions. */
let envIdPromise: Promise<string> | null = null;
function ensureEnvironmentId(c: Anthropic): Promise<string> {
  const fromEnv = process.env.CUTROOM_AGENT_ENV_ID;
  if (fromEnv) return Promise.resolve(fromEnv);
  if (!envIdPromise) {
    envIdPromise = c.beta.environments
      .create({ name: "cutroom-agent", config: { type: "cloud", networking: { type: "unrestricted" } } })
      .then((env) => env.id)
      .catch((err) => {
        envIdPromise = null; // allow retry on next request
        throw err;
      });
  }
  return envIdPromise;
}

/** Pull the first balanced JSON object out of a model response and validate it. */
export function extractPlan(text: string, fallbackTitle: string): AgentPlan | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (!raw.title) raw.title = fallbackTitle;
    return agentPlanSchema.parse(raw);
  } catch {
    return null;
  }
}

export interface PlanResult {
  plan: AgentPlan;
  /** "agent" = real plan from the Cutroom Agent; "fallback" = canonical base pipeline. */
  source: "agent" | "fallback";
}

function fallback(title: string): PlanResult {
  return { plan: { title, steps: baseEditSteps }, source: "fallback" };
}

/** Errors worth retrying — network blips, rate limits, transient upstream failures. */
const TRANSIENT = /(ECONNRESET|ETIMEDOUT|socket|network|fetch failed|overloaded|rate.?limit|\b(429|500|502|503|529)\b)/i;

/** One full attempt: session → stream → idle → extract a validated plan (throws on failure). */
async function runOnce(c: Anthropic, prompt: string, title: string): Promise<PlanResult> {
  const environmentId = await ensureEnvironmentId(c);
  const session = await c.beta.sessions.create({
    agent: CUTROOM_AGENT_ID,
    environment_id: environmentId,
    title: "Edit plan",
  });

  // Stream-first: open the stream, then send the message concurrently.
  const stream = await c.beta.sessions.events.stream(session.id);
  await c.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: `${PLAN_INSTRUCTION}\n\nRequest: ${prompt}` }] }],
  });

  let text = "";
  for await (const event of stream as AsyncIterable<any>) {
    if (event.type === "agent.message") {
      for (const block of event.content ?? []) {
        if (block.type === "text") text += block.text;
      }
    } else if (event.type === "session.status_idle" && event.stop_reason?.type !== "requires_action") {
      break;
    } else if (event.type === "session.status_terminated") {
      break;
    }
  }

  const plan = extractPlan(text, title);
  if (!plan) throw new Error("no valid plan in agent response");
  return { plan, source: "agent" };
}

export interface GeneratePlanOptions {
  /** Wall-clock cap before degrading to the fallback (default 90s). */
  deadlineMs?: number;
  /** Retries on transient errors (default 2). */
  maxRetries?: number;
}

/** Generate an edit plan for a prompt by running the published Cutroom Agent. */
export async function generatePlan(prompt: string, opts: GeneratePlanOptions = {}): Promise<PlanResult> {
  const title = prompt.trim() || "Custom workflow";
  const deadlineMs = opts.deadlineMs ?? 90_000;
  const maxRetries = opts.maxRetries ?? 2;

  const c = getClient();
  if (!c || !agentKeyPresent()) return fallback(title);

  const run = (async (): Promise<PlanResult> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await runOnce(c, prompt, title);
      } catch (err) {
        lastErr = err;
        const msg = (err as Error)?.message ?? "";
        if (attempt < maxRetries && TRANSIENT.test(msg)) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
    console.error("[agent] plan generation failed; using fallback:", lastErr);
    return fallback(title);
  })();

  const timeout = new Promise<PlanResult>((resolve) =>
    setTimeout(() => resolve(fallback(title)), deadlineMs),
  );

  return Promise.race([run, timeout]);
}
