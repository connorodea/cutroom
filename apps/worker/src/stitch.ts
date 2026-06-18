import { run, ffprobeDimensions, ffprobeHasAudio } from "./ffmpeg";

/**
 * Stitch / concatenate. Join several clips end-to-end into one. Inputs vary in size/SAR/pixel
 * format and may or may not have audio, so each is normalized (scaled+padded to a common frame,
 * setsar, yuv420p) before concat. Audio is kept only when EVERY clip has a track (concat needs a
 * consistent stream set); otherwise the result is video-only. The filter builder is pure +
 * unit-tested; runStitchPipeline probes the first clip's size + per-clip audio and runs ffmpeg.
 */

export interface StitchFilter {
  filter: string;
  maps: string[];
}

/**
 * Build the filter_complex + stream maps to concatenate `n` inputs at the common `width`x`height`.
 * Each input's video is scaled to fit, padded/centered, SAR-reset and forced to yuv420p; with audio,
 * each track is reformatted to 44.1kHz stereo so the streams match for concat.
 */
export function buildStitchFilter(n: number, width: number, height: number, withAudio: boolean): StitchFilter {
  const vparts: string[] = [];
  const aparts: string[] = [];
  const concatInputs: string[] = [];
  for (let i = 0; i < n; i++) {
    vparts.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`,
    );
    if (withAudio) {
      aparts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
      concatInputs.push(`[v${i}][a${i}]`);
    } else {
      concatInputs.push(`[v${i}]`);
    }
  }
  const parts = [...vparts, ...aparts];
  if (withAudio) {
    parts.push(`${concatInputs.join("")}concat=n=${n}:v=1:a=1[v][a]`);
    return { filter: parts.join(";"), maps: ["[v]", "[a]"] };
  }
  parts.push(`${concatInputs.join("")}concat=n=${n}:v=1:a=0[v]`);
  return { filter: parts.join(";"), maps: ["[v]"] };
}

export interface StitchResult {
  outputPath: string;
  clips: number;
  hadAudio: boolean;
}

/* v8 ignore start -- ffmpeg subprocess pipeline; verified by live integration tests on each deploy */
/**
 * Concatenate `inputPaths` (in order) into `${workDir}/${jobId}.mp4`. The common frame size is taken
 * from the first clip; audio is preserved only when every clip has a track. libx264 veryfast,
 * yuv420p, +faststart; AAC when audio is kept.
 */
export async function runStitchPipeline(
  inputPaths: string[],
  workDir: string,
  jobId: string,
): Promise<StitchResult> {
  const { width, height } = await ffprobeDimensions(inputPaths[0]);
  const audioFlags = await Promise.all(inputPaths.map((p) => ffprobeHasAudio(p)));
  const withAudio = audioFlags.every(Boolean);
  const { filter, maps } = buildStitchFilter(inputPaths.length, width, height, withAudio);
  const outputPath = `${workDir}/${jobId}.mp4`; // canonical served path (/api/media/:id)
  await run("ffmpeg", [
    "-y",
    ...inputPaths.flatMap((p) => ["-i", p]),
    "-filter_complex", filter,
    ...maps.flatMap((m) => ["-map", m]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...(withAudio ? ["-c:a", "aac"] : []),
    "-movflags", "+faststart",
    outputPath,
  ]);
  return { outputPath, clips: inputPaths.length, hadAudio: withAudio };
}
/* v8 ignore stop */
