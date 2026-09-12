"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { threadMessages } from "@/components/review-console/graph-utils";

export type DocCitation = {
  finding_id: string;
  finding_status: "live" | "stale";
  locator?: string;
  quote?: string;
  revision?: string;
};

export type DocRow = {
  /** sha256 when known, else `named:<filename>`. */
  id: string;
  document: string;
  revision?: string;
  sha256?: string;
  line_count?: number;
  named_in_ts?: string;
  /** `from` of the naming message, when that message was read. */
  named_by?: string;
  /** True when at least one document_read event carries this sha. */
  read: boolean;
  /** Distinct reviewer runs (trigger_ts) that read it. */
  run_count: number;
  citations: DocCitation[];
  /** check_run run_ids whose evidence_refs name this sha. */
  run_refs: string[];
};

export function buildDocumentRows(events: EvidenceEvent[], graph: EvidenceGraph): DocRow[] {
  const fromByTs = new Map(threadMessages(events).map((m) => [m.ts, m.from]));
  const rows = new Map<string, DocRow>();
  const runsBySha = new Map<string, Set<string>>();

  for (const ev of events) {
    if (ev.kind !== "document_read") continue;
    const runs = runsBySha.get(ev.sha256) ?? new Set<string>();
    runs.add(ev.trigger_ts ?? ev.event_id);
    runsBySha.set(ev.sha256, runs);
    if (rows.has(ev.sha256)) continue;
    rows.set(ev.sha256, {
      id: ev.sha256,
      document: ev.document,
      revision: ev.revision,
      sha256: ev.sha256,
      line_count: ev.line_count,
      named_in_ts: ev.named_in_ts,
      named_by: ev.named_in_ts ? fromByTs.get(ev.named_in_ts) : undefined,
      read: true,
      run_count: 0,
      citations: [],
      run_refs: [],
    });
  }
  for (const [sha, runs] of runsBySha) {
    const row = rows.get(sha);
    if (row) row.run_count = runs.size;
  }

  for (const f of graph.findings) {
    for (const s of f.sources) {
      if (s.kind !== "document") continue;
      const id = s.sha256 ?? `named:${s.id}`;
      let row = rows.get(id);
      if (!row) {
        row = { id, document: s.id, revision: s.revision, sha256: s.sha256, read: false, run_count: 0, citations: [], run_refs: [] };
        rows.set(id, row);
      }
      row.citations.push({ finding_id: f.finding_id, finding_status: f.status, locator: s.locator, quote: s.quote, revision: s.revision });
    }
  }

  for (const ev of events) {
    if (ev.kind !== "check_run") continue;
    for (const ref of ev.evidence_refs) {
      if (ref.kind !== "document") continue;
      const row = rows.get(ref.id);
      if (row && !row.run_refs.includes(ev.run_id)) row.run_refs.push(ev.run_id);
    }
  }

  return [...rows.values()].sort((a, b) => Number(b.read) - Number(a.read) || a.document.localeCompare(b.document));
}

/** True at the Tailwind `lg` breakpoint and above. False on the server and first paint. */
export function useIsLg(): boolean {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isLg;
}
