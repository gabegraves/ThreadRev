"use client";

/**
 * Right-column / drawer body for a selected finding: the full card, a
 * stale→live "What changed" diff when the card supersedes another, and the
 * finding_superseded / publish_refused events that touch it.
 */
import Link from "next/link";
import type { EvidenceEvent, EvidenceGraph, Finding } from "agent-core/shared";
import { cn } from "@/civic-ui/lib/cn";
import { findingById, fmtTime } from "@/components/review-console/graph-utils";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import { FindingCard, fmt } from "./finding-card";

const Id = ({ href, children }: { href: string; children: string }) => (
  <Link href={href} className={cn("font-mono normal-case tracking-normal", LINK_CLASS)}>
    {children}
  </Link>
);

type DiffRow = { label: string; before: string; after: string };

const reproText = (f: Finding) =>
  f.reproduced.map((r) => `${r.label}: ${r.printed !== undefined ? `printed ${fmt(r.printed)} → ` : ""}${fmt(r.computed)} ${r.unit}`).join("\n");

function diffRows(before: Finding, after: Finding): DiffRow[] {
  return [
    { label: "requirements_revision", before: before.requirements_revision, after: after.requirements_revision },
    { label: "discrepancy", before: before.discrepancy, after: after.discrepancy },
    { label: "reproduced", before: reproText(before), after: reproText(after) },
    { label: "resolution", before: before.resolution, after: after.resolution },
    { label: "question", before: before.question?.ask ?? "", after: after.question?.ask ?? "" },
    { label: "sources", before: String(before.sources.length), after: String(after.sources.length) },
  ];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{children}</h4>;
}

function WhatChanged({ before, after }: { before: Finding; after: Finding }) {
  return (
    <section className="flex flex-col gap-2 border-t border-hairline pt-4">
      <SectionTitle>What changed</SectionTitle>
      <div className="rounded-[var(--radius-md)] border border-hairline">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline">
              {["field", "stale", "live"].map((h) => (
                <th key={h} className="px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {diffRows(before, after).map((r) => {
              const changed = r.before !== r.after;
              return (
                <tr key={r.label} className={cn("border-b border-hairline align-top last:border-0", changed && "bg-pastel-butter/60")}>
                  <th scope="row" className="whitespace-nowrap px-2.5 py-1.5 text-left font-mono text-[11px] font-medium text-subtle">
                    {changed && <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--color-warning)] align-middle" />}
                    {r.label}
                  </th>
                  <td className="whitespace-pre-line px-2.5 py-1.5 text-subtle">{r.before || <span className="text-faint">—</span>}</td>
                  <td className={cn("whitespace-pre-line px-2.5 py-1.5", changed ? "font-medium text-foreground" : "text-subtle")}>
                    {r.after || <span className="text-faint">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type HistoryItem = { key: string; at: string; text: React.ReactNode };

function historyOf(f: Finding, events: EvidenceEvent[]): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const ev of events) {
    if (ev.kind === "finding_superseded" && ev.finding_id === f.finding_id) {
      out.push({
        key: ev.event_id,
        at: ev.at,
        text: (
          <>
            Marked stale, superseded by <Id href={hrefs.finding(ev.superseded_by)}>{ev.superseded_by}</Id>
            {ev.cause_ts && (
              <>
                {" "}
                · cause <Id href={hrefs.thread(ev.cause_ts)}>{ev.cause_ts}</Id> ({fmtTime(ev.cause_ts)})
              </>
            )}
          </>
        ),
      });
    } else if (ev.kind === "publish_refused" && ev.run_id === f.checker_run.run_id) {
      out.push({
        key: ev.event_id,
        at: ev.at,
        text: (
          <>
            Publish refused: bound <Id href={hrefs.thread(ev.bound_revision)}>{ev.bound_revision}</Id> vs current{" "}
            <Id href={hrefs.thread(ev.current_revision)}>{ev.current_revision}</Id>
            {ev.reason && <> · {ev.reason}</>}
          </>
        ),
      });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function FindingDetail({ finding, graph, events }: { finding: Finding; graph: EvidenceGraph; events: EvidenceEvent[] }) {
  const before = finding.supersedes ? findingById(graph, finding.supersedes) : undefined;
  const history = historyOf(finding, events);
  const graphNodeIds = new Set(graph.nodes.map((n) => n.id));
  return (
    <div className="flex flex-col gap-5">
      <FindingCard finding={finding} graphNodeIds={graphNodeIds} />
      {before && <WhatChanged before={before} after={finding} />}
      {history.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-hairline pt-4">
          <SectionTitle>History</SectionTitle>
          <ul className="flex flex-col gap-2 text-[13px] text-foreground">
            {history.map((h) => (
              <li key={h.key} className="flex flex-col gap-0.5">
                <span className="font-mono text-[11px] tabular-nums text-faint">{new Date(h.at).toLocaleString("en-US", { timeZone: "America/New_York",  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 leading-relaxed">{h.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
