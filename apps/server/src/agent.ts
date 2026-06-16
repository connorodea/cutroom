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
 * We reference the published Cutroom Agent by ID (never create one in the request path),
 * open a session against a reusable cloud environment, send the user's prompt, drain the
 * event stream to idle, then extract + validate a structured {@link AgentPlan}. Any error or
 * timeout degrades gracefully to the canonical {@link baseEditSteps} so the UI never stalls.
 */

const client = new Anthropic(); // ANTHROPIC_API_KEY from env (server-side only)

/** Instruction appended to the user's request to force a structured, prose-free plan. */
const PLAN_INSTRUCTION = `You are generating an edit PLAN for the Cutroom timeline — do not execute it yet.
Given the user's request, output a concise plan of 4–8 steps.
Respond with ONLY a single JSON object (no prose, no markdown fences) of exactly this shape:
{"title": string, "steps": [{"label": string, "tool": string, "result": string}]}
- "label": imperative, present-tense action (e.g. "Removing silences & filler words")
- "tool": short tag — one of vision·asr, edit, reasoning, reframe, caption, color, audio
- "result": one-line outcome summary (e.g. "14 cuts · −2:18 runtime")`;

/** Lazily create (or reuse) one cloud environment for all sessions. */
let envIdPromise: Promise<string> | null = null;
function ensureEnvironmentId(): Promise<string> {
  const fromEnv = process.env.CUTROOM_AGENT_ENV_ID;
  if (fromEnv) return Promise.resolve(fromEnv);
  if (!envIdPromise) {
    envIdPromise = client.beta.environments
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

/** Generate an edit plan for a prompt by running the published Cutroom Agent. */
export async function generatePlan(
  prompt: string,
  opts: { deadlineMs?: number } = {},
): Promise<PlanResult> {
  const title = prompt.trim() || "Custom workflow";
  const deadlineMs = opts.deadlineMs ?? 90_000;

  const run = (async (): Promise<PlanResult> => {
    const environmentId = await ensureEnvironmentId();
    const session = await client.beta.sessions.create({
      agent: CUTROOM_AGENT_ID,
      environment_id: environmentId,
      title: "Edit plan",
    });

    // Stream-first: open the stream, then send the message concurrently.
    const stream = await client.beta.sessions.events.stream(session.id);
    await client.beta.sessions.events.send(session.id, {
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
    return plan ? { plan, source: "agent" } : fallback(title);
  })();

  const timeout = new Promise<PlanResult>((resolve) =>
    setTimeout(() => resolve(fallback(title)), deadlineMs),
  );

  try {
    return await Promise.race([run, timeout]);
  } catch (err) {
    console.error("[agent] plan generation failed; using fallback:", err);
    return fallback(title);
  }
}
