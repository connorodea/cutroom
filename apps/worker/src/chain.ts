/**
 * Result-action chaining: run another op on an existing rendered output (by id) instead of a
 * fresh upload — e.g. Create → captions → reframe. Pure validation lives here; the route resolves
 * the id to `${MEDIA_DIR}/${id}.mp4` and dispatches to the matching job factory.
 */

export const CHAIN_OPS = ["reframe", "captions", "speed", "color", "rotate", "audio", "fade", "reverse"] as const;
export type ChainOp = (typeof CHAIN_OPS)[number];

/** Sanitize an output id to a safe filename stem (defends against path traversal). null if empty. */
export function safeOutputId(id: string): string | null {
  const clean = id.replace(/[^a-zA-Z0-9-]/g, "");
  return clean.length > 0 ? clean : null;
}

/** Validate an untrusted chain op against the supported set. */
export function parseChainOp(op: unknown): ChainOp | null {
  return typeof op === "string" && (CHAIN_OPS as readonly string[]).includes(op) ? (op as ChainOp) : null;
}
