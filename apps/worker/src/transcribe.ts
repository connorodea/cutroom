import { createReadStream } from "node:fs";
import OpenAI from "openai";

export interface Word {
  word: string;
  start: number;
  end: number;
}

let client: OpenAI | null = null;
function openai(): OpenAI {
  return (client ??= new OpenAI()); // OPENAI_API_KEY from env
}

/** Transcribe audio to word-level timestamps via OpenAI Whisper. */
export async function transcribe(audioPath: string): Promise<Word[]> {
  const res = (await openai().audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  })) as unknown as { words?: { word: string; start: number; end: number }[] };

  return (res.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end }));
}
