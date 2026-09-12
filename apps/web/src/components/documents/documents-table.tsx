"use client";

import { type Column, DataTable } from "@/civic-ui/components/DataTable";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { fmtTime } from "@/components/review-console/graph-utils";
import type { DocRow } from "./document-model";

const COLUMNS: Column<DocRow>[] = [
  {
    key: "document",
    header: "Document",
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium">{r.document}</span>
        {!r.read && <StatusPill tone="neutral">named, not read</StatusPill>}
      </span>
    ),
  },
  { key: "revision", header: "Revision", mono: true, cell: (r) => r.revision ?? "—" },
  {
    key: "sha256",
    header: "sha256",
    mono: true,
    cell: (r) => (r.sha256 ? <span title={r.sha256}>{r.sha256.slice(0, 12)}</span> : "—"),
  },
  { key: "lines", header: "Lines", align: "right", mono: true, cell: (r) => r.line_count ?? "—" },
  {
    key: "named_in",
    header: "Named in",
    cell: (r) =>
      r.named_in_ts ? (
        <span>
          <span className="text-foreground">{r.named_by ?? "—"}</span>
          <span className="ml-2 font-mono text-[11px] tabular-nums text-faint">{fmtTime(r.named_in_ts)}</span>
        </span>
      ) : (
        "—"
      ),
  },
  { key: "runs", header: "Read in runs", align: "right", mono: true, cell: (r) => r.run_count },
  { key: "cited", header: "Cited by findings", align: "right", mono: true, cell: (r) => r.citations.length },
];

export function DocumentsTable({
  rows,
  loading,
  selectedId,
  onSelect,
}: {
  rows: DocRow[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (row: DocRow) => void;
}) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowId={(r) => r.id}
      onRowClick={onSelect}
      focusedId={selectedId}
      loading={loading}
      loadingRows={4}
      emptyMessage="No documents were read or named in this thread."
    />
  );
}
