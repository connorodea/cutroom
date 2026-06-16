import { describe, expect, it } from "vitest";
import { baseEditSteps } from "@cutroom/core";
import { extractPlan } from "./agent";

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
