/** Live validation: run the Cutroom Agent and print the plan it returns. */
import { generatePlan } from "../src/agent";

const prompt = process.argv.slice(2).join(" ") || "Make a 60s vertical reel from my interview footage";

const started = Date.now();
generatePlan(prompt, { deadlineMs: 180_000 })
  .then((result) => {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nsource: ${result.source}  (${secs}s)`);
    console.log(JSON.stringify(result.plan, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
