import { downstreamOf, revisionNodeId, type EvidenceEvent, type EvidenceGraph, type Finding, type GraphNode } from "agent-core/shared";

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

/** A change message plus the revision node it created, when one exists. */
export function changeDownstream(graph: EvidenceGraph, ts: string): Set<string> {
  const out = new Set<string>(downstreamOf(graph, ts).nodes);
  const rev = revisionNodeId(ts);
  if (graph.nodes.some((n) => n.id === rev)) for (const id of downstreamOf(graph, rev).nodes) out.add(id);
  out.add(ts);
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
  hasRun: boolean;
};

/** Group events by trigger_ts, ordered by each run's first event time. */
export function runTraces(events: EvidenceEvent[]): RunTrace[] {
  const by = new Map<string, EvidenceEvent[]>();
  for (const ev of events) {
    const key = ev.trigger_ts ?? "untriggered";
    by.set(key, [...(by.get(key) ?? []), ev]);
  }
  return [...by.entries()].sort((a, b) => a[1][0].at.localeCompare(b[1][0].at)).map(([trigger_ts, evs]) => {
    const run = evs.find((e) => e.kind === "check_run");
    const outcome = evs.find((e) => e.kind === "finding_published" || e.kind === "publish_refused" || e.kind === "silence");
    const suffix = run && run.kind === "check_run" ? run.run_id.slice(-4) : outcome?.kind ?? "";
    return { trigger_ts, events: evs, label: `${fmtTime(trigger_ts)} · ${suffix}`, hasRun: Boolean(run) };
  });
}

/** Latest trace that ran a checker, else the latest trace. */
export function defaultTrace(traces: RunTrace[]): RunTrace | undefined {
  return [...traces].reverse().find((t) => t.hasRun) ?? traces[traces.length - 1];
}

export function nodeTitle(n: GraphNode): string {
  return `${n.kind} · ${n.label}`;
}
