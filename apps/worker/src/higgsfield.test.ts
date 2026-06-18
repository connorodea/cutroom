import { describe, it, expect } from "vitest";
import { authHeader, imageBody, videoBody, pickRequestId, extractMediaUrl, isTerminal } from "./higgsfield";

describe("authHeader", () => {
  it("formats the Higgsfield Key header as id:secret", () => {
    expect(authHeader("abc", "xyz")).toBe("Key abc:xyz");
  });
});

describe("imageBody", () => {
  it("maps to prompt/aspect_ratio/resolution", () => {
    expect(imageBody("a cat", "16:9", "720p")).toEqual({ prompt: "a cat", aspect_ratio: "16:9", resolution: "720p" });
  });
  it("defaults resolution to 720p", () => {
    expect(imageBody("a cat", "9:16").resolution).toBe("720p");
  });
});

describe("videoBody", () => {
  it("maps image url + motion prompt", () => {
    expect(videoBody({ imageUrl: "https://x/i.png", prompt: "slow pan" })).toMatchObject({
      image_url: "https://x/i.png",
      prompt: "slow pan",
    });
  });
  it("includes duration only when provided", () => {
    expect(videoBody({ imageUrl: "u", prompt: "p" })).not.toHaveProperty("duration");
    expect(videoBody({ imageUrl: "u", prompt: "p", duration: 5 }).duration).toBe(5);
  });
});

describe("pickRequestId", () => {
  it("reads request_id, then id", () => {
    expect(pickRequestId({ request_id: "r1" })).toBe("r1");
    expect(pickRequestId({ id: "r2" })).toBe("r2");
  });
  it("returns undefined when absent", () => {
    expect(pickRequestId({ detail: "not_enough_credits" })).toBeUndefined();
  });
});

describe("extractMediaUrl", () => {
  it("reads the first image url from images[]", () => {
    expect(extractMediaUrl({ images: [{ url: "https://x/a.png" }] })).toBe("https://x/a.png");
  });
  it("reads a video url from video{}", () => {
    expect(extractMediaUrl({ video: { url: "https://x/v.mp4" } })).toBe("https://x/v.mp4");
  });
  it("reads nested results[].url", () => {
    expect(extractMediaUrl({ results: [{ url: "https://x/r.mp4" }] })).toBe("https://x/r.mp4");
  });
  it("reads a bare string url (video as a plain string, image url as a string in an array)", () => {
    expect(extractMediaUrl({ video: "https://x/v.mp4" })).toBe("https://x/v.mp4");
    expect(extractMediaUrl({ images: ["https://x/a.png"] })).toBe("https://x/a.png");
  });
  it("ignores non-array list fields and falls back to a string `output`", () => {
    expect(extractMediaUrl({ images: "not-an-array", output: "https://x/o.mp4" })).toBe("https://x/o.mp4");
  });
  it("returns null when no media present", () => {
    expect(extractMediaUrl({ status: "in_progress" })).toBeNull();
  });
  it("returns null for a null / non-object payload", () => {
    expect(extractMediaUrl(null)).toBeNull();
    expect(extractMediaUrl("oops")).toBeNull();
  });
});

describe("isTerminal", () => {
  it("treats completed/failed/nsfw as terminal", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("nsfw")).toBe(true);
  });
  it("treats queued/in_progress as non-terminal", () => {
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });
});
