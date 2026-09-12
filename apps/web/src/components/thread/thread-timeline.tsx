"use client";

import { Database, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { EvidenceGraph } from "agent-core/shared";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { FindingCard } from "@/components/findings/finding-card";
import { changeDownstream, fmtTime, type ThreadMessage } from "@/components/review-console/graph-utils";
import { slackPermalink } from "@/lib/demo/status";
import type { InlineItem, ThreadModel, WorkspaceHitItem } from "./thread-model";

/** Messages the reviewer pulled in through search_workspace during the run this message triggered. */
function WorkspaceHits({ hits }: { hits: WorkspaceHitItem[] }) {
  return (
    <div className="ml-11 flex flex-col gap-2 rounded-[var(--radius-md)] border border-hairline bg-overlay px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Database className="size-3.5 text-faint" strokeWidth={1.75} aria-hidden />
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">
          Found in workspace · {hits.length} {hits.length === 1 ? "hit" : "hits"}
        </span>
        <Link href="/workspace" className="ml-auto font-mono text-[11px] text-accent-text underline-offset-2 hover:underline">
          open the index →
        </Link>
      </div>
      <ol className="flex flex-col gap-2">
        {hits.map((h) => (
          <li key={h.ts} className="flex flex-col gap-0.5 border-l-2 border-hairline-strong pl-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-subtle">{h.channel}</span>
              <span className="text-[12.5px] font-semibold text-foreground">{h.from}</span>
              <time className="font-mono text-[11px] tabular-nums text-faint">{fmtTime(h.ts)}</time>
              {h.is_change && <StatusPill tone="info">requirement change</StatusPill>}
            </div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">{h.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SILENCE_LABEL: Record<"gate_closed" | "no_finding", string> = {
  gate_closed: "gate closed, reviewer did not run",
  no_finding: "reviewer ran, nothing to say",
};

function DecisionRow({ item }: { item: Exclude<InlineItem, { kind: "card" }> }) {
  if (item.kind === "silence") {
    return (
      <div className="flex items-center gap-2 py-1 pl-11 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
        <span aria-hidden className="size-1.5 rounded-full bg-faint" />
        silence · {SILENCE_LABEL[item.reason]}
      </div>
    );
  }
  if (item.kind === "refused") {
    return (
      <div className="ml-11 flex flex-col gap-1 rounded-[var(--radius-md)] border border-hairline bg-overlay px-3 py-2 text-[12px]">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="danger">publish refused</StatusPill>
          <code className="font-mono text-[11px] text-faint">{item.run_id}</code>
        </div>
        <p className="font-mono text-[11.5px] tabular-nums text-subtle">
          bound <span className="text-foreground">{item.bound_revision}</span> → current <span className="text-foreground">{item.current_revision}</span>
        </p>
        <p className="text-subtle">{item.reason}</p>
      </div>
    );
  }
  return (
    <div className="ml-11 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-hairline bg-overlay px-3 py-2 text-[12px] text-subtle">
      <StatusPill tone="warning">stale</StatusPill>
      <span>
        Card <code className="font-mono text-[11px] text-foreground">{item.finding_id}</code> marked stale by this message · replaced by{" "}
        <code className="font-mono text-[11px] text-foreground">{item.superseded_by}</code>
      </span>
    </div>
  );
}

function InvalidatedPopover({ graph, ts }: { graph: EvidenceGraph; ts: string }) {
  const ids = changeDownstream(graph, ts);
  ids.delete(ts);
  const nodes = graph.nodes.filter((n) => ids.has(n.id));
  return (
    <div
      role="tooltip"
      className="absolute left-11 top-full z-20 mt-1 w-[min(92vw,360px)] rounded-[var(--radius-md)] border border-hairline bg-elevated p-3 shadow-[var(--shadow-pop)]"
    >
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">What this change invalidated</p>
      {nodes.length === 0 ? (
        <p className="mt-2 text-[12px] text-faint">Nothing downstream recorded.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {nodes.map((n) => (
            <li key={n.id} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[8ch] shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{n.kind}</span>
              <span className="min-w-0 truncate text-foreground">{n.label}</span>
              {n.status !== "neutral" && <span className="ml-auto font-mono text-[10.5px] uppercase text-faint">{n.status}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Message({
  m,
  model,
  graph,
  channelId,
  onOpen,
}: {
  m: ThreadMessage;
  model: ThreadModel;
  graph: EvidenceGraph;
  channelId: string | null;
  onOpen: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const docs = model.docsByTs.get(m.ts) ?? [];
  const inline = model.inlineByTs.get(m.ts) ?? [];
  const hits = model.workspaceHitsByTrigger.get(m.ts) ?? [];
  const isRoot = m.ts === graph.thread;
  return (
    <li className="flex flex-col gap-2">
      <div
        className={cn("relative flex gap-3 rounded-[var(--radius-md)] px-2 py-2", m.is_change && "bg-accent-soft")}
        onMouseEnter={() => m.is_change && setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-hairline bg-overlay font-mono text-[12px] font-semibold text-subtle"
        >
          {m.from.slice(0, 1) || "—"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold text-foreground">{m.from || "—"}</span>
            <time dateTime={m.at} className="font-mono text-[11px] tabular-nums text-faint">
              {fmtTime(m.ts)}
            </time>
            {isRoot && <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">root</span>}
            {m.is_bot && <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">bot</span>}
            {m.is_change && <StatusPill tone="info">requirement change</StatusPill>}
            {model.triggers.has(m.ts) && <StatusPill tone="neutral">trigger</StatusPill>}
            {channelId && (
              <a
                href={slackPermalink(channelId, m.ts)}
                target="_blank"
                rel="noopener noreferrer"
                title="recorded, not live"
                aria-label="Slack permalink (recorded, not live)"
                className="ml-auto inline-flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-faint hover:bg-overlay hover:text-foreground"
              >
                <ExternalLink className="size-3.5" strokeWidth={1.75} />
              </a>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{m.text}</p>
          {docs.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {docs.map((d) => (
                <li
                  key={d.sha256}
                  title={d.sha256}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-hairline bg-overlay px-2 py-1 text-[11.5px] text-subtle"
                >
                  <FileText className="size-3.5 text-faint" strokeWidth={1.75} />
                  <span className="text-foreground">{d.document}</span>
                  <span className="font-mono text-[10.5px] uppercase text-faint">{d.revision ?? "—"}</span>
                  <code className="font-mono text-[10.5px] text-faint">{d.sha256.slice(0, 12)}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
        {hover && <InvalidatedPopover graph={graph} ts={m.ts} />}
      </div>
      {hits.length > 0 && <WorkspaceHits hits={hits} />}
      {inline.map((item, i) =>
        item.kind === "card" ? (
          <FindingCard key={item.finding.finding_id} finding={item.finding} compact onOpen={onOpen} className="ml-11" />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: decision rows have no id of their own
          <DecisionRow key={`${item.kind}-${i}`} item={item} />
        ),
      )}
    </li>
  );
}

export function ThreadTimeline({
  model,
  graph,
  channelId,
  onOpen,
}: {
  model: ThreadModel;
  graph: EvidenceGraph;
  channelId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <ol
      aria-label="Reviewed thread"
      className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-hairline bg-surface p-3 shadow-[var(--shadow-card)] sm:p-4"
    >
      {model.messages.map((m) => (
        <Message key={m.ts} m={m} model={model} graph={graph} channelId={channelId} onOpen={onOpen} />
      ))}
    </ol>
  );
}
