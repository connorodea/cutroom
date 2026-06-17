import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  submitCreateJob,
  submitImageGenJob,
  submitVideoGenJob,
  submitEditJob,
  submitOverlayJob,
  submitCaptionsJob,
  submitTranscriptCut,
  submitHighlightsJob,
  submitReframeJob,
  transcribeVideo,
  getJob,
  pollJob,
  outputUrl,
} from "./workerClient";

/** Minimal Response-like for the fetch stub. */
function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { ok, status, json: async () => data, text: async () => text } as unknown as Response;
}

const BASE = outputUrl("").replace(/\/api\/media\/$/, "");
let fetchMock: ReturnType<typeof vi.fn>;
const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined];
const sampleFile = () => new File(["data"], "clip.mp4", { type: "video/mp4" });

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(res({ id: "j", type: "create", status: "queued" }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("outputUrl", () => {
  it("builds the media URL", () => {
    expect(outputUrl("abc")).toBe(`${BASE}/api/media/abc`);
  });
});

describe("JSON submit endpoints", () => {
  it("submitCreateJob POSTs /api/create with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "c1", type: "create", status: "queued" }));
    const job = await submitCreateJob({ prompt: "teaser", aspect: "portrait" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/create`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ prompt: "teaser", aspect: "portrait" });
    expect(job.id).toBe("c1");
  });

  it("submitCreateJob surfaces the server error message", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "boom" }, { ok: false, status: 400 }));
    await expect(submitCreateJob({ prompt: "x" })).rejects.toThrow("boom");
  });

  it("submitImageGenJob POSTs /api/generate/image", async () => {
    await submitImageGenJob({ prompt: "ocean" });
    expect(lastCall()[0]).toBe(`${BASE}/api/generate/image`);
  });

  it("submitVideoGenJob POSTs /api/generate/video", async () => {
    await submitVideoGenJob({ prompt: "city" });
    expect(lastCall()[0]).toBe(`${BASE}/api/generate/video`);
  });

  it("submitVideoGenJob falls back to a generic error when the body has none", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    await expect(submitVideoGenJob({ prompt: "x" })).rejects.toThrow(/video generation failed \(500\)/);
  });

  it("submitHighlightsJob POSTs the sourceId and clip count", async () => {
    await submitHighlightsJob("src-7", 4);
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/jobs/highlights`);
    expect(JSON.parse(init?.body as string)).toEqual({ sourceId: "src-7", count: 4 });
  });

  it("submitHighlightsJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "no highlights" }, { ok: false, status: 400 }));
    await expect(submitHighlightsJob("src-7")).rejects.toThrow("no highlights");
  });

  it("submitTranscriptCut POSTs the sourceId, indices and captions flag", async () => {
    await submitTranscriptCut("src-9", [1, 4], false);
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/jobs/transcript-cut`);
    expect(JSON.parse(init?.body as string)).toEqual({ sourceId: "src-9", removedIndices: [1, 4], captions: false });
  });
});

describe("multipart submit endpoints", () => {
  it("submitEditJob POSTs a form with the file and defaults captions true", async () => {
    await submitEditJob(sampleFile());
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/jobs`);
    expect(init?.body).toBeInstanceOf(FormData);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("captions")).toBe("true");
  });

  it("submitEditJob honors captions=false", async () => {
    await submitEditJob(sampleFile(), { captions: false });
    expect((lastCall()[1]?.body as FormData).get("captions")).toBe("false");
  });

  it("submitEditJob throws on a failed upload", async () => {
    fetchMock.mockResolvedValueOnce(res("", { ok: false, status: 413 }));
    await expect(submitEditJob(sampleFile())).rejects.toThrow(/upload failed \(413\)/);
  });

  it("submitCaptionsJob POSTs the file to /api/captions", async () => {
    await submitCaptionsJob(sampleFile());
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/captions`);
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("submitCaptionsJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "captions boom" }, { ok: false, status: 400 }));
    await expect(submitCaptionsJob(sampleFile())).rejects.toThrow("captions boom");
  });

  it("submitOverlayJob POSTs the file plus a JSON overlays field", async () => {
    await submitOverlayJob(sampleFile(), [{ type: "title", text: "Hi", start: 0, end: 2 }]);
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/overlay`);
    expect(JSON.parse((init?.body as FormData).get("overlays") as string)).toEqual([
      { type: "title", text: "Hi", start: 0, end: 2 },
    ]);
  });

  it("submitReframeJob POSTs the file with aspect and mode", async () => {
    await submitReframeJob(sampleFile(), { aspect: "landscape", mode: "crop" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/reframe`);
    const fd = init?.body as FormData;
    expect(fd.get("aspect")).toBe("landscape");
    expect(fd.get("mode")).toBe("crop");
  });

  it("submitReframeJob defaults aspect=portrait mode=blur", async () => {
    await submitReframeJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("aspect")).toBe("portrait");
    expect(fd.get("mode")).toBe("blur");
  });

  it("submitReframeJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "reframe boom" }, { ok: false, status: 400 }));
    await expect(submitReframeJob(sampleFile())).rejects.toThrow("reframe boom");
  });

  it("submitOverlayJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "overlay boom" }, { ok: false, status: 400 }));
    await expect(submitOverlayJob(sampleFile(), [])).rejects.toThrow("overlay boom");
  });

  it("transcribeVideo POSTs the file and returns the transcript", async () => {
    fetchMock.mockResolvedValueOnce(res({ sourceId: "s1", duration: 3, words: [{ word: "hi", start: 0, end: 1 }] }));
    const t = await transcribeVideo(sampleFile());
    expect(lastCall()[0]).toBe(`${BASE}/api/transcribe`);
    expect(t.sourceId).toBe("s1");
    expect(t.words).toHaveLength(1);
  });
});

describe("getJob + pollJob", () => {
  it("getJob GETs /api/jobs/:id", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "g1", status: "done" }));
    const job = await getJob("g1");
    expect(lastCall()[0]).toBe(`${BASE}/api/jobs/g1`);
    expect(job.status).toBe("done");
  });

  it("getJob throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(res("", { ok: false, status: 404 }));
    await expect(getJob("missing")).rejects.toThrow(/job missing \(404\)/);
  });

  it("pollJob resolves once the job is terminal", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "p", status: "running" }))
      .mockResolvedValueOnce(res({ id: "p", status: "done", result: { outputId: "p" } }));
    const job = await pollJob("p", 0);
    expect(job.status).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
