import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPlan } from "./agentClient";
import { baseEditSteps } from "@cutroom/core";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchPlan", () => {
  it("posts the prompt and returns the parsed agent plan", async () => {
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "My plan", steps: baseEditSteps }, source: "agent" }));
    const out = await fetchPlan("make a reel");
    expect(out.source).toBe("agent");
    expect(out.plan.title).toBe("My plan");
    expect(out.plan.steps).toHaveLength(baseEditSteps.length);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/agent/plan");
    expect(JSON.parse(init.body as string)).toEqual({ prompt: "make a reel" });
  });

  it("treats a non-agent source as fallback", async () => {
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "P", steps: baseEditSteps }, source: "whatever" }));
    expect((await fetchPlan("x")).source).toBe("fallback");
  });

  it("degrades to the base pipeline on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    const out = await fetchPlan("trim my video");
    expect(out.source).toBe("fallback");
    expect(out.plan.title).toBe("trim my video");
    expect(out.plan.steps).toEqual(baseEditSteps);
  });

  it("degrades to fallback when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect((await fetchPlan("hi")).source).toBe("fallback");
  });

  it("degrades to fallback when the plan fails schema validation", async () => {
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "no steps" }, source: "agent" }));
    expect((await fetchPlan("hi")).source).toBe("fallback");
  });

  it("uses 'Custom workflow' as the fallback title for a blank prompt", async () => {
    fetchMock.mockRejectedValueOnce(new Error("x"));
    expect((await fetchPlan("   ")).plan.title).toBe("Custom workflow");
  });
});
