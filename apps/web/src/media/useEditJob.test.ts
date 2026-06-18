import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditJob } from "./useEditJob";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const file = () => new File(["v"], "clip.mp4", { type: "video/mp4" });

describe("useEditJob", () => {
  it("uploads and completes when the job is already done", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "j", status: "done", result: { outputId: "j" } }));
    const { result } = renderHook(() => useEditJob());
    await act(async () => {
      await result.current.run(file());
    });
    expect(result.current.phase).toBe("done");
    expect(result.current.job?.result?.outputId).toBe("j");
  });

  it("polls until the job reaches a terminal state", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(res({ id: "j", status: "running" }))
      .mockResolvedValueOnce(res({ id: "j", status: "done", result: { outputId: "j" } }));
    const { result } = renderHook(() => useEditJob());
    let p: Promise<void>;
    await act(async () => {
      p = result.current.run(file());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      await p;
    });
    expect(result.current.phase).toBe("done");
    vi.useRealTimers();
  });

  it("enters the error phase when the job finishes with an error status", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "j", status: "error", error: "render failed" }));
    const { result } = renderHook(() => useEditJob());
    await act(async () => {
      await result.current.run(file());
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("render failed");
  });

  it("falls back to a generic message when the error status carries no message", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "j", status: "error" }));
    const { result } = renderHook(() => useEditJob());
    await act(async () => {
      await result.current.run(file());
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("the edit failed");
  });

  it("aborts after submit when reset() is called mid-upload", async () => {
    let resolveSubmit: (v: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { resolveSubmit = r; }));
    const { result } = renderHook(() => useEditJob());
    let p: Promise<void>;
    act(() => { p = result.current.run(file()); });
    expect(result.current.phase).toBe("uploading");
    act(() => result.current.reset());
    await act(async () => { resolveSubmit(res({ id: "j", status: "queued" })); await p; });
    // The post-submit cancellation guard short-circuits: no job is recorded, phase stays idle.
    expect(result.current.phase).toBe("idle");
    expect(result.current.job).toBeNull();
  });

  it("aborts mid-poll when reset() is called during the poll wait", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(res({ id: "j", status: "running" }));
    const { result } = renderHook(() => useEditJob());
    let p: Promise<void>;
    await act(async () => { p = result.current.run(file()); });
    expect(result.current.phase).toBe("running");
    act(() => result.current.reset());
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); await p; });
    // The in-loop cancellation guard returns before re-polling; only the submit was fetched.
    expect(result.current.phase).toBe("idle");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("swallows a post-cancel upload error instead of surfacing it", async () => {
    let rejectSubmit: (e: Error) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((_, rej) => { rejectSubmit = rej; }));
    const { result } = renderHook(() => useEditJob());
    let p: Promise<void>;
    act(() => { p = result.current.run(file()); });
    act(() => result.current.reset());
    await act(async () => { rejectSubmit(new Error("boom")); await p; });
    // Cancelled before the throw was handled: stay idle, no error surfaced.
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("enters the error phase when the upload fails", async () => {
    fetchMock.mockResolvedValueOnce(res("", { ok: false, status: 413 }));
    const { result } = renderHook(() => useEditJob());
    await act(async () => {
      await result.current.run(file());
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toMatch(/upload failed/);
  });

  it("reset returns to idle and clears the job", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "j", status: "done", result: { outputId: "j" } }));
    const { result } = renderHook(() => useEditJob());
    await act(async () => {
      await result.current.run(file());
    });
    act(() => result.current.reset());
    expect(result.current.phase).toBe("idle");
    expect(result.current.job).toBeNull();
  });
});
