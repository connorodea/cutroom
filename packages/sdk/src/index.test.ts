import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CutroomClient, DEFAULT_BASE_URL } from "./index";

/** Build a minimal Response-like object for the fetch stub. */
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
let tmpFile: string;

beforeEach(async () => {
  // Deterministic: no ambient env baseUrl/token leaking in.
  vi.stubEnv("CUTROOM_API_URL", "");
  vi.stubEnv("CUTROOM_API_TOKEN", "");
  fetchMock = vi.fn().mockResolvedValue(res({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  tmpFile = join(tmpdir(), `sdk-test-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
  await writeFile(tmpFile, Buffer.from("fake-video-bytes"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(tmpFile, { force: true });
});

const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined];
const headersOf = (init?: RequestInit) => (init?.headers ?? {}) as Record<string, string>;

describe("CutroomClient constructor", () => {
  it("defaults to the hosted worker base URL", () => {
    expect(new CutroomClient().baseUrl).toBe(DEFAULT_BASE_URL);
  });

  it("uses an explicit base URL and strips a trailing slash", () => {
    expect(new CutroomClient({ baseUrl: "http://x.test/" }).baseUrl).toBe("http://x.test");
  });

  it("reads the base URL from $CUTROOM_API_URL", () => {
    vi.stubEnv("CUTROOM_API_URL", "http://env.test");
    expect(new CutroomClient().baseUrl).toBe("http://env.test");
  });
});

describe("auth headers", () => {
  it("sends Authorization: Bearer when a token is set", async () => {
    await new CutroomClient({ baseUrl: "http://x", token: "secret" }).health();
    expect(headersOf(lastCall()[1]).Authorization).toBe("Bearer secret");
  });

  it("omits Authorization when no token is set", async () => {
    await new CutroomClient({ baseUrl: "http://x" }).health();
    expect(headersOf(lastCall()[1]).Authorization).toBeUndefined();
  });
});

describe("outputUrl", () => {
  it("builds the media URL for an output id", () => {
    expect(new CutroomClient({ baseUrl: "http://x" }).outputUrl("abc")).toBe("http://x/api/media/abc");
  });
});

describe("JSON endpoints", () => {
  const client = () => new CutroomClient({ baseUrl: "http://x" });

  it("health GETs /api/worker/health and returns the parsed body", async () => {
    fetchMock.mockResolvedValueOnce(res({ ok: true, keyPresent: true }));
    const out = await client().health();
    expect(lastCall()[0]).toBe("http://x/api/worker/health");
    expect(out).toEqual({ ok: true, keyPresent: true });
  });

  it("create POSTs /api/create with a JSON body and content-type", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "j1", type: "create", status: "queued" }));
    const job = await client().create({ prompt: "a teaser" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/create");
    expect(init?.method).toBe("POST");
    expect(headersOf(init)["content-type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ prompt: "a teaser" });
    expect(job.id).toBe("j1");
  });

  it("generateImage POSTs /api/generate/image", async () => {
    await client().generateImage({ prompt: "ocean" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/generate/image");
    expect(JSON.parse(init?.body as string)).toEqual({ prompt: "ocean" });
  });

  it("generateVideo POSTs /api/generate/video", async () => {
    await client().generateVideo({ prompt: "pan over a city" });
    expect(lastCall()[0]).toBe("http://x/api/generate/video");
  });

  it("transcriptCut POSTs the indices and defaults captions to true", async () => {
    await client().transcriptCut("src-1", [2, 5]);
    const body = JSON.parse(lastCall()[1]?.body as string);
    expect(body).toEqual({ sourceId: "src-1", removedIndices: [2, 5], captions: true });
  });

  it("getJob GETs /api/jobs/:id", async () => {
    fetchMock.mockResolvedValueOnce(res({ id: "j9", status: "done" }));
    await client().getJob("j9");
    expect(lastCall()[0]).toBe("http://x/api/jobs/j9");
  });

  it("chain POSTs the outputId, op and options", async () => {
    await client().chain("out-1", "reframe", { aspect: "portrait", mode: "blur" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/chain");
    expect(JSON.parse(init?.body as string)).toEqual({ outputId: "out-1", op: "reframe", aspect: "portrait", mode: "blur" });
  });

  it("chain supports the speed and color ops", async () => {
    await client().chain("out-1", "speed", { factor: 2 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-1", op: "speed", factor: 2 });
    await client().chain("out-2", "color", { preset: "vivid" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-2", op: "color", preset: "vivid" });
  });

  it("highlights POSTs the sourceId and clip count", async () => {
    await client().highlights("src-1", { count: 5 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/jobs/highlights");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ sourceId: "src-1", count: 5 });
  });
});

describe("multipart endpoints", () => {
  const client = () => new CutroomClient({ baseUrl: "http://x" });

  it("cleanUp POSTs a multipart form with the file and captions flag", async () => {
    await client().cleanUp(tmpFile, { captions: false });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/jobs");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("captions")).toBe("false");
  });

  it("captions POSTs the file with the caption position", async () => {
    await client().captions(tmpFile, { position: "top" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/captions");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("position")).toBe("top");
  });

  it("speed POSTs the file with the factor", async () => {
    await client().speed(tmpFile, { factor: 4 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/speed");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("factor")).toBe("4");
  });

  it("speed defaults the factor to 2", async () => {
    await client().speed(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("factor")).toBe("2");
  });

  it("color POSTs the file with the preset and only the provided overrides", async () => {
    await client().color(tmpFile, { preset: "vivid", saturation: 1.4 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/color");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("preset")).toBe("vivid");
    expect(fd.get("saturation")).toBe("1.4");
    expect(fd.get("brightness")).toBeNull();
  });

  it("rotate POSTs the file with the orientation", async () => {
    await client().rotate(tmpFile, { orientation: "ccw" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/rotate");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("orientation")).toBe("ccw");
  });

  it("rotate defaults the orientation to cw", async () => {
    await client().rotate(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("orientation")).toBe("cw");
  });

  it("trim POSTs the file with the start/end window", async () => {
    await client().trim(tmpFile, { start: 5, end: 12 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/trim");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("start")).toBe("5");
    expect(fd.get("end")).toBe("12");
  });

  it("trim defaults start to 0 and leaves end open", async () => {
    await client().trim(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("start")).toBe("0");
    expect(fd.get("end")).toBe("");
  });

  it("transcribe POSTs the file to /api/transcribe", async () => {
    await client().transcribe(tmpFile);
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/transcribe");
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("overlay POSTs the file plus a JSON overlays field", async () => {
    await client().overlay(tmpFile, [{ type: "title", text: "Hi", start: 0, end: 2 }]);
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/overlay");
    expect(JSON.parse((init?.body as FormData).get("overlays") as string)).toEqual([
      { type: "title", text: "Hi", start: 0, end: 2 },
    ]);
  });

  it("reframe POSTs the file and defaults aspect=portrait mode=blur", async () => {
    await client().reframe(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(lastCall()[0]).toBe("http://x/api/reframe");
    expect(fd.get("aspect")).toBe("portrait");
    expect(fd.get("mode")).toBe("blur");
  });
});

describe("response handling", () => {
  it("throws a descriptive error on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(res("not_enough_credits", { ok: false, status: 403 }));
    await expect(new CutroomClient({ baseUrl: "http://x" }).create({ prompt: "x" })).rejects.toThrow(
      /Cutroom API 403: not_enough_credits/,
    );
  });
});

describe("pollJob", () => {
  it("returns once the job reaches a terminal state", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "j", status: "running" }))
      .mockResolvedValueOnce(res({ id: "j", status: "done", result: { outputId: "j" } }));
    const job = await new CutroomClient({ baseUrl: "http://x" }).pollJob("j", { intervalMs: 0 });
    expect(job.status).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the deadline passes while still running", async () => {
    fetchMock.mockResolvedValue(res({ id: "j", status: "running" }));
    await expect(
      new CutroomClient({ baseUrl: "http://x" }).pollJob("j", { intervalMs: 0, timeoutMs: -1 }),
    ).rejects.toThrow(/timed out/);
  });
});

describe("downloadOutput", () => {
  it("writes the fetched bytes to the destination path", async () => {
    fetchMock.mockResolvedValueOnce(res("RENDERED", { ok: true }));
    const dest = `${tmpFile}.out`;
    await new CutroomClient({ baseUrl: "http://x" }).downloadOutput("out-1", dest);
    expect(lastCall()[0]).toBe("http://x/api/media/out-1");
    expect((await readFile(dest, "utf8")).toString()).toBe("RENDERED");
    await rm(dest, { force: true });
  });

  it("throws when the download response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res("nope", { ok: false, status: 404 }));
    await expect(
      new CutroomClient({ baseUrl: "http://x" }).downloadOutput("missing", `${tmpFile}.out`),
    ).rejects.toThrow(/download missing failed \(404\)/);
  });
});
