import { afterEach, describe, expect, it, vi } from "vitest";
import { baseEditSteps } from "@cutroom/core";
import { agentKeyPresent, extractPlan, generatePlan } from "./agent";

describe("extractPlan", () => {
  it("parses and validates a clean JSON plan", () => {
    const text = JSON.stringify({
      title: "Vertical reel",
      steps: [{ label: "Removing silences", tool: "edit", result: "14 cuts" }],
    });
    const plan = extractPlan(text, "fallback title");
    expect(plan?.title).toBe("Vertical reel");
    expect(plan?.steps).toHaveLength(1);
  });

  it("extracts JSON embedded in surrounding prose", () => {
    const text = `Here is the plan:\n{"title":"X","steps":[{"label":"Reframe","tool":"reframe","result":"9:16"}]}\nDone.`;
    expect(extractPlan(text, "fallback")?.steps[0].tool).toBe("reframe");
  });

  it("backfills a missing title from the fallback", () => {
    const text = `{"steps":[{"label":"Color match","tool":"color","result":"applied"}]}`;
    expect(extractPlan(text, "My request")?.title).toBe("My request");
  });

  it("returns null for non-JSON so the caller can fall back", () => {
    expect(extractPlan("no json here", "t")).toBeNull();
  });

  it("returns null when the JSON fails schema validation", () => {
    const text = JSON.stringify({ title: "Bad", steps: [{ label: "x", tool: "edit" }] });
    expect(extractPlan(text, "t")).toBeNull();
  });

  it("exposes a canonical 7-step base pipeline for the fallback", () => {
    expect(baseEditSteps).toHaveLength(7);
  });
});

describe("agentKeyPresent", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reflects whether ANTHROPIC_API_KEY is configured", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    expect(agentKeyPresent()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(agentKeyPresent()).toBe(false);
  });
});

describe("generatePlan (keyless fallback)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("degrades to the base pipeline when no API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await generatePlan("trim my video");
    expect(r.source).toBe("fallback");
    expect(r.plan.title).toBe("trim my video");
    expect(r.plan.steps).toEqual(baseEditSteps);
  });

  it("uses 'Custom workflow' as the fallback title for a blank prompt", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await generatePlan("   ")).plan.title).toBe("Custom workflow");
  });
});
