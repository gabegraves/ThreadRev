import type { EvidenceEvent } from "agent-core/shared";
import { SCENARIOS } from "@/lib/demo/scenarios";
import { WORKSPACE } from "@/lib/demo/workspace";
import { buildIndex, type IndexedMessage, tsNum, type WorkspaceIndex, type WorkspaceQuery } from "@/lib/workspace-index";

/** The exact-match index the reviewer searches, built once from the fixture export. */
export const INDEX: WorkspaceIndex = buildIndex(WORKSPACE);
export const BY_TS: Map<string, IndexedMessage> = new Map(INDEX.messages.map((m) => [m.ts, m]));
export const WORKSPACE_MESSAGE_COUNT = INDEX.messages.length;

/** Distinct units across every indexed message. */
export function distinctUnits(index: WorkspaceIndex): number {
  return index.byUnit.size;
}

/** Bar state, one field per WorkspaceQuery dimension. Empty string = not set. */
export type Filters = {
  channel: string;
  from: string;
  unit: string;
  document: string;
  quantity: string;
  keyword: string;
  changes_only: boolean;
  /** Sets before_ts to the selected scenario's trigger. */
  cutoff: boolean;
};

export const EMPTY_FILTERS: Filters = {
  channel: "",
  from: "",
  unit: "",
  document: "",
  quantity: "",
  keyword: "",
  changes_only: false,
  cutoff: false,
};

export function isFiltered(f: Filters): boolean {
  return Boolean(f.channel || f.from || f.unit || f.document || f.quantity.trim() || f.keyword.trim() || f.changes_only || f.cutoff);
}

export function toQuery(f: Filters, cutoffTs: string | undefined): WorkspaceQuery {
  const q: WorkspaceQuery = {};
  if (f.channel) q.channel = f.channel;
  if (f.from) q.from = f.from;
  if (f.unit) q.unit = f.unit;
  if (f.document) q.document = f.document;
  if (f.quantity.trim()) q.quantity = f.quantity.trim();
  if (f.keyword.trim()) q.keyword = f.keyword.trim();
  if (f.changes_only) q.changes_only = true;
  if (f.cutoff && cutoffTs) q.before_ts = cutoffTs;
  return q;
}

/** The contract types `query` as unknown-valued; keep only the fields queryIndex reads. */
export function toWorkspaceQuery(raw: Record<string, unknown>): WorkspaceQuery {
  const q: WorkspaceQuery = {};
  const str = (k: keyof WorkspaceQuery) => (typeof raw[k] === "string" && (raw[k] as string).length > 0 ? (raw[k] as string) : undefined);
  q.document = str("document");
  q.unit = str("unit");
  q.quantity = str("quantity");
  q.keyword = str("keyword");
  q.from = str("from");
  q.channel = str("channel");
  q.before_ts = str("before_ts");
  if (typeof raw.changes_only === "boolean") q.changes_only = raw.changes_only;
  if (typeof raw.limit === "number") q.limit = raw.limit;
  return q;
}

/** Bar state that reproduces a recorded query. `before_ts` maps onto the cutoff toggle. */
export function fromQuery(q: WorkspaceQuery): Filters {
  return {
    channel: q.channel?.replace(/^#/, "") ?? "",
    from: q.from ?? "",
    unit: q.unit ?? "",
    document: q.document ?? "",
    quantity: q.quantity ?? "",
    keyword: q.keyword ?? "",
    changes_only: Boolean(q.changes_only),
    cutoff: Boolean(q.before_ts),
  };
}

export type ReviewerSearch = {
  event_id: string;
  trigger_ts?: string;
  query: WorkspaceQuery;
  cutoff?: string;
  total: number;
  returned: number;
  hit_ts: string[];
};

/** The last workspace_search the reviewer recorded in this evidence log, if any. */
export function reviewerSearch(events: EvidenceEvent[]): ReviewerSearch | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.kind !== "workspace_search") continue;
    return {
      event_id: ev.event_id,
      trigger_ts: ev.trigger_ts,
      query: toWorkspaceQuery(ev.query),
      cutoff: ev.cutoff,
      total: ev.total,
      returned: ev.returned,
      hit_ts: ev.hit_ts,
    };
  }
  return null;
}

/** The ts the "cutoff at trigger" toggle pins before_ts to: the search's cutoff, else the latest trigger_ts. */
export function triggerCutoff(events: EvidenceEvent[], search: ReviewerSearch | null): string | undefined {
  if (search?.cutoff) return search.cutoff;
  let latest: string | undefined;
  for (const ev of events) {
    if (ev.trigger_ts && (latest === undefined || tsNum(ev.trigger_ts) > tsNum(latest))) latest = ev.trigger_ts;
  }
  return latest;
}

export type HitMark = "returned" | "hidden" | null;

/** How a row relates to the replayed search: returned to the reviewer, hidden by its cutoff, or neither. */
export function hitMark(ts: string, search: ReviewerSearch | null): HitMark {
  if (!search) return null;
  if (search.hit_ts.includes(ts)) return "returned";
  if (search.cutoff && tsNum(ts) > tsNum(search.cutoff)) return "hidden";
  return null;
}

export type Citation = {
  scenario_id: string;
  scenario_title: string;
  finding_id: string;
  status: "live" | "stale";
  locator?: string;
  quote?: string;
};

/** Findings across every demo scenario whose sources cite this message ts. */
export function citedBy(ts: string): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const s of SCENARIOS) {
    for (const ev of s.events) {
      if (ev.kind !== "finding_published") continue;
      const f = ev.finding;
      const key = `${s.id}|${f.finding_id}`;
      if (seen.has(key)) continue;
      const src = f.sources.find((x) => x.kind === "message" && x.id === ts);
      if (!src) continue;
      seen.add(key);
      out.push({ scenario_id: s.id, scenario_title: s.title, finding_id: f.finding_id, status: f.status, locator: src.locator, quote: src.quote });
    }
  }
  return out;
}
