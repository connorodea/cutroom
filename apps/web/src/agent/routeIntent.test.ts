import { describe, it, expect } from "vitest";
import { routeIntent } from "./routeIntent";

describe("routeIntent", () => {
  it("routes vertical/aspect requests to reframe", () => {
    expect(routeIntent("make it vertical for tiktok")).toBe("reframe");
    expect(routeIntent("reframe this to 9:16")).toBe("reframe");
    expect(routeIntent("cut it down to a square for instagram")).toBe("reframe");
  });

  it("routes best-moments requests to highlights", () => {
    expect(routeIntent("give me the highlights")).toBe("highlights");
    expect(routeIntent("pull the best moments into a montage")).toBe("highlights");
  });

  it("routes silence/filler requests to import (clean-up)", () => {
    expect(routeIntent("clean up the silences and filler words")).toBe("import");
    expect(routeIntent("remove the dead air")).toBe("import");
  });

  it("routes generative requests to create", () => {
    expect(routeIntent("create a 30 second explainer")).toBe("create");
    expect(routeIntent("make me a video from a script")).toBe("create");
  });

  it("routes caption requests to captions", () => {
    expect(routeIntent("add captions to this")).toBe("captions");
    expect(routeIntent("burn in subtitles")).toBe("captions");
  });

  it("routes on-screen-graphics requests to overlay", () => {
    expect(routeIntent("add a lower third with my name")).toBe("overlay");
    expect(routeIntent("put a callout on screen")).toBe("overlay");
  });

  it("routes image/AI-footage requests to generate", () => {
    expect(routeIntent("generate an image of a sunset")).toBe("generate");
    expect(routeIntent("make me some ai footage of a city")).toBe("generate");
  });

  it("routes speed requests to speed", () => {
    expect(routeIntent("speed this up")).toBe("speed");
    expect(routeIntent("make it slow motion")).toBe("speed");
    expect(routeIntent("turn it into a timelapse")).toBe("speed");
  });

  it("routes trim requests to trim", () => {
    expect(routeIntent("trim the clip")).toBe("trim");
    expect(routeIntent("shorten this video")).toBe("trim");
    expect(routeIntent("keep the first 10 seconds")).toBe("trim");
  });

  it("routes color-grade requests to color", () => {
    expect(routeIntent("make it black and white")).toBe("color");
    expect(routeIntent("give it a cinematic look")).toBe("color");
    expect(routeIntent("color grade this")).toBe("color");
  });

  it("routes rotate/flip requests to rotate", () => {
    expect(routeIntent("rotate this clip")).toBe("rotate");
    expect(routeIntent("it was shot sideways, fix it")).toBe("rotate");
    expect(routeIntent("flip it horizontally")).toBe("rotate");
  });

  it("routes audio requests to audio", () => {
    expect(routeIntent("mute the audio")).toBe("audio");
    expect(routeIntent("make it louder")).toBe("audio");
    expect(routeIntent("normalize the loudness")).toBe("audio");
  });

  it("routes fade requests to fade", () => {
    expect(routeIntent("fade in from black")).toBe("fade");
    expect(routeIntent("add a fade out")).toBe("fade");
  });

  it("routes reverse and boomerang requests to reverse", () => {
    expect(routeIntent("reverse this clip")).toBe("reverse");
    expect(routeIntent("make a boomerang")).toBe("reverse");
    expect(routeIntent("play it backwards")).toBe("reverse");
  });

  it("routes crop requests to crop", () => {
    expect(routeIntent("crop this clip")).toBe("crop");
    expect(routeIntent("zoom in on the center")).toBe("crop");
  });

  it("routes gif requests to gif", () => {
    expect(routeIntent("make a gif")).toBe("gif");
    expect(routeIntent("export this as a gif")).toBe("gif");
  });

  it("routes loop requests to loop", () => {
    expect(routeIntent("loop this clip")).toBe("loop");
    expect(routeIntent("repeat it 3 times")).toBe("loop");
  });

  it("routes thumbnail/poster requests to thumbnail", () => {
    expect(routeIntent("grab a thumbnail")).toBe("thumbnail");
    expect(routeIntent("make a poster frame")).toBe("thumbnail");
    expect(routeIntent("grab a frame at 3 seconds")).toBe("thumbnail");
  });

  it("routes stitch/join requests to stitch", () => {
    expect(routeIntent("stitch these clips together")).toBe("stitch");
    expect(routeIntent("join the clips")).toBe("stitch");
    expect(routeIntent("concatenate the videos")).toBe("stitch");
  });

  it("routes watermark/brand requests to watermark", () => {
    expect(routeIntent("add a watermark")).toBe("watermark");
    expect(routeIntent("brand it with my handle")).toBe("watermark");
  });

  it("routes picture-in-picture requests to pip", () => {
    expect(routeIntent("add a picture in picture")).toBe("pip");
    expect(routeIntent("put my webcam in the corner as a pip")).toBe("pip");
    expect(routeIntent("make it a picture-in-picture")).toBe("pip");
  });

  it("routes split-screen requests to split", () => {
    expect(routeIntent("make a split screen")).toBe("split");
    expect(routeIntent("put the two clips side by side")).toBe("split");
    expect(routeIntent("stack the clips on top of each other")).toBe("split");
  });

  it("routes freeze-frame requests to freeze", () => {
    expect(routeIntent("add a freeze frame")).toBe("freeze");
    expect(routeIntent("freeze the last frame")).toBe("freeze");
    expect(routeIntent("hold the first frame for a few seconds")).toBe("freeze");
  });

  it("routes Ken Burns / animate-a-photo requests to kenburns", () => {
    expect(routeIntent("ken burns this photo")).toBe("kenburns");
    expect(routeIntent("animate this photo with a slow zoom")).toBe("kenburns");
    expect(routeIntent("pan and zoom across the image")).toBe("kenburns");
  });

  it("routes green-screen / chroma-key requests to chromakey", () => {
    expect(routeIntent("key out the green screen")).toBe("chromakey");
    expect(routeIntent("chroma key this clip")).toBe("chromakey");
    expect(routeIntent("replace the green background")).toBe("chromakey");
  });

  it("routes border / matte requests to border", () => {
    expect(routeIntent("add a white border")).toBe("border");
    expect(routeIntent("frame the video")).toBe("border");
    expect(routeIntent("put a matte around it")).toBe("border");
  });

  it("prefers the specific operation over generic create", () => {
    expect(routeIntent("make a vertical video")).toBe("reframe");
  });

  it("returns null when nothing matches", () => {
    expect(routeIntent("hello there, what can you do?")).toBeNull();
  });
});
