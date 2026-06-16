import { z } from "zod";

/**
 * Tool tags shown on each agent step (mirrors the design's `tool` badges).
 * Kept as a hint list rather than a hard enum so the live model has room to
 * label novel steps — the server validates shape, not vocabulary.
 */
export const AGENT_TOOLS = [
  "vision·asr",
  "edit",
  "reasoning",
  "reframe",
  "caption",
  "color",
  "audio",
] as const;
export type AgentTool = (typeof AGENT_TOOLS)[number];

/** One step in an agent edit plan. */
export const agentStepSchema = z.object({
  /** Imperative, present-tense label, e.g. "Removing silences & filler words". */
  label: z.string().min(1).max(80),
  /** Short tool tag, e.g. "edit", "reframe", "caption". */
  tool: z.string().min(1).max(24),
  /** One-line result summary, e.g. "14 cuts · −2:18 runtime". */
  result: z.string().min(1).max(80),
});
export type AgentStep = z.infer<typeof agentStepSchema>;

/** A full plan the agent proposes for a prompt or preset workflow. */
export const agentPlanSchema = z.object({
  /** Short title for the run, e.g. "Make a 60s vertical reel". */
  title: z.string().min(1).max(80),
  steps: z.array(agentStepSchema).min(1).max(12),
});
export type AgentPlan = z.infer<typeof agentPlanSchema>;

/** A preset workflow card shown in the agent's idle composer. */
export interface AgentWorkflowPreset {
  icon: string;
  title: string;
  sub: string;
}

/**
 * Canonical 7-step pipeline from the prototype. Used as the simulation fallback
 * when the server is unreachable, and as a few-shot example for the live agent.
 */
export const baseEditSteps: AgentStep[] = [
  { label: "Analyzing clips & transcript", tool: "vision·asr", result: "12 clips · 3 strong hooks found" },
  { label: "Removing silences & filler words", tool: "edit", result: "14 cuts · −2:18 runtime" },
  { label: "Selecting highlight moments", tool: "reasoning", result: "6 segments ranked by energy" },
  { label: "Reframing to 9:16", tool: "reframe", result: "speaker auto-tracked" },
  { label: "Writing punchy captions", tool: "caption", result: "47 lines · word-level timing" },
  { label: "Matching color to Wide_set", tool: "color", result: "consistent grade applied" },
  { label: "Scoring music + ducking dialogue", tool: "audio", result: "bed added · −12 LUFS" },
];

/** The four preset workflows offered in the agent composer. */
export const agentWorkflows: AgentWorkflowPreset[] = [
  { icon: "smartphone", title: "Make a 60s vertical reel", sub: "Cut highlights, reframe 9:16, caption, score" },
  { icon: "quote", title: "Find the best 3 quotes → teaser", sub: "Rank moments and assemble a 20s teaser" },
  { icon: "sparkles", title: "Clean audio + color match everything", sub: "De-noise, level, and grade all clips" },
  { icon: "clapperboard", title: "Build a trailer from the highlights", sub: "Hook, montage, CTA with music beats" },
];
