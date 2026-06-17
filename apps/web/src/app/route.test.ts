import { describe, it, expect } from "vitest";
import { routeFor } from "./route";

describe("routeFor", () => {
  it("routes the root path to the landing page", () => {
    expect(routeFor("/")).toBe("landing");
  });

  it("routes /app to the editor", () => {
    expect(routeFor("/app")).toBe("editor");
  });

  it("routes nested /app paths to the editor", () => {
    expect(routeFor("/app/project/123")).toBe("editor");
  });

  it("does not treat a path that merely starts with 'app' as the editor", () => {
    expect(routeFor("/application")).toBe("landing");
  });

  it("routes unknown paths to the landing page", () => {
    expect(routeFor("/pricing")).toBe("landing");
  });
});
