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

  it("chain supports the rotate / audio / fade / reverse ops", async () => {
    await client().chain("o1", "rotate", { orientation: "cw" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o1", op: "rotate", orientation: "cw" });
    await client().chain("o2", "audio", { mode: "mute" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o2", op: "audio", mode: "mute" });
    await client().chain("o3", "fade", { kind: "both", duration: 0.5 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o3", op: "fade", kind: "both", duration: 0.5 });
    await client().chain("o4", "reverse", { mode: "boomerang" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o4", op: "reverse", mode: "boomerang" });
  });

  it("chain supports the crop and gif ops", async () => {
    await client().chain("o5", "crop", { preset: "center" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o5", op: "crop", preset: "center" });
    await client().chain("o6", "gif", { width: 480 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o6", op: "gif", width: 480 });
  });

  it("chain supports the loop and thumbnail ops", async () => {
    await client().chain("o7", "loop", { count: 3 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o7", op: "loop", count: 3 });
    await client().chain("o8", "thumbnail", { time: 2 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "o8", op: "thumbnail", time: 2 });
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

  it("fade POSTs the file with the kind and duration", async () => {
    await client().fade(tmpFile, { kind: "in", duration: 1 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/fade");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("kind")).toBe("in");
    expect(fd.get("duration")).toBe("1");
  });

  it("fade defaults the kind to both and duration to 0.5", async () => {
    await client().fade(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("kind")).toBe("both");
    expect(fd.get("duration")).toBe("0.5");
  });

  it("audio POSTs the file with the mode and level", async () => {
    await client().audio(tmpFile, { mode: "volume", level: 0.5 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/audio");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("mode")).toBe("volume");
    expect(fd.get("level")).toBe("0.5");
  });

  it("audio defaults the mode to volume and level to 1", async () => {
    await client().audio(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("mode")).toBe("volume");
    expect(fd.get("level")).toBe("1");
  });

  it("splitScreen POSTs the left + right files with the layout", async () => {
    await client().splitScreen(tmpFile, tmpFile, { layout: "vertical" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/split");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("right")).toBeInstanceOf(File);
    expect(fd.get("layout")).toBe("vertical");
  });

  it("splitScreen defaults the layout to horizontal", async () => {
    await client().splitScreen(tmpFile, tmpFile);
    expect((lastCall()[1]?.body as FormData).get("layout")).toBe("horizontal");
  });

  it("freeze POSTs the file with position + seconds", async () => {
    await client().freeze(tmpFile, { position: "start", seconds: 3 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/freeze");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("position")).toBe("start");
    expect(fd.get("seconds")).toBe("3");
  });

  it("freeze defaults to holding the end for 2s", async () => {
    await client().freeze(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("position")).toBe("end");
    expect(fd.get("seconds")).toBe("2");
  });

  it("pixelate POSTs the file with the size", async () => {
    await client().pixelate(tmpFile, { size: "large" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/pixelate");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("size")).toBe("large");
  });

  it("pixelate defaults to medium", async () => {
    await client().pixelate(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("size")).toBe("medium");
  });

  it("vignette POSTs the file with the strength", async () => {
    await client().vignette(tmpFile, { strength: "strong" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/vignette");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("strength")).toBe("strong");
  });

  it("vignette defaults to medium", async () => {
    await client().vignette(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("strength")).toBe("medium");
  });

  it("progress POSTs the file with color + thickness", async () => {
    await client().progress(tmpFile, { color: "red", thickness: "thick" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/progress");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("color")).toBe("red");
    expect(fd.get("thickness")).toBe("thick");
  });

  it("progress defaults to a medium cyan bar", async () => {
    await client().progress(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("color")).toBe("cyan");
    expect(fd.get("thickness")).toBe("medium");
  });

  it("letterbox POSTs the file with the preset", async () => {
    await client().letterbox(tmpFile, { preset: "wide" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/letterbox");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("preset")).toBe("wide");
  });

  it("letterbox defaults to the cinema preset", async () => {
    await client().letterbox(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("preset")).toBe("cinema");
  });

  it("border POSTs the file with thickness + color", async () => {
    await client().border(tmpFile, { thickness: 40, color: "black" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/border");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("thickness")).toBe("40");
    expect(fd.get("color")).toBe("black");
  });

  it("border defaults to a 24px white frame", async () => {
    await client().border(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("thickness")).toBe("24");
    expect(fd.get("color")).toBe("white");
  });

  it("censor POSTs the file with region + strength", async () => {
    await client().censor(tmpFile, { region: "top", strength: 30 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/censor");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("region")).toBe("top");
    expect(fd.get("strength")).toBe("30");
  });

  it("censor defaults to the center at strength 20", async () => {
    await client().censor(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("region")).toBe("center");
    expect(fd.get("strength")).toBe("20");
  });

  it("kenBurns POSTs the image with direction/seconds/aspect", async () => {
    await client().kenBurns(tmpFile, { direction: "right", seconds: 8, aspect: "portrait" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/kenburns");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("direction")).toBe("right");
    expect(fd.get("seconds")).toBe("8");
    expect(fd.get("aspect")).toBe("portrait");
  });

  it("kenBurns defaults to a 5s landscape zoom-in", async () => {
    await client().kenBurns(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("direction")).toBe("in");
    expect(fd.get("seconds")).toBe("5");
    expect(fd.get("aspect")).toBe("landscape");
  });

  it("waveform POSTs the audio with mode/color/aspect", async () => {
    await client().waveform(tmpFile, { mode: "line", color: "magenta", aspect: "portrait" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/waveform");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("mode")).toBe("line");
    expect(fd.get("color")).toBe("magenta");
    expect(fd.get("aspect")).toBe("portrait");
  });

  it("waveform defaults to a square cyan centered line", async () => {
    await client().waveform(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("mode")).toBe("cline");
    expect(fd.get("color")).toBe("cyan");
    expect(fd.get("aspect")).toBe("square");
  });

  it("music POSTs the video + music track with the volume", async () => {
    await client().music(tmpFile, tmpFile, { volume: 0.5 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/music");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("music")).toBeInstanceOf(File);
    expect(fd.get("volume")).toBe("0.5");
  });

  it("music defaults the volume to 0.3", async () => {
    await client().music(tmpFile, tmpFile);
    expect((lastCall()[1]?.body as FormData).get("volume")).toBe("0.3");
  });

  it("chromaKey POSTs the subject + background with color/similarity/blend", async () => {
    await client().chromaKey(tmpFile, tmpFile, { color: "blue", similarity: 0.4, blend: 0.2 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/chromakey");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("background")).toBeInstanceOf(File);
    expect(fd.get("color")).toBe("blue");
    expect(fd.get("similarity")).toBe("0.4");
    expect(fd.get("blend")).toBe("0.2");
  });

  it("chromaKey defaults to green at 0.3/0.1", async () => {
    await client().chromaKey(tmpFile, tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("color")).toBe("green");
    expect(fd.get("similarity")).toBe("0.3");
    expect(fd.get("blend")).toBe("0.1");
  });

  it("meme POSTs the file with top + bottom text", async () => {
    await client().meme(tmpFile, { top: "one does not simply", bottom: "make a meme" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/meme");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("top")).toBe("one does not simply");
    expect(fd.get("bottom")).toBe("make a meme");
  });

  it("meme defaults both texts to empty strings", async () => {
    await client().meme(tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("top")).toBe("");
    expect(fd.get("bottom")).toBe("");
  });

  it("pip POSTs the main + overlay files with corner/scale", async () => {
    await client().pip(tmpFile, tmpFile, { corner: "tl", scale: 0.25 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/pip");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("overlay")).toBeInstanceOf(File);
    expect(fd.get("corner")).toBe("tl");
    expect(fd.get("scale")).toBe("0.25");
  });

  it("pip defaults corner to br and scale to 0.3", async () => {
    await client().pip(tmpFile, tmpFile);
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("corner")).toBe("br");
    expect(fd.get("scale")).toBe("0.3");
  });

  it("watermark POSTs the file with text/corner/opacity", async () => {
    await client().watermark(tmpFile, "@cutroom", { corner: "tl", opacity: 0.4 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/watermark");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("text")).toBe("@cutroom");
    expect(fd.get("corner")).toBe("tl");
    expect(fd.get("opacity")).toBe("0.4");
  });

  it("watermark defaults corner to br and opacity to 0.5", async () => {
    await client().watermark(tmpFile, "brand");
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("corner")).toBe("br");
    expect(fd.get("opacity")).toBe("0.5");
  });

  it("stitch POSTs all the clips under a repeated 'files' field", async () => {
    await client().stitch([tmpFile, tmpFile]);
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/stitch");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.getAll("files")).toHaveLength(2);
    expect(fd.getAll("files")[0]).toBeInstanceOf(File);
  });

  it("subtitles POSTs the video + the srt file", async () => {
    await client().subtitles(tmpFile, tmpFile);
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/subtitles");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("srt")).toBeInstanceOf(File);
  });

  it("grid POSTs four clips under a repeated 'files' field", async () => {
    await client().grid([tmpFile, tmpFile, tmpFile, tmpFile]);
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/grid");
    const fd = init?.body as FormData;
    expect(fd.getAll("files")).toHaveLength(4);
    expect(fd.getAll("files")[0]).toBeInstanceOf(File);
  });

  it("thumbnail POSTs the file with the time", async () => {
    await client().thumbnail(tmpFile, { time: 3.5 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/thumbnail");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("time")).toBe("3.5");
  });

  it("thumbnail omits time when not given (server uses the midpoint)", async () => {
    await client().thumbnail(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("time")).toBeNull();
  });

  it("loop POSTs the file with the count", async () => {
    await client().loop(tmpFile, { count: 3 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/loop");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("count")).toBe("3");
  });

  it("loop defaults the count to 2", async () => {
    await client().loop(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("count")).toBe("2");
  });

  it("gif POSTs the file with only the provided options", async () => {
    await client().gif(tmpFile, { width: 320 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/gif");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("width")).toBe("320");
    expect(fd.get("fps")).toBeNull();
  });

  it("crop POSTs the file with the preset and only provided overrides", async () => {
    await client().crop(tmpFile, { preset: "center", w: 0.4 });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/crop");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("preset")).toBe("center");
    expect(fd.get("w")).toBe("0.4");
    expect(fd.get("x")).toBeNull();
  });

  it("reverse POSTs the file with the mode", async () => {
    await client().reverse(tmpFile, { mode: "boomerang" });
    const [url, init] = lastCall();
    expect(url).toBe("http://x/api/reverse");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("mode")).toBe("boomerang");
  });

  it("reverse defaults the mode to reverse", async () => {
    await client().reverse(tmpFile);
    expect((lastCall()[1]?.body as FormData).get("mode")).toBe("reverse");
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
