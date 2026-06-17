import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateImage, imageToVideo, pollRequest, downloadTo, isConfigured } from "./higgsfield";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return {
    ok,
    status,
    json: async () => data,
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("HIGGSFIELD_API_KEY_ID", "id");
  vi.stubEnv("HIGGSFIELD_API_KEY_SECRET", "secret");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("higgsfield network", () => {
  it("isConfigured reflects whether the env keys are set", () => {
    expect(isConfigured()).toBe(true);
    vi.stubEnv("HIGGSFIELD_API_KEY_ID", "");
    expect(isConfigured()).toBe(false);
  });

  it("generateImage submits the soul model with Key auth, then polls for the image", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ request_id: "r1" }))
      .mockResolvedValueOnce(res({ status: "completed", images: [{ url: "https://x/a.png" }] }));
    const url = await generateImage("a cat", "16:9");
    expect(url).toBe("https://x/a.png");
    const [submitUrl, init] = fetchMock.mock.calls[0];
    expect(submitUrl).toBe("https://platform.higgsfield.ai/higgsfield-ai/soul/standard");
    expect((init.headers as Record<string, string>).Authorization).toBe("Key id:secret");
    expect(JSON.parse(init.body as string)).toEqual({ prompt: "a cat", aspect_ratio: "16:9", resolution: "720p" });
  });

  it("imageToVideo submits the dop model and returns the video url", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ request_id: "r2" }))
      .mockResolvedValueOnce(res({ status: "completed", video: { url: "https://x/v.mp4" } }));
    const url = await imageToVideo("https://x/i.png", "slow pan");
    expect(url).toBe("https://x/v.mp4");
    expect(fetchMock.mock.calls[0][0]).toBe("https://platform.higgsfield.ai/higgsfield-ai/dop/standard");
  });

  it("pollRequest throws when the request fails", async () => {
    fetchMock.mockResolvedValueOnce(res({ status: "failed" }));
    await expect(pollRequest("r3", { intervalMs: 0 })).rejects.toThrow(/failed/);
  });

  it("surfaces a 403 not_enough_credits from submit", async () => {
    fetchMock.mockResolvedValueOnce(res({ detail: "not_enough_credits" }, { ok: false, status: 403 }));
    await expect(generateImage("x", "16:9")).rejects.toThrow(/403: not_enough_credits/);
  });

  it("throws when the submit response carries no request_id", async () => {
    fetchMock.mockResolvedValueOnce(res({ status: "queued" })); // ok, but no request_id
    await expect(generateImage("x", "16:9")).rejects.toThrow(/no request_id/);
  });

  it("throws when a completed request returns no media", async () => {
    fetchMock.mockResolvedValueOnce(res({ status: "completed" })); // terminal, no images/video
    await expect(pollRequest("r", { intervalMs: 0 })).rejects.toThrow(/without media/);
  });

  it("falls back to an empty body and uses the raw text when the response is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(res("<<not json>>", { ok: false, status: 502 }));
    await expect(generateImage("x", "16:9")).rejects.toThrow(/502: <<not json>>/);
  });

  it("keeps polling after a non-terminal status until media appears", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ status: "in_progress" }))
      .mockResolvedValueOnce(res({ status: "completed", video: { url: "https://x/v.mp4" } }));
    expect(await pollRequest("r", { intervalMs: 0 })).toBe("https://x/v.mp4");
  });

  it("times out when the request never reaches a terminal state", async () => {
    fetchMock.mockResolvedValue(res({ status: "in_progress" }));
    await expect(pollRequest("r", { intervalMs: 0, timeoutMs: -1 })).rejects.toThrow(/timed out/);
  });

  it("downloadTo writes the fetched bytes to disk", async () => {
    fetchMock.mockResolvedValueOnce(res("VIDEOBYTES"));
    const dest = join(tmpdir(), `hf-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    await downloadTo("https://x/v.mp4", dest);
    expect(await readFile(dest, "utf8")).toBe("VIDEOBYTES");
    await rm(dest, { force: true });
  });

  it("downloadTo throws when the source responds non-ok", async () => {
    fetchMock.mockResolvedValueOnce(res("nope", { ok: false, status: 404 }));
    await expect(downloadTo("https://x/missing.mp4", "/tmp/never-written.mp4")).rejects.toThrow(/download .* failed \(404\)/);
  });

  it("throws a clear 'not configured' error when the API keys are unset", async () => {
    vi.stubEnv("HIGGSFIELD_API_KEY_ID", "");
    vi.stubEnv("HIGGSFIELD_API_KEY_SECRET", "");
    await expect(generateImage("a cat", "16:9")).rejects.toThrow(/Higgsfield not configured/);
    // The request never went out — the misconfig is caught before any fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
