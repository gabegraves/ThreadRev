"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { EvidenceEvent } from "agent-core/shared";
import { DataTable, type Column } from "@/civic-ui/components/DataTable";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
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

export const LINK = "font-mono text-[12px] text-accent-text underline-offset-2 hover:underline";

/** Table cell: what the run produced, readable without opening the detail. */
function Result({ row }: { row: RunRow }) {
  if (row.refused) {
    return (
      <span className="block max-w-[44ch] truncate text-[var(--status-danger-fg)]" title={row.refused.reason}>
        refused: {row.refused.reason}
      </span>
    );
  }
  if (row.published.length === 0) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {row.published.map((id) => (
        <span key={id}>
          published{" "}
          <Link href={`/findings?id=${encodeURIComponent(id)}`} onClick={(e) => e.stopPropagation()} className={LINK}>
            {id}
          </Link>
        </span>
      ))}
    </span>
  );
}

export function RunsTable({ rows, selected, onSelect, loading }: { rows: RunRow[]; selected: string | null; onSelect: (id: string) => void; loading?: boolean }) {
  const columns = useMemo<Column<RunRow>[]>(
    () => [
      { key: "run_id", header: "run id", mono: true, cell: (r) => <span className="whitespace-nowrap">{r.run.run_id}</span> },
      { key: "checker", header: "checker", cell: (r) => <span>{r.run.checker} <span className="font-mono text-[11px] text-faint">v{r.run.version}</span></span> },
      {
        key: "trigger",
        header: "trigger",
        cell: (r) => (
          <span>
            {r.triggerFrom}{" "}
            {r.run.trigger_ts && (
              <Link href={hrefs.thread(r.run.trigger_ts)} onClick={(e) => e.stopPropagation()} className={`font-mono text-[11px] ${LINK_CLASS}`}>
                {r.run.trigger_ts}
              </Link>
            )}
          </span>
        ),
      },
      {
        key: "checks",
        header: "checks",
        cell: (r) => {
          const s = checkSummary(r.run.checks);
          return <CheckBar passed={s.passed} total={s.total} />;
        },
      },
      { key: "result", header: "result", cell: (r) => <Result row={r} /> },
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
      loading={loading}
      loadingRows={4}
      emptyMessage="No checker runs in this log."
    />
  );
}
