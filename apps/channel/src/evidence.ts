/**
 * Evidence recording for the channel app. Never throws: a logging failure
 * must not break a review. Set EVIDENCE_LOG=off to disable (tests do).
 */
import { appendEvidence, isEvidenceLogDisabled, newEventId, type EvidenceEvent } from "agent-core";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type Draft = DistributiveOmit<EvidenceEvent, "event_id" | "at">;

export function record(draft: Draft): void {
  // One authority for what EVIDENCE_LOG means; this used to be a local string
  // comparison that agent-core did not share.
  if (isEvidenceLogDisabled()) return;
  try {
    appendEvidence({ ...draft, event_id: newEventId(), at: new Date().toISOString() } as EvidenceEvent);
  } catch (e) {
    console.warn("[evidence] not recorded:", (e as Error).message);
  }
}

/** Per-thread context the tools share within a process: trigger and evidence read. */
interface RunContext {
  trigger_ts?: string;
  documents: Array<{ sha256: string; named_in_ts?: string }>;
  changes: string[];
  /** Instructions addressed to the reviewer found inside evidence it read. */
  notices: string[];
}
const contexts = new Map<string, RunContext>();

/**
 * How many threads keep a run context in memory.
 *
 * One entry per conversation the bot has ever seen, in a process that is meant
 * to stay up. Evicting the least recently touched is safe: a context is
 * per-run scratch (trigger ts, documents read, notices), and it is rebuilt by
 * the next read_thread on that thread.
 */
const MAX_CONTEXTS = 500;

export function runContext(threadId: string): RunContext {
  let c = contexts.get(threadId);
  if (!c) {
    c = { documents: [], changes: [], notices: [] };
  } else {
    // Re-insert so insertion order tracks recency.
    contexts.delete(threadId);
  }
  contexts.set(threadId, c);
  while (contexts.size > MAX_CONTEXTS) {
    const oldest = contexts.keys().next().value;
    if (oldest === undefined) break;
    contexts.delete(oldest);
  }
  return c;
}

/** Stable conversation identity from whichever Thread shape the SDK hands us. */
export function threadKey(thread: object): string {
  const t = thread as { conversationKey?: string; threadId?: string; id?: string };
  return t.conversationKey ?? t.threadId ?? t.id ?? "unknown-thread";
}
