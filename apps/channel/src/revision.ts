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
  /\b(?:correction|corrected|instead of|is now|are now|changed?|changing|updated?|revis(?:ed|ion)|supersed\w*|scratch that|actually|bump(?:ed)? to|moving to|allows?\b|now,? not|not \d|now \d|will be r\d)/i;

/** Slack ts ("seconds.seq") or an ISO date (managed transcripts use occurredAt). */
export function tsNum(ts: string | undefined) {
  if (!ts) return -1;
  const n = Number(ts);
  if (Number.isFinite(n)) return n;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms / 1000 : -1;
}

/**
 * Unit tokens a run depends on, read off its checker inputs.
 *
 * Checker inputs name their unit in the key suffix — `R_ohm`, `timer_s`,
 * `C_F`, `tolerance_s` — so the run itself tells us which quantities matter
 * without hardcoding a checker's vocabulary here. Nested objects and arrays
 * are walked, because `capacitances[].C_F` is where the interesting one lives.
 */
export function unitsFromInputs(inputs: unknown, seen = new Set<string>()): string[] {
  if (Array.isArray(inputs)) {
    for (const v of inputs) unitsFromInputs(v, seen);
  } else if (inputs && typeof inputs === "object") {
    for (const [key, value] of Object.entries(inputs)) {
      const unit = key.includes("_") ? key.slice(key.lastIndexOf("_") + 1) : "";
      if (unit && unit.length <= 4 && !/^\d/.test(unit)) seen.add(unit);
      unitsFromInputs(value, seen);
    }
  }
  return [...seen];
}

/** SI prefixes a human might type in front of a unit, including plain "u" for micro. */
const PREFIX = "(?:[munpkMG]|µ|da)?";

/**
 * Does this message state a quantity in one of `units`?
 *
 * Deliberately broad. A false positive costs one refused publish and a
 * re-read; a false negative publishes a stale card as fresh, which is the
 * failure this whole guard exists to prevent.
 */
export function mentionsQuantity(text: string, units: string[]): boolean {
  for (const unit of units) {
    const u = unit === "ohm" ? "(?:ohms?|Ω)" : `${PREFIX}${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    if (new RegExp(`\\d[\\d.,]*\\s*${u}\\b`, "i").test(text)) return true;
  }
  return false;
}

/**
 * The ts of the latest non-bot message that reads as a change. Falls back to
 * `fallback` (normally the trigger message ts) when nothing in the thread
 * reads as a change.
 *
 * `units` widens the test beyond CHANGE_PATTERN: a message that simply states
 * a new quantity in a unit the run depends on ("we're going with 820 uF")
 * carries no change vocabulary at all, but it moves the revision just as
 * surely as "correction, it's 820 uF" does. Pass the run's own input units so
 * the guard closes on phrasing the pattern never anticipated.
 */
export function latestRevision(
  messages: RevisionMessage[],
  fallback: string,
  units: string[] = [],
): string {
  let best = fallback;
  for (const m of messages) {
    if (m.isBot || !m.ts) continue;
    if (!CHANGE_PATTERN.test(m.text) && !mentionsQuantity(m.text, units)) continue;
    if (tsNum(m.ts) > tsNum(best)) best = m.ts;
  }
  return best;
}
