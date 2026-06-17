import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI());

/** Synthesize narration to an mp3 file via OpenAI TTS. */
export async function synthesize(text: string, outPath: string, voice = "alloy"): Promise<void> {
  const res = await openai().audio.speech.create({
    model: "tts-1",
    voice: voice as "alloy",
    input: text,
  });
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
}
