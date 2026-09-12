/**
 * Requirements revision tracking, as pure functions so the replay harness and
 * the live tool share them.
 *
 * A thread's current revision is the ts of the latest human message that
 * changes a requirement or an input. A card is bound to the revision it was
 * computed against; publishing is refused when the thread has moved on.
 */

export interface RevisionMessage {
  ts?: string;
  text: string;
  isBot?: boolean;
}

/** Phrases that mark a message as changing an input or requirement. */
export const CHANGE_PATTERN =
  /\b(correction|corrected|instead of|is now|are now|now \d|changed?|changing|updated?|revis(?:ed|ion)|supersed\w*|scratch that|actually|not \d|bump(?:ed)? to|moving to|will be r\d)\b/i;

function tsNum(ts: string | undefined) {
  const n = Number(ts);
  return Number.isFinite(n) ? n : -1;
}

/**
 * The ts of the latest non-bot message that reads as a change. Falls back to
 * `fallback` (normally the trigger message ts) when nothing in the thread
 * reads as a change.
 */
export function latestRevision(messages: RevisionMessage[], fallback: string): string {
  let best = fallback;
  for (const m of messages) {
    if (m.isBot || !m.ts) continue;
    if (!CHANGE_PATTERN.test(m.text)) continue;
    if (tsNum(m.ts) > tsNum(best)) best = m.ts;
  }
  return best;
}
