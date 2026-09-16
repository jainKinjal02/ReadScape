/**
 * Turning thrown things into sentences a reader can act on.
 *
 * Three kinds of failure reach the UI, and they need different words:
 *
 *   - The network is unreachable. Supabase surfaces this as a
 *     `TypeError: Network request failed` or an `AuthRetryableFetchError`,
 *     neither of which means anything to a reader. This is also what a paused
 *     Supabase project looks like from the app's side.
 *   - Postgres rejected the write. The message is accurate but written for a
 *     DBA ("new row violates row-level security policy").
 *   - Something genuinely unexpected. Say so plainly rather than inventing a
 *     cause.
 */

const NETWORK_PATTERNS =
  /network request failed|failed to fetch|networkerror|network error|timed out|timeout|offline|econnrefused|enotfound/i;

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string };
  if (e.name === "AuthRetryableFetchError") return true;
  return typeof e.message === "string" && NETWORK_PATTERNS.test(e.message);
}

// Postgres / PostgREST codes worth translating. Anything not listed falls
// through to the generic message rather than leaking database vocabulary.
const CODE_MESSAGES: Record<string, string> = {
  "23505": "That's already in your library.",
  "23503": "That book is no longer available.",
  "23502": "Something required was missing. Please try again.",
  "42501": "You don't have permission to do that.",
  PGRST116: "We couldn't find that.",
};

export const OFFLINE_MESSAGE =
  "Can't reach ReadScape right now. Check your connection and try again.";

export function toUserMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;

  const e = error as { code?: string; message?: string };
  if (e?.code && CODE_MESSAGES[e.code]) return CODE_MESSAGES[e.code];

  // Pass a message through only if it reads like a sentence. Anything long,
  // or shaped like a code, is database noise.
  const msg = e?.message;
  if (
    typeof msg === "string" &&
    msg.trim().length > 0 &&
    msg.length <= 120 &&
    !/^[A-Z0-9_]+$/.test(msg.trim()) &&
    !/violates|constraint|relation |column |syntax error|jwt|policy/i.test(msg)
  ) {
    return msg;
  }

  return fallback;
}
