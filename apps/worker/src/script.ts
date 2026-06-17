import OpenAI from "openai";

export interface ScriptSegment {
  /** Narration line for this scene. */
  text: string;
  /** 1–3 concrete, visual words to search stock footage for. */
  query: string;
}

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI());

/** Have the AI write a short narration script broken into stock-footage scenes. */
export async function writeScript(prompt: string): Promise<ScriptSegment[]> {
  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You write short, punchy video narration and pick concrete stock-footage search queries. Output ONLY JSON.",
      },
      {
        role: "user",
        content:
          `Topic: ${prompt}\n\nWrite a tight narration of 4–6 short segments (one sentence each, ~8–14 words). ` +
          `For each segment give "text" (the spoken line) and "query" (1–3 concrete, visual words for stock footage — ` +
          `things you can film, e.g. "city skyline", "coffee pour", "ocean waves"). ` +
          `Return JSON: {"segments":[{"text":"...","query":"..."}]}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { segments?: { text?: unknown; query?: unknown }[] };
  return (parsed.segments ?? [])
    .map((s) => ({ text: String(s.text ?? "").trim(), query: String(s.query ?? s.text ?? "").trim() }))
    .filter((s) => s.text.length > 0)
    .slice(0, 8);
}

export interface TimedSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * Have the AI design tasteful on-screen graphics (title, lower thirds, callouts, badges) aligned
 * to the narration timeline. Returns a raw overlay spec — validate with normalizeElements().
 */
export async function suggestOverlays(topic: string, segments: TimedSegment[]): Promise<unknown[]> {
  const timeline = segments.map((s, i) => `${i}: [${s.start.toFixed(1)}s–${s.end.toFixed(1)}s] ${s.text}`).join("\n");
  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You design tasteful, minimal on-screen graphics for short videos. Output ONLY JSON." },
      {
        role: "user",
        content:
          `Topic: ${topic}\n\nNarration timeline (seconds):\n${timeline}\n\n` +
          `Design 2–4 overlay graphics. Element types and fields:\n` +
          `- "title": {text, subtitle?} — an opening title, usually start 0 to ~2.5s\n` +
          `- "lower_third": {text, subtitle?} — a name/label bar, lower-left\n` +
          `- "callout": {text, x, y} — a small label; x,y are 0–1 screen fractions (0,0=top-left)\n` +
          `- "badge": {text, corner} — a corner pill; corner is "tl"|"tr"|"bl"|"br"\n` +
          `Every element needs "type", "text", "start", and "end" (seconds within the video). ` +
          `Keep text VERY short (a few words). Don't overlap a lower_third with a callout in time. ` +
          `Return JSON: {"overlays":[...]}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { overlays?: unknown };
    return Array.isArray(parsed.overlays) ? parsed.overlays : [];
  } catch {
    return [];
  }
}
