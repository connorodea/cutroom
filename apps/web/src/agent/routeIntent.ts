/** A tool the ⌘K agent can route a request to, or null when the request isn't a clear single tool. */
export type IntentTool = "create" | "import" | "reframe" | "highlights" | null;

/**
 * Classify a free-text agent request into the editor tool that fulfills it. Heuristic + ordered:
 * the more specific operation (reframe / highlights) wins over the generic "make a video" (create).
 * Returns null when nothing matches, so the caller falls back to the planning view.
 */
export function routeIntent(prompt: string): IntentTool {
  const p = prompt.toLowerCase();
  if (/\b(vertical|portrait|9\s*[:x]\s*16|reframe|tik\s?tok|shorts|square|1\s*[:x]\s*1|widescreen|16\s*[:x]\s*9|landscape)\b/.test(p)) {
    return "reframe";
  }
  if (/\b(highlight|highlights|best\s+(moments?|bits?|parts?)|montage|supercut|sizzle|top\s+moments?)\b/.test(p)) {
    return "highlights";
  }
  if (/\b(clean\s?up|remove\s+(the\s+)?(silence|filler)|filler\s+words?|dead\s+air|cut\s+(the\s+)?(silence|dead))\b/.test(p)) {
    return "import";
  }
  if (/\b(create|generate\s+a\s+video|make\s+(me\s+)?a\s+video|explainer|from\s+(a\s+)?(prompt|script|idea)|from\s+scratch)\b/.test(p)) {
    return "create";
  }
  return null;
}
