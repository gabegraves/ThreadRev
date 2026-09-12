"use client";

import { Check, Copy, Waypoints } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { EvidenceGraph } from "agent-core/shared";
import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { fmtTime } from "@/components/review-console/graph-utils";
import { ChecksTable, RecordFields } from "./kv-table";
import { LINK, type RunRow } from "./runs-table";

function ThreadLink({ ts }: { ts: string }) {
  return (
    <Link href={`/thread?ts=${encodeURIComponent(ts)}`} className={LINK}>
      {ts}
    </Link>
  );
}

/** Kept for the graph page's run node, which has no row to read the refusal from. */
export function RefusalBlock({ bound, current, reason }: { bound: string; current: string; reason: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-hairline bg-overlay p-3" style={{ boxShadow: "inset 3px 0 0 var(--color-danger)" }}>
      <FieldGrid>
        <Field label="bound revision" value={<ThreadLink ts={bound} />} mono hint={fmtTime(bound)} />
        <Field label="current revision" value={<ThreadLink ts={current} />} mono hint={fmtTime(current)} />
      </FieldGrid>
      <p className="mt-3 text-[13px] leading-relaxed text-subtle max-w-[68ch]">{reason}</p>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(id).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    });
  }, [id]);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono" title={id}>
        {id}
      </span>
      <button type="button" onClick={copy} aria-label="Copy run id" className="shrink-0 text-faint transition-colors hover:text-foreground">
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
      </button>
    </span>
  );
}

export function RunDetail({ row, graph, className }: { row: RunRow | null; graph: EvidenceGraph; className?: string }) {
  if (!row) return <DetailPanel emptyMessage="Select a run." className={className} />;
  const { run } = row;
  const node = graph.nodes.find((n) => n.kind === "run" && n.id === run.run_id);
  return (
    <DetailPanel
      title={<CopyId id={run.run_id} />}
      subtitle={`${run.checker} v${run.version} · ${new Date(run.at).toLocaleString("en-US", { timeZone: "America/New_York" })}`}
      className={className}
    >
      <DetailSection title="Checks">
        <ChecksTable checks={run.checks} />
      </DetailSection>

      {run.error && (
        <DetailSection title="Error">
          <p className="text-[13px] leading-relaxed text-[var(--status-danger-fg)] max-w-[68ch]">{run.error}</p>
        </DetailSection>
      )}

      <DetailSection title="Inputs and outputs">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h5 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Inputs</h5>
            <RecordFields data={run.inputs} />
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Outputs</h5>
            <RecordFields data={run.outputs} />
          </div>
        </div>
      </DetailSection>

      {node && (
        <DetailSection title="Graph">
          <Link href={`/graph?node=${encodeURIComponent(node.id)}`} className="inline-flex items-center gap-1.5 text-[12px] text-accent-text underline-offset-2 hover:underline">
            <Waypoints className="h-3.5 w-3.5" strokeWidth={2} />
            Open in graph
          </Link>
        </DetailSection>
      )}
    </DetailPanel>
  );
}
