import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentRun } from "./useAgentRun";
import { useEditorStore } from "../editor/store";
import { baseEditSteps } from "@cutroom/core";

function res(data: unknown, { ok = true }: { ok?: boolean } = {}): Response {
  return { ok, status: 200, json: async () => data } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => useEditorStore.setState(useEditorStore.getInitialState(), true));
});

describe("useAgentRun", () => {
  it("fetches a plan and starts the run with its steps", async () => {
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "Reel", steps: baseEditSteps }, source: "agent" }));
    const { result } = renderHook(() => useAgentRun());
    await act(async () => {
      await result.current.run("make a reel");
    });
    expect(result.current.source).toBe("agent");
    expect(result.current.loading).toBe(false);
    const s = useEditorStore.getState();
    expect(s.phase).toBe("running");
    expect(s.title).toBe("Reel");
    expect(s.steps).toHaveLength(baseEditSteps.length);
  });

  it("falls back to the base pipeline when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useAgentRun());
    await act(async () => {
      await result.current.run("trim it");
    });
    expect(result.current.source).toBe("fallback");
    expect(useEditorStore.getState().title).toBe("trim it");
  });

  it("advances the run's steps on a cadence while running", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "P", steps: baseEditSteps }, source: "agent" }));
    const { result } = renderHook(() => useAgentRun());
    await act(async () => {
      await result.current.run("go");
    });
    expect(useEditorStore.getState().active).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(760);
    });
    expect(useEditorStore.getState().active).toBe(1);
    vi.useRealTimers();
  });
});
