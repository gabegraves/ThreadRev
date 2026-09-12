"use client";

import { Waypoints } from "lucide-react";
import Link from "next/link";
import type { EvidenceGraph } from "agent-core/shared";
import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { fmtTime } from "@/components/review-console/graph-utils";
import { asRefs, ChecksTable, checkSummary, KvTable, RefChips } from "./kv-table";
import { LINK, Outcome, type RunRow } from "./runs-table";

function ThreadLink({ ts }: { ts: string }) {
  return (
    <Link href={`/thread?ts=${encodeURIComponent(ts)}`} className={LINK}>
      {ts}
    </Link>
  );
}

export function RefusalBlock({ bound, current, reason }: { bound: string; current: string; reason: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-hairline bg-overlay p-3" style={{ boxShadow: "inset 3px 0 0 var(--color-danger)" }}>
      <FieldGrid>
        <Field label="bound revision" value={<ThreadLink ts={bound} />} mono hint={fmtTime(bound)} />
        <Field label="current revision" value={<ThreadLink ts={current} />} mono hint={fmtTime(current)} />
      </FieldGrid>
      <p className="mt-3 text-[12.5px] leading-relaxed text-subtle">{reason}</p>
    </div>
  );
}

export function RunDetail({ row, graph, className }: { row: RunRow | null; graph: EvidenceGraph; className?: string }) {
  if (!row) return <DetailPanel emptyMessage="Select a run to see its inputs, outputs and checks." className={className} />;
  const { run } = row;
  const s = checkSummary(run.checks);
  const node = graph.nodes.find((n) => n.kind === "run" && n.id === run.run_id);
  // Message refs open the thread at that ts; document refs stay chips.
  const refs = asRefs(run.evidence_refs);
  const messageRefs = refs.filter((r) => r.kind === "message");
  return (
    <DetailPanel
      title={<span className="font-mono">{run.run_id}</span>}
      subtitle={`${run.checker} v${run.version} · ${new Date(run.at).toLocaleString("en-US", { timeZone: "America/New_York" })}`}
      actions={
        <>
          <Outcome row={row} />
          {node && (
            <Link
              href={`/graph?node=${encodeURIComponent(node.id)}`}
              className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-hairline bg-overlay px-2 text-[12px] font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-foreground"
            >
              <Waypoints className="h-3.5 w-3.5" strokeWidth={2} />
              Open in graph
            </Link>
          )}
        </>
      }
      className={className}
    >
      <FieldGrid>
        <Field label="checker" value={run.checker} />
        <Field label="version" value={run.version} mono />
        <Field label="trigger" value={row.triggerFrom} hint={run.trigger_ts ? fmtTime(run.trigger_ts) : undefined} />
        <Field label="source message" value={run.trigger_ts ? <ThreadLink ts={run.trigger_ts} /> : "—"} mono />
        <Field
          label="finding"
          value={
            row.published.length === 0 ? (
              "—"
            ) : (
              <span className="flex flex-col gap-1">
                {row.published.map((id) => (
                  <Link key={id} href={`/findings?id=${encodeURIComponent(id)}`} className={LINK}>
                    {id}
                  </Link>
                ))}
              </span>
            )
          }
          mono
        />
        <Field label="checks" value={`${s.passed} / ${s.total}`} hint={s.passed === s.total ? "all pass" : `${s.total - s.passed} failed`} />
        <Field label="error" value={run.error ?? "none"} />
        <Field label="thread" value={run.thread} mono />
      </FieldGrid>

      {row.refused && (
        <DetailSection title="Refused">
          <RefusalBlock bound={row.refused.bound_revision} current={row.refused.current_revision} reason={row.refused.reason} />
        </DetailSection>
      )}

      <DetailSection title="Checks">
        <ChecksTable checks={run.checks} />
      </DetailSection>

      <DetailSection title="Outputs">
        <KvTable data={run.outputs} emptyMessage="Checker returned no outputs." />
      </DetailSection>

      <DetailSection title="Inputs">
        <KvTable data={run.inputs} emptyMessage="No inputs recorded." />
      </DetailSection>

      <DetailSection title="Evidence refs">
        <RefChips refs={refs.filter((r) => r.kind === "document")} />
        {messageRefs.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {messageRefs.map((r) => (
              <li key={r.id} className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="font-mono uppercase tracking-[0.08em] text-faint">msg</span>
                <ThreadLink ts={r.id} />
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
