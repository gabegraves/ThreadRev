/**
 * Evidence recording for the channel app. Never throws: a logging failure
 * must not break a review. Set EVIDENCE_LOG=off to disable (tests do).
 */
import { appendEvidence, newEventId, type EvidenceEvent } from "agent-core";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type Draft = DistributiveOmit<EvidenceEvent, "event_id" | "at">;

export function record(draft: Draft): void {
  if (process.env.EVIDENCE_LOG === "off") return;
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
}
const contexts = new Map<string, RunContext>();

export function runContext(threadId: string): RunContext {
  let c = contexts.get(threadId);
  if (!c) {
    c = { documents: [], changes: [] };
    contexts.set(threadId, c);
  }
  return c;
}

/** Stable conversation identity from whichever Thread shape the SDK hands us. */
export function threadKey(thread: object): string {
  const t = thread as { conversationKey?: string; threadId?: string; id?: string };
  return t.conversationKey ?? t.threadId ?? t.id ?? "unknown-thread";
}
