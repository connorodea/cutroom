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

  it("prefers the specific operation over generic create", () => {
    expect(routeIntent("make a vertical video")).toBe("reframe");
  });

  it("returns null when nothing matches", () => {
    expect(routeIntent("hello there, what can you do?")).toBeNull();
  });
});
