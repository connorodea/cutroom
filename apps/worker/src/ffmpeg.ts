import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const BIG = 256 * 1024 * 1024; // ffmpeg can be chatty on stderr

/** Run a binary, returning stdout (falls back to stderr). Throws on non-zero exit. */
export async function run(bin: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await exec(bin, args, { maxBuffer: BIG });
  return stdout || stderr;
}

/** Duration of a media file in seconds. */
export async function ffprobeDuration(input: string): Promise<number> {
  const out = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", input,
  ]);
  return parseFloat(out.trim()) || 0;
}

/** Video pixel dimensions (for caption PlayRes). Falls back to 1280x720. */
export async function ffprobeDimensions(input: string): Promise<{ width: number; height: number }> {
  try {
    const out = await run("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0:s=x", input,
    ]);
    const [w, h] = out.trim().split("x").map((n) => parseInt(n, 10));
    if (w && h) return { width: w, height: h };
  } catch {
    /* fall through */
  }
  return { width: 1280, height: 720 };
}

/** Whether the file has at least one audio stream. */
export async function ffprobeHasAudio(input: string): Promise<boolean> {
  try {
    const out = await run("ffprobe", [
      "-v", "error", "-select_streams", "a",
      "-show_entries", "stream=index",
      "-of", "csv=p=0", input,
    ]);
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/** Extract 16kHz mono WAV (Whisper's preferred input). */
export async function extractAudio(input: string, output: string): Promise<void> {
  await run("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", output]);
}
