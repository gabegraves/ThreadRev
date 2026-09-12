/**
 * Pure derivations over the evidence log. Every number a page shows comes
 * from one of these; nothing here is hardcoded or recomputed from a card.
 */
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import type { StatusTone } from "@/civic-ui/lib/status";
import { STATUS_TONE } from "@/lib/demo/status";
import { threadMessages } from "@/components/review-console/graph-utils";

export type EventKind = EvidenceEvent["kind"];

export const KIND_LABEL: Record<EventKind, string> = {
  message_read: "message read",
  document_read: "document read",
  check_run: "checker run",
  finding_published: "finding published",
  finding_superseded: "finding superseded",
  publish_refused: "publish refused",
  silence: "silence",
};

export const KIND_ORDER: EventKind[] = ["message_read", "document_read", "check_run", "finding_published", "finding_superseded", "publish_refused", "silence"];

/** Event kind → state tone. Hue is state only. */
export function kindTone(kind: EventKind): StatusTone {
  switch (kind) {
    case "finding_published":
      return STATUS_TONE.live;
    case "finding_superseded":
      return STATUS_TONE.stale;
    case "publish_refused":
      return STATUS_TONE.refused;
    default:
      return STATUS_TONE.neutral;
  }
}

/** Full literal class strings: Tailwind only emits what it sees verbatim. */
export const TONE_DOT_CLASS: Record<StatusTone, string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-[#5b6b8c]",
  neutral: "bg-faint",
};

export function countByKind(events: EvidenceEvent[]): { kind: EventKind; count: number }[] {
  const m = new Map<EventKind, number>();
  for (const ev of events) m.set(ev.kind, (m.get(ev.kind) ?? 0) + 1);
  return KIND_ORDER.map((kind) => ({ kind, count: m.get(kind) ?? 0 })).filter((r) => r.count > 0);
}

export type RunChecks = { run_id: string; checker: string; at: string; pass: number; fail: number; error: string | null };

/** One row per check_run event: pass/fail counts from checks[]. */
export function runChecks(events: EvidenceEvent[]): RunChecks[] {
  const out: RunChecks[] = [];
  for (const ev of events) {
    if (ev.kind !== "check_run") continue;
    const pass = ev.checks.filter((c) => c.pass).length;
    out.push({ run_id: ev.run_id, checker: ev.checker, at: ev.at, pass, fail: ev.checks.length - pass, error: ev.error });
  }
  return out;
}

export function checkTotals(events: EvidenceEvent[]): { runs: number; pass: number; total: number } {
  return runChecks(events).reduce(
    (acc, r) => ({ runs: acc.runs + 1, pass: acc.pass + r.pass, total: acc.total + r.pass + r.fail }),
    { runs: 0, pass: 0, total: 0 },
  );
}

/** Distinct documents by sha256, same rule as the sidebar count. */
export function documentsRead(events: EvidenceEvent[]): { sha256: string; document: string; revision?: string; reads: number }[] {
  const m = new Map<string, { sha256: string; document: string; revision?: string; reads: number }>();
  for (const ev of events) {
    if (ev.kind !== "document_read") continue;
    const cur = m.get(ev.sha256);
    if (cur) cur.reads += 1;
    else m.set(ev.sha256, { sha256: ev.sha256, document: ev.document, revision: ev.revision, reads: 1 });
  }
  return [...m.values()];
}

/** Deduped thread messages grouped by author, most active first. */
export function messagesPerEngineer(events: EvidenceEvent[]): { from: string; count: number; changes: number }[] {
  const m = new Map<string, { from: string; count: number; changes: number }>();
  for (const msg of threadMessages(events)) {
    const cur = m.get(msg.from) ?? { from: msg.from, count: 0, changes: 0 };
    cur.count += 1;
    if (msg.is_change) cur.changes += 1;
    m.set(msg.from, cur);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

/** Findings by current state (graph carries post-supersession status) plus refused runs. */
export function findingStates(graph: EvidenceGraph, events: EvidenceEvent[]): { live: number; stale: number; refused: number } {
  return {
    live: graph.findings.filter((f) => f.status === "live").length,
    stale: graph.findings.filter((f) => f.status === "stale").length,
    refused: events.filter((e) => e.kind === "publish_refused").length,
  };
}

/** Findings are in publish order, latest last; the newest live card leads. */
export function latestLiveFinding(graph: EvidenceGraph) {
  return [...graph.findings].reverse().find((f) => f.status === "live") ?? null;
}

export function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** One-line subject for an event row: who or what it touched. */
export function eventSubject(ev: EvidenceEvent): string {
  switch (ev.kind) {
    case "message_read":
      return `${ev.from}${ev.is_change ? " · change" : ""}`;
    case "document_read":
      return `${ev.document}${ev.revision ? ` · ${ev.revision}` : ""}`;
    case "check_run":
      return `${ev.checker} v${ev.version} · ${ev.run_id}`;
    case "finding_published":
      return ev.finding.finding_id;
    case "finding_superseded":
      return `${ev.finding_id} → ${ev.superseded_by}`;
    case "publish_refused":
      return `${ev.run_id} · ${ev.reason}`;
    case "silence":
      return ev.reason;
  }
}

/** Series palette for data (not state). deep-void is skipped: it is #000 and vanishes in dark. */
export const SERIES = ["var(--fg-electric-indigo)", "var(--fg-emerald-glow)", "var(--fg-amber-pulse)", "var(--fg-neon-coral)", "var(--fg-cyan-burst)"] as const;
