/** A tool the ⌘K agent can route a request to, or null when the request isn't a clear single tool. */
export type IntentTool =
  | "create" | "import" | "reframe" | "highlights" | "captions" | "overlay" | "generate"
  | "speed" | "trim" | "color" | "rotate" | "audio" | "fade" | "reverse" | "crop" | "gif" | "loop"
  | "thumbnail" | "stitch" | "watermark" | "pip" | "split" | "freeze" | "kenburns" | "chromakey" | "border" | "censor" | null;

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
  if (/\b(thumbnail|thumb|poster|screenshot|grab\s+(a\s+)?frame)\b/.test(p)) {
    return "thumbnail";
  }
  if (/\b(pip|picture[\s-]?in[\s-]?picture)\b/.test(p)) {
    return "pip";
  }
  if (/\b(split[\s-]?screen|side[\s-]?by[\s-]?side|stack(ed)?\s+(the\s+)?clips?|on\s+top\s+of\s+each\s+other)\b/.test(p)) {
    return "split";
  }
  if (/\b(freeze[\s-]?frame|freeze\s+(the|it|on)|hold\s+(the\s+)?(first|last|final|opening|ending)?\s*frame)\b/.test(p)) {
    return "freeze";
  }
  if (/\b(ken\s?burns|pan\s+and\s+zoom|pan\/zoom|slideshow|animate\s+(the\s+|this\s+|a\s+|my\s+)?(photo|image|picture|still|stills))\b/.test(p)) {
    return "kenburns";
  }
  if (/\b(chroma\s?key|green\s?screen|blue\s?screen|key\s+out|replace\s+the\s+(green|blue)\s+(background|screen))\b/.test(p)) {
    return "chromakey";
  }
  if (/\b(censor|redact|pixel(ate|ise|ize)|blur\s+(out|the|his|her|their|my)|blur\s+(a\s+)?(face|plate|logo|name))\b/.test(p)) {
    return "censor";
  }
  if (/\b(border|matte|add\s+a\s+(\w+\s+)?(border|frame)|frame\s+(the\s+|this\s+)?(video|clip|it)|put\s+a\s+(border|frame|matte))\b/.test(p)) {
    return "border";
  }
  if (/\b(stitch|concat(enate)?|join\s+(the\s+)?clips|merge\s+(the\s+)?clips|combine\s+(the\s+)?clips)\b/.test(p)) {
    return "stitch";
  }
  if (/\b(watermark|brand\s+(it|the)|add\s+(my\s+)?(logo|handle|brand))\b/.test(p)) {
    return "watermark";
  }
  if (/\b(clean\s?up|remove\s+(the\s+)?(silence|filler)|filler\s+words?|dead\s+air|cut\s+(the\s+)?(silence|dead))\b/.test(p)) {
    return "import";
  }
  if (/\b(create|generate\s+a\s+video|make\s+(me\s+)?a\s+video|explainer|from\s+(a\s+)?(prompt|script|idea)|from\s+scratch)\b/.test(p)) {
    return "create";
  }
  return null;
}
