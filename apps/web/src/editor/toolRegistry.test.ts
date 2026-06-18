import { describe, it, expect } from "vitest";
import { TOOL_GROUPS, allTools, filterTools } from "./toolRegistry";

describe("TOOL_GROUPS", () => {
  it("groups every tool under a non-empty category with a unique id + a store opener", () => {
    expect(TOOL_GROUPS.length).toBeGreaterThan(3);
    const ids = new Set<string>();
    for (const group of TOOL_GROUPS) {
      expect(group.category).not.toBe("");
      expect(group.tools.length).toBeGreaterThan(0);
      for (const tool of group.tools) {
        expect(tool.label).not.toBe("");
        expect(tool.icon).not.toBe("");
        expect(tool.opener.startsWith("open")).toBe(true);
        expect(ids.has(tool.id)).toBe(false); // ids are unique across groups
        ids.add(tool.id);
      }
    }
  });
});

describe("allTools", () => {
  it("flattens every group's tools in order", () => {
    const flat = allTools();
    const expected = TOOL_GROUPS.flatMap((g) => g.tools);
    expect(flat).toEqual(expected);
    expect(flat.some((t) => t.id === "reframe")).toBe(true);
    expect(flat.some((t) => t.id === "progress")).toBe(true);
  });
});

describe("filterTools", () => {
  it("returns every tool for an empty / whitespace query", () => {
    expect(filterTools("")).toEqual(allTools());
    expect(filterTools("   ")).toEqual(allTools());
  });

  it("matches tool labels case-insensitively as a substring", () => {
    const split = filterTools("split");
    expect(split).toHaveLength(1);
    expect(split[0].id).toBe("split");

    const green = filterTools("GREEN");
    expect(green.map((t) => t.id)).toContain("chromakey");
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterTools("nonexistent-tool-xyz")).toEqual([]);
  });
});
