"use client";

import { useMemo } from "react";
import type { EvidenceEvent } from "agent-core/shared";
import { DataTable, type Column } from "@/civic-ui/components/DataTable";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { CheckBar, checkSummary } from "./kv-table";

export type CheckRunEvent = Extract<EvidenceEvent, { kind: "check_run" }>;
export type RefusedEvent = Extract<EvidenceEvent, { kind: "publish_refused" }>;

export type RunRow = {
  run: CheckRunEvent;
  triggerFrom: string;
  /** finding ids published from this run (usually 0 or 1). */
  published: string[];
  refused: RefusedEvent | null;
};

/** One row per check_run, joined to its trigger message and its outcome. */
export function runRows(events: EvidenceEvent[]): RunRow[] {
  return events.flatMap((ev) => {
    if (ev.kind !== "check_run") return [];
    const trigger = events.find((e) => e.kind === "message_read" && e.ts === ev.trigger_ts);
    const published = events.flatMap((e) => (e.kind === "finding_published" && e.finding.checker_run.run_id === ev.run_id ? [e.finding.finding_id] : []));
    const refused = events.find((e): e is RefusedEvent => e.kind === "publish_refused" && e.run_id === ev.run_id) ?? null;
    return [{ run: ev, triggerFrom: trigger && trigger.kind === "message_read" ? trigger.from : (ev.trigger_ts ?? "—"), published, refused }];
  });
}

export function Outcome({ row }: { row: RunRow }) {
  if (row.published.length === 0 && !row.refused) return <StatusPill tone="neutral">none</StatusPill>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {row.published.map((id) => (
        <StatusPill key={id} tone="success">published · <span className="font-mono">{id}</span></StatusPill>
      ))}
      {row.refused && <StatusPill tone="danger">refused</StatusPill>}
    </span>
  );
}

export function RunsTable({ rows, selected, onSelect }: { rows: RunRow[]; selected: string | null; onSelect: (id: string) => void }) {
  const columns = useMemo<Column<RunRow>[]>(
    () => [
      { key: "run_id", header: "run id", mono: true, cell: (r) => r.run.run_id },
      { key: "checker", header: "checker", cell: (r) => <span>{r.run.checker} <span className="font-mono text-[11px] text-faint">v{r.run.version}</span></span> },
      { key: "trigger", header: "trigger", cell: (r) => <span>{r.triggerFrom} <span className="font-mono text-[11px] text-faint">{r.run.trigger_ts ?? ""}</span></span> },
      {
        key: "checks",
        header: "checks",
        cell: (r) => {
          const s = checkSummary(r.run.checks);
          return <CheckBar passed={s.passed} total={s.total} />;
        },
      },
      { key: "error", header: "error", cell: (r) => (r.run.error ? <span className="text-[var(--status-danger-fg)]">{r.run.error}</span> : <span className="text-faint">—</span>) },
      { key: "outcome", header: "outcome", cell: (r) => <Outcome row={r} /> },
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.run.run_id}
      focusedId={selected}
      onRowClick={(r) => onSelect(r.run.run_id)}
      emptyMessage="No checker runs in this log."
    />
  );
}
