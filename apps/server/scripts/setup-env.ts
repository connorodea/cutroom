/** One-time setup: create a reusable cloud environment and print its id for `.env`. */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const env = await client.beta.environments.create({
  name: "cutroom-agent",
  config: { type: "cloud", networking: { type: "unrestricted" } },
});

console.log(`CUTROOM_AGENT_ENV_ID=${env.id}`);
