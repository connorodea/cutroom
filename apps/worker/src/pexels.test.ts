import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findClipUrl } from "./pexels";

function res(data: unknown, { ok = true }: { ok?: boolean } = {}): Response {
  return { ok, status: 200, json: async () => data } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("PEXELS_API_KEY", "key");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("findClipUrl", () => {
  it("returns null when no API key is configured", async () => {
    vi.stubEnv("PEXELS_API_KEY", "");
    expect(await findClipUrl("ocean")).toBeNull();
  });

  it("queries Pexels and returns the mp4 link closest to 1280px wide", async () => {
    fetchMock.mockResolvedValueOnce(
      res({
        videos: [
          {
            video_files: [
              { link: "https://x/sd.mp4", file_type: "video/mp4", width: 640, height: 360 },
              { link: "https://x/hd.mp4", file_type: "video/mp4", width: 1280, height: 720 },
            ],
          },
        ],
      }),
    );
    const url = await findClipUrl("ocean waves", "landscape");
    expect(url).toBe("https://x/hd.mp4");
    const [reqUrl, init] = fetchMock.mock.calls[0];
    expect(reqUrl).toContain("api.pexels.com/videos/search");
    expect(reqUrl).toContain("query=ocean%20waves");
    expect(reqUrl).toContain("orientation=landscape");
    expect((init.headers as Record<string, string>).Authorization).toBe("key");
  });

  it("returns null on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false }));
    expect(await findClipUrl("x")).toBeNull();
  });

  it("returns null when no video has an mp4 file", async () => {
    fetchMock.mockResolvedValueOnce(res({ videos: [{ video_files: [{ link: "x", file_type: "video/webm", width: 1280 }] }] }));
    expect(await findClipUrl("x")).toBeNull();
  });
});
