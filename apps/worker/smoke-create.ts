import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCreatePipeline } from "./src/create";

const workDir = await mkdtemp(join(tmpdir(), "cutroom-create-"));
console.log("workDir:", workDir);

const result = await runCreatePipeline(
  {
    script: [
      { text: "The ocean stretches further than the eye can see.", query: "ocean waves" },
      { text: "City lights flicker awake as night falls.", query: "city skyline night" },
    ],
    aspect: "landscape",
    captions: true,
  },
  workDir,
  "smoke",
);

console.log("RESULT:", JSON.stringify(result, null, 2));
