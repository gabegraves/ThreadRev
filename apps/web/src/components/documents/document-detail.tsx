"use client";

import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { fmtTime } from "@/components/review-console/graph-utils";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";
import type { DocRow } from "./document-model";

/** Body shared by the desktop DetailPanel and the mobile Drawer. */
export function DocumentDetailBody({ row, onOpenFinding }: { row: DocRow; onOpenFinding: (id: string) => void }) {
  return (
    <>
      <FieldGrid>
        <Field label="Revision" value={row.revision ?? "—"} mono />
        <Field label="Lines" value={row.line_count ?? "—"} />
        <Field label="Read in runs" value={row.run_count} />
        <Field label="Named in" value={row.named_in_ts ? `${row.named_by ?? "—"} · ${fmtTime(row.named_in_ts)}` : "—"} />
      </FieldGrid>
      <Field label="sha256" value={row.sha256 ?? "—"} mono hint={row.read ? "exact bytes the reviewer read" : "no document_read event carries this digest"} />
      <DetailSection title="Cited by findings">
        {row.citations.length === 0 ? (
          <p className="text-[12px] text-faint">No finding cites this document.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {row.citations.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one finding may cite the same document at several locators
              <li key={`${c.finding_id}-${i}`} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={STATUS_TONE[c.finding_status]}>{STATUS_LABEL[c.finding_status]}</StatusPill>
                  <button
                    type="button"
                    onClick={() => onOpenFinding(c.finding_id)}
                    className="font-mono text-[11px] text-accent-text underline-offset-2 hover:underline"
                  >
                    {c.finding_id}
                  </button>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{c.locator ?? "—"}</span>
                </div>
                {c.quote ? (
                  <blockquote className="border-l-2 border-hairline-strong pl-3 text-[12.5px] leading-relaxed text-subtle">{c.quote}</blockquote>
                ) : (
                  <p className="text-[12px] text-faint">— no quote recorded</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
      <DetailSection title="Checker runs referencing it">
        {row.run_refs.length === 0 ? (
          <p className="text-[12px] text-faint">No check_run lists this digest in evidence_refs.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {row.run_refs.map((id) => (
              <li key={id} className="font-mono text-[12px] text-foreground">
                {id}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </>
  );
}

export function DocumentDetailPanel({ row, onOpenFinding }: { row: DocRow | null; onOpenFinding: (id: string) => void }) {
  if (!row) return <DetailPanel emptyMessage="Select a document to see who cites it." className="lg:sticky lg:top-4 lg:self-start" />;
  return (
    <DetailPanel
      title={row.document}
      subtitle={row.sha256 ?? "no digest recorded"}
      actions={<StatusPill tone={row.read ? "success" : "neutral"}>{row.read ? "read" : "named, not read"}</StatusPill>}
      className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
    >
      <DocumentDetailBody row={row} onOpenFinding={onOpenFinding} />
    </DetailPanel>
  );
}
