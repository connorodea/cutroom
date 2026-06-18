import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  submitCreateJob,
  submitImageGenJob,
  submitVideoGenJob,
  submitEditJob,
  submitOverlayJob,
  submitCaptionsJob,
  submitSpeedJob,
  submitTrimJob,
  submitColorJob,
  submitRotateJob,
  submitAudioJob,
  submitFadeJob,
  submitReverseJob,
  submitCropJob,
  submitGifJob,
  submitLoopJob,
  submitThumbnailJob,
  submitStitchJob,
  submitWatermarkJob,
  submitPipJob,
  submitSplitJob,
  submitFreezeJob,
  submitKenBurnsJob,
  submitChromaKeyJob,
  submitBorderJob,
  submitCensorJob,
  submitMusicJob,
  submitGridJob,
  submitWaveformJob,
  submitLetterboxJob,
  submitSubtitlesJob,
  submitMemeJob,
  submitProgressJob,
  submitVignetteJob,
  submitChainJob,
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

  it("submitHighlightsJob falls back to a generic message when the body has no error (e.g. a proxy 502)", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 502 }));
    await expect(submitHighlightsJob("src-7")).rejects.toThrow(/highlights failed \(502\)/);
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

  it("submitCaptionsJob POSTs the file with the caption position", async () => {
    await submitCaptionsJob(sampleFile(), { position: "top" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/captions`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("position")).toBe("top");
  });

  it("submitCaptionsJob defaults the position to bottom", async () => {
    await submitCaptionsJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("position")).toBe("bottom");
  });

  it("submitCaptionsJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "captions boom" }, { ok: false, status: 400 }));
    await expect(submitCaptionsJob(sampleFile())).rejects.toThrow("captions boom");
  });

  it("submitSpeedJob POSTs the file with the speed factor", async () => {
    await submitSpeedJob(sampleFile(), { factor: 4 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/speed`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("factor")).toBe("4");
  });

  it("submitSpeedJob defaults the factor to 2", async () => {
    await submitSpeedJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("factor")).toBe("2");
  });

  it("submitSpeedJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "speed boom" }, { ok: false, status: 400 }));
    await expect(submitSpeedJob(sampleFile())).rejects.toThrow("speed boom");
  });

  it("submitTrimJob POSTs the file with the start/end window", async () => {
    await submitTrimJob(sampleFile(), { start: 5, end: 12 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/trim`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("start")).toBe("5");
    expect(fd.get("end")).toBe("12");
  });

  it("submitTrimJob defaults start to 0 and leaves end open", async () => {
    await submitTrimJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("start")).toBe("0");
    expect(fd.get("end")).toBe("");
  });

  it("submitTrimJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "trim boom" }, { ok: false, status: 400 }));
    await expect(submitTrimJob(sampleFile())).rejects.toThrow("trim boom");
  });

  it("submitColorJob POSTs the file with the preset", async () => {
    await submitColorJob(sampleFile(), { preset: "cinematic" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/color`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("preset")).toBe("cinematic");
  });

  it("submitColorJob defaults the preset to none", async () => {
    await submitColorJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("preset")).toBe("none");
  });

  it("submitColorJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "color boom" }, { ok: false, status: 400 }));
    await expect(submitColorJob(sampleFile())).rejects.toThrow("color boom");
  });

  it("submitRotateJob POSTs the file with the orientation", async () => {
    await submitRotateJob(sampleFile(), { orientation: "ccw" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/rotate`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("orientation")).toBe("ccw");
  });

  it("submitRotateJob defaults the orientation to cw", async () => {
    await submitRotateJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("orientation")).toBe("cw");
  });

  it("submitRotateJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "rotate boom" }, { ok: false, status: 400 }));
    await expect(submitRotateJob(sampleFile())).rejects.toThrow("rotate boom");
  });

  it("submitAudioJob POSTs the file with the mode and level", async () => {
    await submitAudioJob(sampleFile(), { mode: "mute" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/audio`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("mode")).toBe("mute");
    expect(fd.get("level")).toBe("1");
  });

  it("submitAudioJob defaults mode to volume and passes a custom level", async () => {
    await submitAudioJob(sampleFile(), { level: 0.5 });
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("mode")).toBe("volume");
    expect(fd.get("level")).toBe("0.5");
  });

  it("submitAudioJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "audio boom" }, { ok: false, status: 400 }));
    await expect(submitAudioJob(sampleFile())).rejects.toThrow("audio boom");
  });

  it("submitFadeJob POSTs the file with the kind and duration", async () => {
    await submitFadeJob(sampleFile(), { kind: "in", duration: 1 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/fade`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("kind")).toBe("in");
    expect(fd.get("duration")).toBe("1");
  });

  it("submitFadeJob defaults kind to both and duration to 0.5", async () => {
    await submitFadeJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("kind")).toBe("both");
    expect(fd.get("duration")).toBe("0.5");
  });

  it("submitFadeJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "fade boom" }, { ok: false, status: 400 }));
    await expect(submitFadeJob(sampleFile())).rejects.toThrow("fade boom");
  });

  it("submitReverseJob POSTs the file with the mode", async () => {
    await submitReverseJob(sampleFile(), { mode: "boomerang" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/reverse`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("mode")).toBe("boomerang");
  });

  it("submitReverseJob defaults the mode to reverse", async () => {
    await submitReverseJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("mode")).toBe("reverse");
  });

  it("submitReverseJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "reverse boom" }, { ok: false, status: 400 }));
    await expect(submitReverseJob(sampleFile())).rejects.toThrow("reverse boom");
  });

  it("submitCropJob POSTs the file with the preset", async () => {
    await submitCropJob(sampleFile(), { preset: "top" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/crop`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("preset")).toBe("top");
  });

  it("submitCropJob defaults the preset to center", async () => {
    await submitCropJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("preset")).toBe("center");
  });

  it("submitCropJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "crop boom" }, { ok: false, status: 400 }));
    await expect(submitCropJob(sampleFile())).rejects.toThrow("crop boom");
  });

  it("submitLoopJob POSTs the file with the count", async () => {
    await submitLoopJob(sampleFile(), { count: 3 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/loop`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("count")).toBe("3");
  });

  it("submitLoopJob defaults the count to 2", async () => {
    await submitLoopJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("count")).toBe("2");
  });

  it("submitLoopJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "loop boom" }, { ok: false, status: 400 }));
    await expect(submitLoopJob(sampleFile())).rejects.toThrow("loop boom");
  });

  it("submitSplitJob POSTs left + right with the layout", async () => {
    await submitSplitJob(sampleFile(), sampleFile(), { layout: "vertical" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/split`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("right")).toBeInstanceOf(File);
    expect(fd.get("layout")).toBe("vertical");
  });

  it("submitSplitJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "split boom" }, { ok: false, status: 400 }));
    await expect(submitSplitJob(sampleFile(), sampleFile())).rejects.toThrow("split boom");
  });

  it("submitFreezeJob POSTs the file with position + seconds", async () => {
    await submitFreezeJob(sampleFile(), { position: "start", seconds: 3 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/freeze`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("position")).toBe("start");
    expect(fd.get("seconds")).toBe("3");
  });

  it("submitFreezeJob defaults to holding the end for 2s", async () => {
    await submitFreezeJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("position")).toBe("end");
    expect(fd.get("seconds")).toBe("2");
  });

  it("submitFreezeJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "freeze boom" }, { ok: false, status: 400 }));
    await expect(submitFreezeJob(sampleFile())).rejects.toThrow("freeze boom");
  });

  it("submitKenBurnsJob POSTs the image with direction/seconds/aspect", async () => {
    await submitKenBurnsJob(sampleFile(), { direction: "right", seconds: 8, aspect: "portrait" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/kenburns`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("direction")).toBe("right");
    expect(fd.get("seconds")).toBe("8");
    expect(fd.get("aspect")).toBe("portrait");
  });

  it("submitKenBurnsJob defaults to a 5s landscape zoom-in", async () => {
    await submitKenBurnsJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("direction")).toBe("in");
    expect(fd.get("seconds")).toBe("5");
    expect(fd.get("aspect")).toBe("landscape");
  });

  it("submitKenBurnsJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "kb boom" }, { ok: false, status: 400 }));
    await expect(submitKenBurnsJob(sampleFile())).rejects.toThrow("kb boom");
  });

  it("submitChromaKeyJob POSTs the subject + background with color/similarity/blend", async () => {
    await submitChromaKeyJob(sampleFile(), sampleFile(), { color: "blue", similarity: 0.4, blend: 0.2 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/chromakey`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("background")).toBeInstanceOf(File);
    expect(fd.get("color")).toBe("blue");
    expect(fd.get("similarity")).toBe("0.4");
    expect(fd.get("blend")).toBe("0.2");
  });

  it("submitChromaKeyJob defaults to green at 0.3/0.1", async () => {
    await submitChromaKeyJob(sampleFile(), sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("color")).toBe("green");
    expect(fd.get("similarity")).toBe("0.3");
    expect(fd.get("blend")).toBe("0.1");
  });

  it("submitChromaKeyJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "ck boom" }, { ok: false, status: 400 }));
    await expect(submitChromaKeyJob(sampleFile(), sampleFile())).rejects.toThrow("ck boom");
  });

  it("submitBorderJob POSTs the file with thickness + color", async () => {
    await submitBorderJob(sampleFile(), { thickness: 40, color: "black" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/border`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("thickness")).toBe("40");
    expect(fd.get("color")).toBe("black");
  });

  it("submitBorderJob defaults to a 24px white frame", async () => {
    await submitBorderJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("thickness")).toBe("24");
    expect(fd.get("color")).toBe("white");
  });

  it("submitBorderJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "border boom" }, { ok: false, status: 400 }));
    await expect(submitBorderJob(sampleFile())).rejects.toThrow("border boom");
  });

  it("submitCensorJob POSTs the file with region + strength", async () => {
    await submitCensorJob(sampleFile(), { region: "top", strength: 30 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/censor`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("region")).toBe("top");
    expect(fd.get("strength")).toBe("30");
  });

  it("submitCensorJob defaults to the center at strength 20", async () => {
    await submitCensorJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("region")).toBe("center");
    expect(fd.get("strength")).toBe("20");
  });

  it("submitCensorJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "censor boom" }, { ok: false, status: 400 }));
    await expect(submitCensorJob(sampleFile())).rejects.toThrow("censor boom");
  });

  it("submitMusicJob POSTs the video + music with the volume", async () => {
    await submitMusicJob(sampleFile(), sampleFile(), { volume: 0.5 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/music`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("music")).toBeInstanceOf(File);
    expect(fd.get("volume")).toBe("0.5");
  });

  it("submitMusicJob defaults the volume to 0.3", async () => {
    await submitMusicJob(sampleFile(), sampleFile());
    expect((lastCall()[1]?.body as FormData).get("volume")).toBe("0.3");
  });

  it("submitMusicJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "music boom" }, { ok: false, status: 400 }));
    await expect(submitMusicJob(sampleFile(), sampleFile())).rejects.toThrow("music boom");
  });

  it("submitGridJob POSTs four clips under a repeated 'files' field", async () => {
    await submitGridJob([sampleFile(), sampleFile(), sampleFile(), sampleFile()]);
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/grid`);
    const fd = init?.body as FormData;
    expect(fd.getAll("files")).toHaveLength(4);
    expect(fd.getAll("files")[0]).toBeInstanceOf(File);
  });

  it("submitGridJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "grid boom" }, { ok: false, status: 400 }));
    await expect(submitGridJob([sampleFile()])).rejects.toThrow("grid boom");
  });

  it("submitWaveformJob POSTs the audio with mode/color/aspect", async () => {
    await submitWaveformJob(sampleFile(), { mode: "line", color: "magenta", aspect: "portrait" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/waveform`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("mode")).toBe("line");
    expect(fd.get("color")).toBe("magenta");
    expect(fd.get("aspect")).toBe("portrait");
  });

  it("submitWaveformJob defaults to a square cyan centered line", async () => {
    await submitWaveformJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("mode")).toBe("cline");
    expect(fd.get("color")).toBe("cyan");
    expect(fd.get("aspect")).toBe("square");
  });

  it("submitWaveformJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "wave boom" }, { ok: false, status: 400 }));
    await expect(submitWaveformJob(sampleFile())).rejects.toThrow("wave boom");
  });

  it("submitLetterboxJob POSTs the file with the preset", async () => {
    await submitLetterboxJob(sampleFile(), { preset: "wide" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/letterbox`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("preset")).toBe("wide");
  });

  it("submitLetterboxJob defaults to the cinema preset", async () => {
    await submitLetterboxJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("preset")).toBe("cinema");
  });

  it("submitLetterboxJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "lb boom" }, { ok: false, status: 400 }));
    await expect(submitLetterboxJob(sampleFile())).rejects.toThrow("lb boom");
  });

  it("submitSubtitlesJob POSTs the video + the srt file", async () => {
    await submitSubtitlesJob(sampleFile(), sampleFile());
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/subtitles`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("srt")).toBeInstanceOf(File);
  });

  it("submitSubtitlesJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "srt boom" }, { ok: false, status: 400 }));
    await expect(submitSubtitlesJob(sampleFile(), sampleFile())).rejects.toThrow("srt boom");
  });

  it("submitMemeJob POSTs the file with top + bottom text", async () => {
    await submitMemeJob(sampleFile(), { top: "one does not simply", bottom: "make a meme" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/meme`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("top")).toBe("one does not simply");
    expect(fd.get("bottom")).toBe("make a meme");
  });

  it("submitMemeJob defaults both texts to empty strings", async () => {
    await submitMemeJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("top")).toBe("");
    expect(fd.get("bottom")).toBe("");
  });

  it("submitMemeJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "meme boom" }, { ok: false, status: 400 }));
    await expect(submitMemeJob(sampleFile())).rejects.toThrow("meme boom");
  });

  it("submitProgressJob POSTs the file with color + thickness", async () => {
    await submitProgressJob(sampleFile(), { color: "red", thickness: "thick" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/progress`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("color")).toBe("red");
    expect(fd.get("thickness")).toBe("thick");
  });

  it("submitProgressJob defaults to a medium cyan bar", async () => {
    await submitProgressJob(sampleFile());
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("color")).toBe("cyan");
    expect(fd.get("thickness")).toBe("medium");
  });

  it("submitProgressJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "prog boom" }, { ok: false, status: 400 }));
    await expect(submitProgressJob(sampleFile())).rejects.toThrow("prog boom");
  });

  it("submitVignetteJob POSTs the file with the strength", async () => {
    await submitVignetteJob(sampleFile(), { strength: "strong" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/vignette`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("strength")).toBe("strong");
  });

  it("submitVignetteJob defaults to medium", async () => {
    await submitVignetteJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("strength")).toBe("medium");
  });

  it("submitVignetteJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "vig boom" }, { ok: false, status: 400 }));
    await expect(submitVignetteJob(sampleFile())).rejects.toThrow("vig boom");
  });

  it("submitPipJob POSTs main + overlay with corner/scale", async () => {
    await submitPipJob(sampleFile(), sampleFile(), { corner: "tl", scale: 0.25 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/pip`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("overlay")).toBeInstanceOf(File);
    expect(fd.get("corner")).toBe("tl");
    expect(fd.get("scale")).toBe("0.25");
  });

  it("submitPipJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "pip boom" }, { ok: false, status: 400 }));
    await expect(submitPipJob(sampleFile(), sampleFile())).rejects.toThrow("pip boom");
  });

  it("submitWatermarkJob POSTs the file with text/corner/opacity", async () => {
    await submitWatermarkJob(sampleFile(), { text: "@cutroom", corner: "tl", opacity: 0.4 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/watermark`);
    const fd = init?.body as FormData;
    expect(fd.get("text")).toBe("@cutroom");
    expect(fd.get("corner")).toBe("tl");
    expect(fd.get("opacity")).toBe("0.4");
  });

  it("submitWatermarkJob defaults corner to br and opacity to 0.5", async () => {
    await submitWatermarkJob(sampleFile(), { text: "brand" });
    const fd = lastCall()[1]?.body as FormData;
    expect(fd.get("corner")).toBe("br");
    expect(fd.get("opacity")).toBe("0.5");
  });

  it("submitWatermarkJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "wm boom" }, { ok: false, status: 400 }));
    await expect(submitWatermarkJob(sampleFile(), { text: "x" })).rejects.toThrow("wm boom");
  });

  it("submitStitchJob POSTs all clips under a repeated 'files' field", async () => {
    await submitStitchJob([sampleFile(), sampleFile()]);
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/stitch`);
    expect((init?.body as FormData).getAll("files")).toHaveLength(2);
  });

  it("submitStitchJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "stitch boom" }, { ok: false, status: 400 }));
    await expect(submitStitchJob([sampleFile(), sampleFile()])).rejects.toThrow("stitch boom");
  });

  it("submitThumbnailJob POSTs the file with the time", async () => {
    await submitThumbnailJob(sampleFile(), { time: 3.5 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/thumbnail`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("time")).toBe("3.5");
  });

  it("submitThumbnailJob defaults the time to 0", async () => {
    await submitThumbnailJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("time")).toBe("0");
  });

  it("submitThumbnailJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "thumb boom" }, { ok: false, status: 400 }));
    await expect(submitThumbnailJob(sampleFile())).rejects.toThrow("thumb boom");
  });

  it("submitGifJob POSTs the file with the width", async () => {
    await submitGifJob(sampleFile(), { width: 320 });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/gif`);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("width")).toBe("320");
  });

  it("submitGifJob defaults the width to 480", async () => {
    await submitGifJob(sampleFile());
    expect((lastCall()[1]?.body as FormData).get("width")).toBe("480");
  });

  it("submitGifJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "gif boom" }, { ok: false, status: 400 }));
    await expect(submitGifJob(sampleFile())).rejects.toThrow("gif boom");
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

  it("submitReframeJob falls back to a generic message when the body has no error", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 502 }));
    await expect(submitReframeJob(sampleFile())).rejects.toThrow(/reframe failed \(502\)/);
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
  it("submitChainJob POSTs the outputId, op and options", async () => {
    await submitChainJob("out-1", "reframe", { aspect: "portrait", mode: "blur" });
    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/chain`);
    expect(JSON.parse(init?.body as string)).toEqual({ outputId: "out-1", op: "reframe", aspect: "portrait", mode: "blur" });
  });

  it("submitChainJob chains speed and color ops with their params", async () => {
    await submitChainJob("out-1", "speed", { factor: 2 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-1", op: "speed", factor: 2 });
    await submitChainJob("out-2", "color", { preset: "vivid" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-2", op: "color", preset: "vivid" });
  });

  it("submitChainJob chains fade and reverse ops with their params", async () => {
    await submitChainJob("out-1", "fade", { kind: "both" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-1", op: "fade", kind: "both" });
    await submitChainJob("out-2", "reverse", { mode: "boomerang" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-2", op: "reverse", mode: "boomerang" });
  });

  it("submitChainJob chains crop and gif ops with their params", async () => {
    await submitChainJob("out-1", "crop", { preset: "center" });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-1", op: "crop", preset: "center" });
    await submitChainJob("out-2", "gif", { width: 480 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-2", op: "gif", width: 480 });
  });

  it("submitChainJob chains loop and thumbnail ops with their params", async () => {
    await submitChainJob("out-1", "loop", { count: 3 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-1", op: "loop", count: 3 });
    await submitChainJob("out-2", "thumbnail", { time: 2 });
    expect(JSON.parse(lastCall()[1]?.body as string)).toEqual({ outputId: "out-2", op: "thumbnail", time: 2 });
  });

  it("submitChainJob throws the server error on failure", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "chain boom" }, { ok: false, status: 404 }));
    await expect(submitChainJob("x", "captions")).rejects.toThrow("chain boom");
  });

  it("submitChainJob falls back to a generic message when the body has no error", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 502 }));
    await expect(submitChainJob("x", "captions")).rejects.toThrow(/chain failed \(502\)/);
  });

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
