import { describe, expect, it } from "vitest";
import { agentPlanSchema, baseEditSteps, agentWorkflows } from "./agentPlan";

describe("agentPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    const plan = { title: "Make a 60s vertical reel", steps: baseEditSteps };
    expect(agentPlanSchema.parse(plan).steps).toHaveLength(7);
  });

  it("rejects a plan with no steps", () => {
    expect(() => agentPlanSchema.parse({ title: "Empty", steps: [] })).toThrow();
  });

  it("rejects a step missing a result", () => {
    expect(() =>
      agentPlanSchema.parse({ title: "Bad", steps: [{ label: "x", tool: "edit" }] }),
    ).toThrow();
  });
});

describe("preset workflows", () => {
  it("exposes four composer presets", () => {
    expect(agentWorkflows).toHaveLength(4);
    for (const w of agentWorkflows) {
      expect(w.title.length).toBeGreaterThan(0);
      expect(w.icon.length).toBeGreaterThan(0);
    }
  });
});
