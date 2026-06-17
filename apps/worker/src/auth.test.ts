import { describe, it, expect } from "vitest";
import { parseTokens, isAuthorized } from "./auth";

describe("parseTokens", () => {
  it("returns an empty set for undefined or blank input", () => {
    expect(parseTokens(undefined).size).toBe(0);
    expect(parseTokens("").size).toBe(0);
    expect(parseTokens("  ,  ,").size).toBe(0);
  });

  it("splits a comma-separated list, trimming and dropping empties", () => {
    expect(parseTokens(" a , b ,, c ")).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("isAuthorized", () => {
  const tokens = new Set(["alice", "bob"]);

  it("is open (authorized) when no tokens are configured", () => {
    expect(isAuthorized(undefined, new Set())).toBe(true);
    expect(isAuthorized("Bearer anything", new Set())).toBe(true);
  });

  it("authorizes a Bearer token in the set", () => {
    expect(isAuthorized("Bearer alice", tokens)).toBe(true);
    expect(isAuthorized("Bearer bob", tokens)).toBe(true);
  });

  it("rejects an unknown token", () => {
    expect(isAuthorized("Bearer mallory", tokens)).toBe(false);
  });

  it("rejects a missing or malformed header when tokens are configured", () => {
    expect(isAuthorized(undefined, tokens)).toBe(false);
    expect(isAuthorized("alice", tokens)).toBe(false);
    expect(isAuthorized("Basic alice", tokens)).toBe(false);
  });
});
