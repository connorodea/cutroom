import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { CUTROOM_AGENT_ID } from "@cutroom/core";
import { generatePlan } from "./agent";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, agent: CUTROOM_AGENT_ID }));

/** Produce an edit plan for the ⌘K palette by running the Cutroom Agent. */
app.post("/api/agent/plan", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const result = await generatePlan(prompt);
  return c.json(result);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[cutroom] agent server listening on :${port}`);
