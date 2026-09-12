"use client";

import { useMemo } from "react";
import { type Column, DataTable } from "@/civic-ui/components/DataTable";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { fmtTime } from "@/components/review-console/graph-utils";
import type { IndexedMessage } from "@/lib/workspace-index";
import { type HitMark, hitMark, type ReviewerSearch } from "./workspace-model";

export type WorkspaceRow = IndexedMessage & { mark: HitMark };

export function toRows(messages: IndexedMessage[], search: ReviewerSearch | null): WorkspaceRow[] {
  return messages.map((m) => ({ ...m, mark: hitMark(m.ts, search) }));
}

export function MarkPill({ mark }: { mark: HitMark }) {
  if (mark === "returned") return <StatusPill tone="success">returned to reviewer</StatusPill>;
  if (mark === "hidden") return <StatusPill tone="neutral">after trigger, hidden</StatusPill>;
  return null;
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-subtle">
      {children}
    </span>
  );
}

const BASE: Column<WorkspaceRow>[] = [
  { key: "time", header: "Time", mono: true, cell: (r) => <span title={r.ts}>{fmtTime(r.ts)}</span> },
  { key: "channel", header: "Channel", mono: true, cell: (r) => `#${r.channel_name}` },
  { key: "author", header: "Author", cell: (r) => <span className="whitespace-nowrap">{r.user_name}</span> },
  {
    key: "text",
    header: "Text",
    width: "40ch",
    cell: (r) => (
      <span title={r.text} className="line-clamp-2 block max-w-[40ch] whitespace-normal py-1 text-[12.5px] leading-snug">
        {r.text}
      </span>
    ),
  },
  {
    key: "documents",
    header: "Documents",
    cell: (r) =>
      r.documents.length === 0 ? (
        <span className="text-faint">—</span>
      ) : (
        <span className="inline-flex flex-wrap gap-1">
          {r.documents.map((d) => (
            <Chip key={d}>{d}</Chip>
          ))}
        </span>
      ),
  },
  {
    key: "quantities",
    header: "Quantities",
    cell: (r) =>
      r.quantities.length === 0 ? (
        <span className="text-faint">—</span>
      ) : (
        <span className="inline-flex flex-wrap gap-1">
          {r.quantities.map((q, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the same value+unit can occur twice in one message
            <Chip key={`${q.value}${q.unit}${i}`} title={q.context}>
              {q.value} {q.unit}
            </Chip>
          ))}
        </span>
      ),
  },
];

const MARK: Column<WorkspaceRow> = { key: "search", header: "Reviewer's search", cell: (r) => (r.mark ? <MarkPill mark={r.mark} /> : <span className="text-faint">—</span>) };

export function WorkspaceTable({
  rows,
  replayActive,
  selectedTs,
  onSelect,
}: {
  rows: WorkspaceRow[];
  replayActive: boolean;
  selectedTs: string | null;
  onSelect: (row: WorkspaceRow) => void;
}) {
  const columns = useMemo(() => (replayActive ? [MARK, ...BASE] : BASE), [replayActive]);
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.ts}
      onRowClick={onSelect}
      focusedId={selectedTs}
      emptyMessage="No indexed message matches every set field. The reviewer would have seen nothing."
      className="min-w-0 self-start rounded-t-none"
    />
  );
}
