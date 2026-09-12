"use client";

import Link from "next/link";
import type { EvidenceEvent, EvidenceGraph, Finding } from "agent-core/shared";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { EmptyState } from "@/civic-ui/components/Tile";
import { cn } from "@/civic-ui/lib/cn";
import { timeAgo } from "@/civic/lib/grid/time-ago";
import { headline } from "@/components/findings/finding-card";
import { hrefs } from "@/lib/demo/links";
import { STATUS_LABEL, STATUS_TONE, cardKind } from "@/lib/demo/status";
import { publishedAt } from "./metrics";

export type AttentionRow = { finding: Finding; tone: "stale" | "question"; at?: string };

/** Stale cards and live cards that ask a question, newest first. */
export function attentionRows(graph: EvidenceGraph, events: EvidenceEvent[]): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const f of graph.findings) {
    if (f.status === "stale") rows.push({ finding: f, tone: "stale", at: publishedAt(events, f.finding_id) });
    else if (cardKind(f) === "question") rows.push({ finding: f, tone: "question", at: publishedAt(events, f.finding_id) });
  }
  return rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

export function NeedsAttention({ rows }: { rows: AttentionRow[] }) {
  if (rows.length === 0) return <EmptyState message="Nothing stale, nothing waiting on a decision" />;
  return (
    <ol className="flex flex-col">
      {rows.map((r, i) => (
        <li key={r.finding.finding_id} className={cn(i > 0 && "border-t border-hairline")}>
          <Link
            href={hrefs.finding(r.finding.finding_id)}
            className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-2.5 transition-colors hover:bg-overlay focus-visible:outline-2 focus-visible:outline-accent"
          >
            <StatusPill tone={STATUS_TONE[r.tone]} className="shrink-0">
              {STATUS_LABEL[r.tone]}
            </StatusPill>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {r.finding.discrepancy === "none" ? headline(r.finding) : r.finding.discrepancy}
            </span>
            <span className="shrink-0 font-mono text-[12px] text-subtle">{r.finding.finding_id}</span>
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-faint" title={r.at}>
              {r.at ? timeAgo(r.at) : "—"}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
