import { describe, expect, it } from "vitest";
import {
  CUTROOM_AGENT_ID,
  CUTROOM_AGENT_MODEL_DEFAULT,
  CUTROOM_AGENT_NAME,
  CUTROOM_AGENT_SYSTEM_PROMPT,
} from "./agentConfig";

describe("Cutroom agent config", () => {
  it("exposes the published agent id", () => {
    expect(CUTROOM_AGENT_ID).toMatch(/^agent_/);
  });

  it("defaults to sonnet 4.6 (matches the published agent)", () => {
    expect(CUTROOM_AGENT_MODEL_DEFAULT).toBe("claude-sonnet-4-6");
  });

  it("is named Cutroom Agent", () => {
    expect(CUTROOM_AGENT_NAME).toBe("Cutroom Agent");
  });

  it("ships a substantial system prompt mentioning the product", () => {
    expect(CUTROOM_AGENT_SYSTEM_PROMPT.length).toBeGreaterThan(500);
    expect(CUTROOM_AGENT_SYSTEM_PROMPT).toContain("Cutroom");
  });
});
