import { agentPlanSchema, baseEditSteps, type AgentPlan } from "@cutroom/core";

export interface PlanResponse {
  plan: AgentPlan;
  source: "agent" | "fallback";
}

/**
 * Fetch an edit plan from the agent server. Always resolves to a playable plan —
 * any network/validation failure degrades to the canonical base pipeline so the
 * palette never dead-ends.
 */
export async function fetchPlan(prompt: string, signal?: AbortSignal): Promise<PlanResponse> {
  const fallback: PlanResponse = {
    plan: { title: prompt.trim() || "Custom workflow", steps: baseEditSteps },
    source: "fallback",
  };
  try {
    const res = await fetch("/api/agent/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { plan?: unknown; source?: unknown };
    const plan = agentPlanSchema.parse(data.plan);
    return { plan, source: data.source === "agent" ? "agent" : "fallback" };
  } catch {
    return fallback;
  }
}
