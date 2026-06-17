/** A tool the ⌘K agent can route a request to, or null when the request isn't a clear single tool. */
export type IntentTool =
  | "create" | "import" | "reframe" | "highlights" | "captions" | "overlay" | "generate"
  | "speed" | "trim" | "color" | "rotate" | "audio" | "fade" | "reverse" | "crop" | "gif" | "loop" | null;

/**
 * Classify a free-text agent request into the editor tool that fulfills it. Heuristic + ordered:
 * specific operations (reframe / highlights / captions / overlay / generate) win over the generic
 * "make a video" (create). Returns null when nothing matches, so the caller falls back to planning.
 */
export function routeIntent(prompt: string): IntentTool {
  const p = prompt.toLowerCase();
  if (/\b(vertical|portrait|9\s*[:x]\s*16|reframe|tik\s?tok|shorts|square|1\s*[:x]\s*1|widescreen|16\s*[:x]\s*9|landscape)\b/.test(p)) {
    return "reframe";
  }
  if (/\b(highlight|highlights|best\s+(moments?|bits?|parts?)|montage|supercut|sizzle|top\s+moments?)\b/.test(p)) {
    return "highlights";
  }
  if (/\b(captions?|subtitles?)\b/.test(p)) {
    return "captions";
  }
  if (/\b(lower\s?third|title\s?card|callout|call-out|overlay|on-?screen\s+(text|graphics?)|badge|name\s?tag)\b/.test(p)) {
    return "overlay";
  }
  if (/\b(ai|higgsfield)\s+(image|picture|clip|footage|video)\b|\b(generate|make|create)\s+(an?\s+)?(image|picture)\b/.test(p)) {
    return "generate";
  }
  if (/\b(speed\s*(it\s*)?up|speed|faster|slow[\s-]?mo(tion)?|slow\s+it\s+down|time-?lapse|hyper-?lapse)\b/.test(p)) {
    return "speed";
  }
  if (/\b(trim|shorten|cut\s+to\s+\d+|keep\s+(only\s+)?(the\s+)?(first|last)\s+\d+)\b/.test(p)) {
    return "trim";
  }
  if (/\b(colou?r\s*grade|colou?r[\s-]?correct|grade\s+the\s+colou?r|vivid|cinematic|black\s+and\s+white|b\s*&\s*w|gray\s?scale|grey\s?scale|desaturate|saturation|warm\s+(tone|look|grade)|cool\s+(tone|look|grade))\b/.test(p)) {
    return "color";
  }
  if (/\b(rotate|flip|mirror\s+it|sideways|upside[\s-]?down|turn\s+it\s+(left|right|sideways|upright)|straighten)\b/.test(p)) {
    return "rotate";
  }
  if (/\b(reverse|backwards?|boomerang|rewind)\b/.test(p)) {
    return "reverse";
  }
  if (/\bfade\s*(in|out|to\s+black|from\s+black)?\b/.test(p)) {
    return "fade";
  }
  if (/\b(mute|louder|quieter|volume|turn\s+(up|down)\s+(the\s+)?(volume|sound|audio)|normalize\s+(the\s+)?(audio|sound|loudness)|audio\s+level)\b/.test(p)) {
    return "audio";
  }
  if (/\b(gif|gifs)\b/.test(p)) {
    return "gif";
  }
  if (/\b(crop|punch\s?in|zoom\s+in)\b/.test(p)) {
    return "crop";
  }
  if (/\b(loop|repeat)\b/.test(p)) {
    return "loop";
  }
  if (/\b(clean\s?up|remove\s+(the\s+)?(silence|filler)|filler\s+words?|dead\s+air|cut\s+(the\s+)?(silence|dead))\b/.test(p)) {
    return "import";
  }
  if (/\b(create|generate\s+a\s+video|make\s+(me\s+)?a\s+video|explainer|from\s+(a\s+)?(prompt|script|idea)|from\s+scratch)\b/.test(p)) {
    return "create";
  }
  return null;
}
