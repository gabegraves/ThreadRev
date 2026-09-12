import type { EvidenceEvent, EvidenceGraph, Finding, GraphNode } from "agent-core/shared";

export type ThreadMessage = {
  ts: string;
  from: string;
  text: string;
  is_change: boolean;
  is_bot: boolean;
  at: string;
};

/** message_read events deduped by ts, oldest first. */
export function threadMessages(events: EvidenceEvent[]): ThreadMessage[] {
  const byTs = new Map<string, ThreadMessage>();
  for (const ev of events) {
    if (ev.kind !== "message_read" || byTs.has(ev.ts)) continue;
    byTs.set(ev.ts, { ts: ev.ts, from: ev.from, text: ev.text, is_change: ev.is_change, is_bot: ev.is_bot, at: ev.at });
  }
  return [...byTs.values()].sort((a, b) => Number(a.ts) - Number(b.ts));
}

/** Slack ts → Date. */
export function tsToDate(ts: string): Date {
  return new Date(Number(ts.split(".")[0]) * 1000);
}

export function fmtTime(ts: string): string {
  const d = tsToDate(ts);
  return Number.isNaN(d.getTime())
    ? ts
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function findingById(graph: EvidenceGraph, id: string): Finding | undefined {
  return graph.findings.find((f) => f.finding_id === id);
}

/** Live first, then stale, each group in publish order. */
export function orderedFindings(graph: EvidenceGraph): Finding[] {
  return [...graph.findings.filter((f) => f.status === "live"), ...graph.findings.filter((f) => f.status !== "live")];
}

/**
 * Downstream = everything that depends on `id`. Every edge kind points from the
 * dependent to what it depends on, except `changes` (message → revision it
 * created). Used only when agent-core does not export downstreamOf.
 */
export function localDownstreamOf(graph: EvidenceGraph, id: string): Set<string> {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of graph.edges) {
      const next = e.kind === "changes" ? (e.from === cur ? e.to : null) : e.to === cur ? e.from : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** A change message plus the revision node it created, when one exists. */
export function changeDownstream(graph: EvidenceGraph, ts: string): Set<string> {
  const out = localDownstreamOf(graph, ts);
  const rev = graph.nodes.find((n) => n.kind === "revision" && n.data.ts === ts);
  if (rev) for (const id of localDownstreamOf(graph, rev.id)) out.add(id);
  out.add(ts);
  if (rev) out.add(rev.id);
  return out;
}

export function subgraph(graph: EvidenceGraph, keep: Set<string>): EvidenceGraph {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
  };
}

export type RunTrace = {
  trigger_ts: string;
  events: EvidenceEvent[];
  label: string;
};

/** Group events by trigger_ts, in first-seen order. */
export function runTraces(events: EvidenceEvent[]): RunTrace[] {
  const by = new Map<string, EvidenceEvent[]>();
  for (const ev of events) {
    const key = ev.trigger_ts ?? "untriggered";
    by.set(key, [...(by.get(key) ?? []), ev]);
  }
  return [...by.entries()].map(([trigger_ts, evs]) => {
    const run = evs.find((e) => e.kind === "check_run");
    const outcome = evs.find((e) => e.kind === "finding_published" || e.kind === "publish_refused" || e.kind === "silence");
    const suffix = run && run.kind === "check_run" ? run.run_id.slice(-4) : outcome?.kind ?? "";
    return { trigger_ts, events: evs, label: `${fmtTime(trigger_ts)} · ${suffix}` };
  });
}

export function nodeTitle(n: GraphNode): string {
  return `${n.kind} · ${n.label}`;
}
