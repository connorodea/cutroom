import { describe, it, expect } from "vitest";
import { safeOutputId, parseChainOp } from "./chain";

describe("safeOutputId", () => {
  it("keeps a valid id unchanged", () => {
    expect(safeOutputId("a1b2-c3d4-5e6f")).toBe("a1b2-c3d4-5e6f");
  });

  it("strips path-traversal and any non-id characters", () => {
    expect(safeOutputId("../../etc/passwd")).toBe("etcpasswd");
    expect(safeOutputId("a/b\\c.mp4")).toBe("abcmp4");
  });

  it("returns null for an empty or all-invalid id", () => {
    expect(safeOutputId("")).toBeNull();
    expect(safeOutputId("../")).toBeNull();
    expect(safeOutputId("   ")).toBeNull();
  });
});

describe("parseChainOp", () => {
  it("accepts the supported ops", () => {
    expect(parseChainOp("reframe")).toBe("reframe");
    expect(parseChainOp("captions")).toBe("captions");
    expect(parseChainOp("speed")).toBe("speed");
    expect(parseChainOp("color")).toBe("color");
    expect(parseChainOp("rotate")).toBe("rotate");
    expect(parseChainOp("audio")).toBe("audio");
    expect(parseChainOp("fade")).toBe("fade");
    expect(parseChainOp("reverse")).toBe("reverse");
    expect(parseChainOp("crop")).toBe("crop");
    expect(parseChainOp("gif")).toBe("gif");
  });

  it("returns null for an unknown or non-string op", () => {
    expect(parseChainOp("explode")).toBeNull();
    expect(parseChainOp(undefined)).toBeNull();
    expect(parseChainOp(42)).toBeNull();
  });
});
