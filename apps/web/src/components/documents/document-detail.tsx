"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DetailPanel, DetailSection } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { fmtAt } from "@/components/overview/metrics";
import { fmtTime } from "@/components/review-console/graph-utils";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";
import type { DocCitation, DocRow } from "./document-model";

const CHIP = "inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 py-1 text-[12px] text-subtle";

function Chip({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <span className={CHIP}>
      {label} <span className={cn("font-semibold text-foreground", mono && "font-mono")}>{value}</span>
    </span>
  );
}

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

function Citation({ c, graphLinked }: { c: DocCitation; graphLinked: boolean }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_TONE[c.finding_status]}>{STATUS_LABEL[c.finding_status]}</StatusPill>
        <Link href={hrefs.finding(c.finding_id)} className={cn("font-mono text-[11px]", LINK_CLASS)}>
          {c.finding_id}
        </Link>
        {graphLinked && (
          <Link href={hrefs.graph(c.finding_id)} className={cn("text-[11px]", LINK_CLASS)}>
            Open in graph
          </Link>
        )}
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{c.locator ?? "—"}</span>
      </div>
      {c.quote ? (
        <blockquote className="flex gap-2.5 border-l-2 border-hairline-strong pl-3 text-[12.5px] leading-relaxed text-subtle">
          <span className="shrink-0 select-none font-mono text-[11px] tabular-nums text-faint" title={c.locator}>
            {lineLabel(c.locator)}
          </span>
          <span>{c.quote}</span>
        </blockquote>
      ) : (
        <p className="text-[12px] text-faint">— no quote recorded</p>
      )}
    </li>
  );
}

/** Body shared by the desktop DetailPanel and the mobile Drawer. */
export function DocumentDetailBody({ row, graphNodeIds }: { row: DocRow; graphNodeIds: Set<string> }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip label="revision" value={row.revision ?? "—"} mono />
        {row.sha256 ? (
          <span className={CHIP} title={row.sha256}>
            sha256 <span className="font-mono font-semibold text-foreground">{row.sha256.slice(0, 12)}</span>
            <CopyButton text={row.sha256} />
          </span>
        ) : (
          <Chip label="sha256" value="—" mono />
        )}
        <Chip label="lines" value={row.line_count ?? "—"} mono />
        <Chip label="reader" value={row.reader ?? "—"} />
        <Chip label="read at" value={row.read_at ? fmtAt(row.read_at) : "—"} mono />
        {row.named_in_ts && (
          <span className={CHIP}>
            named in{" "}
            <Link href={hrefs.thread(row.named_in_ts)} className={cn("font-mono font-semibold", LINK_CLASS)}>
              {fmtTime(row.named_in_ts)}
            </Link>
          </span>
        )}
        {row.sha256 && graphNodeIds.has(row.sha256) && (
          <Link href={hrefs.graph(row.sha256)} className={cn("text-[12px]", LINK_CLASS)}>
            Open in graph
          </Link>
        )}
      </div>
      <p className="text-[11px] text-faint">{row.read ? "sha256 is the digest of the exact bytes the reviewer read" : "no document_read event carries this digest"}</p>
      <DetailSection title="Cited by findings">
        {row.citations.length === 0 ? (
          <p className="text-[12px] text-faint">No finding cites this document.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {row.citations.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one finding may cite the same document at several locators
              <Citation key={`${c.finding_id}-${i}`} c={c} graphLinked={graphNodeIds.has(c.finding_id)} />
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
              <li key={id}>
                <Link href={hrefs.run(id)} className={cn("font-mono text-[12px]", LINK_CLASS)}>
                  {id}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </>
  );
}

export function DocumentDetailPanel({ row, graphNodeIds }: { row: DocRow | null; graphNodeIds: Set<string> }) {
  if (!row) return <DetailPanel emptyMessage="Select a document to see who cites it." className="lg:sticky lg:top-4 lg:self-start" />;
  return (
    <DetailPanel
      title={row.document}
      subtitle={row.sha256 ?? "no digest recorded"}
      actions={<StatusPill tone={row.read ? "success" : "neutral"}>{row.read ? "read" : "named, not read"}</StatusPill>}
      className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
    >
      <DocumentDetailBody row={row} graphNodeIds={graphNodeIds} />
    </DetailPanel>
  );
}
