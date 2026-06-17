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
