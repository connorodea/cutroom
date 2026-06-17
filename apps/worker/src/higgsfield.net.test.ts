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

  it("downloadTo writes the fetched bytes to disk", async () => {
    fetchMock.mockResolvedValueOnce(res("VIDEOBYTES"));
    const dest = join(tmpdir(), `hf-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    await downloadTo("https://x/v.mp4", dest);
    expect(await readFile(dest, "utf8")).toBe("VIDEOBYTES");
    await rm(dest, { force: true });
  });
});
