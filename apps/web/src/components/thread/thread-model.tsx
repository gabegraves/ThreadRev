import type { EvidenceEvent, EvidenceGraph, Finding } from "agent-core/shared";
import { threadMessages, type ThreadMessage } from "@/components/review-console/graph-utils";

export type DocChip = { sha256: string; document: string; revision?: string };

/** Something the reviewer did that belongs under a message: a card or a quiet decision row. */
export type InlineItem =
  | { kind: "card"; at: string; finding: Finding }
  | { kind: "silence"; at: string; reason: "gate_closed" | "no_finding" }
  | { kind: "refused"; at: string; run_id: string; bound_revision: string; current_revision: string; reason: string }
  | { kind: "superseded"; at: string; finding_id: string; superseded_by: string };

export type ThreadModel = {
  messages: ThreadMessage[];
  /** Every distinct trigger_ts in the log: a message that started any reviewer run. */
  triggers: Set<string>;
  docsByTs: Map<string, DocChip[]>;
  inlineByTs: Map<string, InlineItem[]>;
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function buildThreadModel(events: EvidenceEvent[], graph: EvidenceGraph): ThreadModel {
  const messages = threadMessages(events);
  const triggers = new Set<string>();
  const docsByTs = new Map<string, DocChip[]>();
  const inlineByTs = new Map<string, InlineItem[]>();
  const seenDocs = new Set<string>();
  const seenCards = new Set<string>();

  for (const ev of events) {
    if (ev.trigger_ts) triggers.add(ev.trigger_ts);
    switch (ev.kind) {
      case "document_read": {
        if (!ev.named_in_ts) break;
        const key = `${ev.named_in_ts}|${ev.sha256}`;
        if (seenDocs.has(key)) break;
        seenDocs.add(key);
        push(docsByTs, ev.named_in_ts, { sha256: ev.sha256, document: ev.document, revision: ev.revision });
        break;
      }
      case "finding_published": {
        const id = ev.finding.finding_id;
        if (!ev.trigger_ts || seenCards.has(id)) break;
        seenCards.add(id);
        // graph.findings carries the stale flip from finding_superseded; the event's copy says "live" forever.
        const finding = graph.findings.find((f) => f.finding_id === id) ?? ev.finding;
        push(inlineByTs, ev.trigger_ts, { kind: "card", at: ev.at, finding });
        break;
      }
      case "silence":
        if (ev.trigger_ts) push(inlineByTs, ev.trigger_ts, { kind: "silence", at: ev.at, reason: ev.reason });
        break;
      case "publish_refused":
        if (ev.trigger_ts) {
          push(inlineByTs, ev.trigger_ts, {
            kind: "refused",
            at: ev.at,
            run_id: ev.run_id,
            bound_revision: ev.bound_revision,
            current_revision: ev.current_revision,
            reason: ev.reason,
          });
        }
        break;
      case "finding_superseded": {
        const ts = ev.cause_ts ?? ev.trigger_ts;
        if (ts) push(inlineByTs, ts, { kind: "superseded", at: ev.at, finding_id: ev.finding_id, superseded_by: ev.superseded_by });
        break;
      }
      default:
        break;
    }
  }
  for (const items of inlineByTs.values()) items.sort((a, b) => a.at.localeCompare(b.at));
  return { messages, triggers, docsByTs, inlineByTs };
}
