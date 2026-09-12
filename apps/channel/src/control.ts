/**
 * Telling the reviewer to stop.
 *
 * The reviewer speaks without being asked, which is the point of it — and the
 * reason it needs an off switch that does not require finding an admin. A
 * person who thinks it is wrong, or who already handled the thing it flagged,
 * should be able to say so in the thread, in the words they would use with a
 * colleague, and have it take effect immediately.
 *
 * Handled in code rather than left to the model: "stand down" has to work on
 * the turn it is said, and a gate that consults the model about whether it has
 * been told to be quiet is not a gate.
 */

export type Control = "mute" | "resume" | "explain";

/** Addressed to us, rather than to a person in the thread. */
const TO_US = /\b(?:@?reviewer|@?threadrev|@?bot\b|hey bot)\b/i;

const MUTE =
  /\b(?:stand down|stop|quiet|hush|mute|shush|drop it|leave it|back off|not relevant|not helpful|we know|already (?:fixed|handled|caught|covered)|ignore (?:this|that|it)|no more cards?)\b/i;

const RESUME = /\b(?:resume|carry on|continue|you can (?:come back|resume)|unmute|start again|back on)\b/i;

/** Asking what the reviewer actually did, rather than telling it to change. */
const EXPLAIN =
  /\b(?:show (?:your|the) work|how did you|what did you (?:read|do|check)|show (?:your|the) (?:trail|evidence|reasoning)|why did you|explain yourself)\b/i;

/**
 * What a human just told the reviewer to do, if anything.
 *
 * Requires the message to name the reviewer. Engineers say "stop" and "we
 * know" to each other constantly, and a bot that silences itself on overheard
 * conversation is a different bug from the one this fixes.
 */
export function parseControl(text: string, isHuman = true): Control | undefined {
  if (!isHuman) return undefined;
  if (!TO_US.test(text)) return undefined;
  // Explain first: "reviewer, why did you stop on this one" asks a question,
  // it does not issue another stop.
  if (EXPLAIN.test(text)) return "explain";
  // Resume next: "reviewer, you can come back on" contains "back", and the
  // intent to restart should never be read as a stop.
  if (RESUME.test(text)) return "resume";
  if (MUTE.test(text)) return "mute";
  return undefined;
}

/** What the reviewer says back. Short, and it states how to undo itself. */
export function controlAck(control: Control): string {
  if (control === "mute") {
    return "Standing down in this thread. Say \"reviewer, resume\" and I'll pick it back up. Anything already posted stays.";
  }
  return "Back on in this thread.";
}
