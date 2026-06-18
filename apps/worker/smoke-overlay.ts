import { mkdtemp, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOverlays } from "./src/overlay";
import { ffprobeDimensions } from "./src/ffmpeg";

const input = process.argv[2] ?? "/tmp/cutroom-create-live.mp4";
const workDir = await mkdtemp(join(tmpdir(), "cutroom-overlay-"));
const dims = await ffprobeDimensions(input);
console.log("input:", input, "dims:", dims, "workDir:", workDir);

const result = await applyOverlays(
  input,
  [
    { type: "title", text: "How AI edits video", subtitle: "Cutroom", start: 0, end: 2.5 },
    { type: "lower_third", text: "Connor O'Dea", subtitle: "Founder, Cutroom", start: 1.5, end: 5 },
    { type: "callout", text: "3x faster", x: 0.72, y: 0.28, start: 2.5, end: 5 },
    { type: "badge", text: "LIVE", corner: "tr", start: 0, end: 6 },
  ],
  dims,
  workDir,
  "smoke",
);

await copyFile(result.outputPath, "/tmp/cutroom-overlay-out.mp4");
console.log("RESULT:", JSON.stringify(result), "→ /tmp/cutroom-overlay-out.mp4");
