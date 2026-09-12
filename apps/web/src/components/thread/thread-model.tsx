import type { EvidenceEvent, EvidenceGraph, Finding } from "agent-core/shared";
import { threadMessages, type ThreadMessage } from "@/components/review-console/graph-utils";

export type DocChip = { sha256: string; document: string; revision?: string };

/** Something the reviewer did that belongs under a message: a card or a quiet decision row. */
export type InlineItem =
  | { kind: "card"; at: string; finding: Finding }
  | { kind: "silence"; at: string; reason: "gate_closed" | "no_finding" }
  | { kind: "refused"; at: string; run_id: string; bound_revision: string; current_revision: string; reason: string }
  | { kind: "superseded"; at: string; finding_id: string; superseded_by: string };

/** A message the reviewer found through search_workspace, not in the thread transcript. */
export type WorkspaceHitItem = { ts: string; channel: string; from: string; text: string; is_change: boolean; at: string };

export type ThreadModel = {
  /** Thread transcript only: message_read events that came via the thread. */
  messages: ThreadMessage[];
  /** Every distinct trigger_ts in the log: a message that started any reviewer run. */
  triggers: Set<string>;
  docsByTs: Map<string, DocChip[]>;
  inlineByTs: Map<string, InlineItem[]>;
  /** trigger_ts → messages read via workspace_search during that run, deduped by ts, oldest first. */
  workspaceHitsByTrigger: Map<string, WorkspaceHitItem[]>;
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function buildThreadModel(events: EvidenceEvent[], graph: EvidenceGraph): ThreadModel {
  // Workspace hits are not part of the thread; the same ts can appear via both, so filter by event, not by ts.
  const messages = threadMessages(events.filter((ev) => !(ev.kind === "message_read" && ev.via === "workspace_search")));
  const triggers = new Set<string>();
  const docsByTs = new Map<string, DocChip[]>();
  const inlineByTs = new Map<string, InlineItem[]>();
  const workspaceHitsByTrigger = new Map<string, WorkspaceHitItem[]>();
  const seenDocs = new Set<string>();
  const seenCards = new Set<string>();
  const seenHits = new Set<string>();

  for (const ev of events) {
    if (ev.trigger_ts) triggers.add(ev.trigger_ts);
    switch (ev.kind) {
      case "message_read": {
        if (ev.via !== "workspace_search" || !ev.trigger_ts) break;
        const key = `${ev.trigger_ts}|${ev.ts}`;
        if (seenHits.has(key)) break;
        seenHits.add(key);
        push(workspaceHitsByTrigger, ev.trigger_ts, { ts: ev.ts, channel: ev.channel ?? "—", from: ev.from, text: ev.text, is_change: ev.is_change, at: ev.at });
        break;
      }
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
  for (const hits of workspaceHitsByTrigger.values()) hits.sort((a, b) => Number(a.ts) - Number(b.ts));
  return { messages, triggers, docsByTs, inlineByTs, workspaceHitsByTrigger };
}
