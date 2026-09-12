"use client";

import Link from "next/link";
import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { fmtTime } from "@/components/review-console/graph-utils";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";
import { setScenario } from "@/lib/demo/store";
import { citedBy } from "./workspace-model";
import { MarkPill, type WorkspaceRow } from "./workspace-table";

export function WorkspaceDetailBody({ row }: { row: WorkspaceRow }) {
  const citations = citedBy(row.ts);
  return (
    <>
      <FieldGrid>
        <Field label="Channel" value={`#${row.channel_name}`} mono />
        <Field label="Author" value={row.user_name} />
        <Field label="Time" value={fmtTime(row.ts)} />
        <Field label="ts" value={row.ts} mono />
        <Field label="Thread" value={row.thread_ts ? fmtTime(row.thread_ts) : "—"} hint={row.thread_ts ? "reply inside a thread" : "top-level message"} />
        <Field label="Reads as change" value={row.is_change ? <StatusPill tone="info">change</StatusPill> : "no"} />
      </FieldGrid>
      <DetailSection title="Text · verbatim">
        <blockquote className="whitespace-pre-wrap border-l-2 border-hairline-strong pl-3 text-[13px] leading-relaxed text-foreground">{row.text}</blockquote>
      </DetailSection>
      <DetailSection title="Quantities">
        {row.quantities.length === 0 ? (
          <p className="text-[12px] text-faint">No number with a recognised unit.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {row.quantities.map((q, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the same value+unit can occur twice in one message
              <li key={`${q.value}${q.unit}${i}`} className="flex items-baseline gap-2 text-[12.5px]">
                <span className="font-mono tabular-nums text-foreground">
                  {q.value} {q.unit}
                </span>
                <span className="min-w-0 truncate font-mono text-[11px] text-faint" title={q.context}>
                  {q.context ? `“${q.context}”` : "no words before it"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
      <DetailSection title="Documents">
        {row.documents.length === 0 ? (
          <p className="text-[12px] text-faint">No document attached or named.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {row.documents.map((d) => (
              <li key={d} className="rounded-[var(--radius-sm)] border border-hairline bg-overlay px-2 py-0.5 font-mono text-[11.5px] text-foreground">
                {d}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
      <DetailSection title="Cited by findings">
        {citations.length === 0 ? (
          <p className="text-[12px] text-faint">No finding in any demo scenario cites this message.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {citations.map((c) => (
              <li key={`${c.scenario_id}-${c.finding_id}`} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusPill>
                  {/* Findings lists every demo scenario, but the live log only shows its own; pin the scenario so the id resolves either way. */}
                  <Link
                    href={`/findings?id=${encodeURIComponent(c.finding_id)}`}
                    onClick={() => setScenario(c.scenario_id)}
                    className="font-mono text-[11px] text-accent-text underline-offset-2 hover:underline"
                  >
                    {c.finding_id}
                  </Link>
                  <span className="text-[11px] text-faint">{c.scenario_title}</span>
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
    </>
  );
}

export function WorkspaceDetailPanel({ row, className }: { row: WorkspaceRow | null; className?: string }) {
  if (!row) return <DetailPanel emptyMessage="Select a message to see its quantities and who cites it." className={className} />;
  return (
    <DetailPanel title={`${row.user_name} · #${row.channel_name}`} subtitle={`ts ${row.ts}`} actions={<MarkPill mark={row.mark} />} className={className}>
      <WorkspaceDetailBody row={row} />
    </DetailPanel>
  );
}
