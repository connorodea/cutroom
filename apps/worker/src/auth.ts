/**
 * Token auth for the worker. Supports MULTIPLE keys (per-user/per-integration) via a
 * comma-separated list, while staying backward-compatible with a single token and opt-in
 * (no tokens configured → the API is open, e.g. for the same-origin editor).
 */

/** Parse a comma-separated token list into a set, trimming whitespace and dropping empties. */
export function parseTokens(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
  );
}

/**
 * Authorize a request's `Authorization` header against the configured token set.
 * Open (true) when the set is empty; otherwise requires `Authorization: Bearer <token>`
 * with a token present in the set.
 */
export function isAuthorized(authHeader: string | undefined, tokens: Set<string>): boolean {
  if (tokens.size === 0) return true;
  if (!authHeader) return false;
  const match = /^Bearer (.+)$/.exec(authHeader);
  return match ? tokens.has(match[1]) : false;
}
