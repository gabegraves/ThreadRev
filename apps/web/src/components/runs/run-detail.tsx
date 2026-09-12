"use client";

import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { fmtTime } from "@/components/review-console/graph-utils";
import { asRefs, ChecksTable, checkSummary, KvTable, RefChips } from "./kv-table";
import { Outcome, type RunRow } from "./runs-table";

export function RefusalBlock({ bound, current, reason }: { bound: string; current: string; reason: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-hairline bg-overlay p-3" style={{ boxShadow: "inset 3px 0 0 var(--color-danger)" }}>
      <FieldGrid>
        <Field label="bound revision" value={bound} mono hint={fmtTime(bound)} />
        <Field label="current revision" value={current} mono hint={fmtTime(current)} />
      </FieldGrid>
      <p className="mt-3 text-[12.5px] leading-relaxed text-subtle">{reason}</p>
    </div>
  );
}

export function RunDetail({ row }: { row: RunRow | null }) {
  if (!row) return <DetailPanel emptyMessage="Select a run to see its inputs, outputs and checks." />;
  const { run } = row;
  const s = checkSummary(run.checks);
  return (
    <DetailPanel
      title={<span className="font-mono">{run.run_id}</span>}
      subtitle={`${run.checker} v${run.version} · ${new Date(run.at).toLocaleString()}`}
      actions={<Outcome row={row} />}
    >
      <FieldGrid>
        <Field label="checker" value={run.checker} />
        <Field label="version" value={run.version} mono />
        <Field label="trigger" value={row.triggerFrom} hint={run.trigger_ts ? fmtTime(run.trigger_ts) : undefined} />
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
        <RefChips refs={asRefs(run.evidence_refs)} />
      </DetailSection>
    </DetailPanel>
  );
}
