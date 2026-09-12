"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DetailPanel, DetailSection } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { fmtAt } from "@/components/overview/metrics";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";
import { type EditProposal, proposalStatus } from "@/lib/edit-proposals";
import type { DocCitation, DocRow } from "./document-model";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
      aria-label={copied ? "Copied" : "Copy sha256"}
      title={copied ? "Copied" : "Copy full sha256"}
      className="-my-0.5 -mr-1 inline-flex size-5 items-center justify-center rounded-md text-faint transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
    >
      {copied ? <Check className="size-3" strokeWidth={2} /> : <Copy className="size-3" strokeWidth={1.75} />}
    </button>
  );
}

/** "section 3, line 2" → "L2"; anything else is shown verbatim. Never invents a number. */
function lineLabel(locator?: string): string {
  if (!locator) return "—";
  const m = /line\s+(\d+)/i.exec(locator);
  return m ? `L${m[1]}` : locator;
}

function Citation({ c }: { c: DocCitation }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_TONE[c.finding_status]}>{STATUS_LABEL[c.finding_status]}</StatusPill>
        <Link href={hrefs.finding(c.finding_id)} className={cn("font-mono text-[12px]", LINK_CLASS)}>
          {c.finding_id}
        </Link>
        <span className="text-[11px] uppercase tracking-[0.08em] text-faint">{c.locator ?? "—"}</span>
      </div>
      {c.quote ? (
        <blockquote className="flex gap-2.5 border-l-2 border-hairline-strong pl-3 text-[12px] leading-relaxed text-subtle">
          <span className="shrink-0 select-none font-mono text-[11px] tabular-nums text-faint" title={c.locator}>
            {lineLabel(c.locator)}
          </span>
          <span>{c.quote}</span>
        </blockquote>
      ) : (
        <p className="text-[12px] text-faint">no quote recorded</p>
      )}
    </li>
  );
}

/** Compact two-line `find → replace` block for one proposed edit. */
function EditRow({ edit }: { edit: { locator: string; find: string; replace: string; reason?: string } }) {
  return (
    <li className="flex flex-col gap-1 text-[13px] leading-relaxed">
      <span className="font-mono text-[11px] text-faint">{edit.locator}</span>
      <span className="text-subtle">
        <span className="line-through">{edit.find}</span> {"→"} <span className="font-medium text-foreground">{edit.replace}</span>
      </span>
      {edit.reason && <span className="text-[12px] text-faint">{edit.reason}</span>}
    </li>
  );
}

/** Edits section shared by run/finding/document detail panels: `find → replace`, decision, and — if written — the output file. */
export function EditsSection({ proposals }: { proposals: EditProposal[] }) {
  if (proposals.length === 0) return null;
  return (
    <DetailSection title="Edits">
      <ul className="flex flex-col gap-4">
        {proposals.map((p) => {
          const status = proposalStatus(p);
          return (
            <li key={p.proposal_id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-subtle">{p.proposal_id}</span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                {p.by && <span className="text-[12px] text-faint">by {p.by}</span>}
                {p.finding_id && (
                  <Link href={hrefs.finding(p.finding_id)} className={cn("font-mono text-[12px]", LINK_CLASS)}>
                    {p.finding_id}
                  </Link>
                )}
              </div>
              <ul className="flex flex-col gap-2 border-l-2 border-hairline-strong pl-3">
                {p.edits.map((e, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: edits within one proposal have no stable id
                  <EditRow key={i} edit={e} />
                ))}
              </ul>
              {p.applied && (
                <div className="text-[12px] text-subtle">
                  {p.applied.error ? (
                    <span className="text-[var(--status-danger-fg)]">error: {p.applied.error}</span>
                  ) : (
                    <>
                      wrote{" "}
                      <Link href={hrefs.document(p.applied.sha256)} className={cn("font-mono", LINK_CLASS)}>
                        {p.applied.output}
                      </Link>{" "}
                      <span className="font-mono text-[11px] text-faint">{p.applied.sha256.slice(0, 12)}…</span>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}

/** Body shared by the desktop DetailPanel and the mobile Drawer. */
export function DocumentDetailBody({ row, graphNodeIds }: { row: DocRow; graphNodeIds: Set<string> }) {
  return (
    <>
      {row.writtenByRev && <p className="text-[12px] text-faint">written by Rev on approval</p>}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">sha256</span>
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate font-mono text-[13px] text-foreground" title={row.sha256 ?? undefined}>
            {row.sha256 ?? "—"}
          </span>
          {row.sha256 && <CopyButton text={row.sha256} />}
        </span>
      </div>
      {row.sha256 && graphNodeIds.has(row.sha256) && (
        <Link href={hrefs.graph(row.sha256)} className={cn("text-[12px]", LINK_CLASS)}>
          Open in graph
        </Link>
      )}
      <DetailSection title="Cited by findings">
        {row.citations.length === 0 ? (
          <p className="text-[12px] text-faint">No finding cites this document.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {row.citations.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one finding may cite the same document at several locators
              <Citation key={`${c.finding_id}-${i}`} c={c} />
            ))}
          </ul>
        )}
      </DetailSection>
      {row.run_refs.length > 0 && (
        <DetailSection title="Checker runs">
          <ul className="flex flex-col gap-1">
            {row.run_refs.map((id) => (
              <li key={id}>
                <Link href={hrefs.run(id)} className={cn("font-mono text-[12px]", LINK_CLASS)}>
                  {id}
                </Link>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
      <EditsSection proposals={row.appliedEdits} />
    </>
  );
}

export function DocumentDetailPanel({ row, graphNodeIds }: { row: DocRow | null; graphNodeIds: Set<string> }) {
  if (!row) return <DetailPanel emptyMessage="Select a document to see who cites it." className="lg:sticky lg:top-4 lg:self-start" />;
  const meta = [row.line_count ? `${row.line_count} lines` : null, row.read_at ? `read ${fmtAt(row.read_at)}` : null, row.reader ?? null]
    .filter(Boolean)
    .join(" · ");
  return (
    <DetailPanel
      title={row.document}
      subtitle={meta || undefined}
      actions={<StatusPill tone={row.read ? "success" : "neutral"}>{row.read ? "read" : "named, not read"}</StatusPill>}
      className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
    >
      <DocumentDetailBody row={row} graphNodeIds={graphNodeIds} />
    </DetailPanel>
  );
}
