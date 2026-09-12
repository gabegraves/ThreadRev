"use client";

/**
 * "Chats" filter of the Documents page: Slack messages the reviewer read,
 * listed as evidence sources the same way files are. A row is one message;
 * its citations are the findings whose `sources` name that message ts.
 */
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import Link from "next/link";
import { type Column, DataTable } from "@/civic-ui/components/DataTable";
import { DetailPanel, DetailSection } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { fmtTime, threadMessages } from "@/components/review-console/graph-utils";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import type { DocCitation } from "./document-model";

export type ChatRow = {
  /** Slack ts; also the graph node id. */
  id: string;
  from: string;
  text: string;
  is_change: boolean;
  is_bot: boolean;
  /** Triggered a reviewer run. */
  triggered: boolean;
  citations: DocCitation[];
};

export function buildChatRows(events: EvidenceEvent[], graph: EvidenceGraph): ChatRow[] {
  const triggers = new Set<string>();
  for (const ev of events) if (ev.trigger_ts) triggers.add(ev.trigger_ts);
  const rows = new Map<string, ChatRow>();
  for (const m of threadMessages(events)) {
    if (m.is_bot) continue;
    rows.set(m.ts, { id: m.ts, from: m.from, text: m.text, is_change: m.is_change, is_bot: m.is_bot, triggered: triggers.has(m.ts), citations: [] });
  }
  for (const f of graph.findings) {
    for (const s of f.sources) {
      if (s.kind !== "message") continue;
      const row = rows.get(s.id);
      if (row) row.citations.push({ finding_id: f.finding_id, finding_status: f.status, locator: s.locator, quote: s.quote });
    }
  }
  return [...rows.values()].reverse();
}

const COLUMNS: Column<ChatRow>[] = [
  { key: "from", header: "From", width: "140px", cell: (r) => <span className="font-medium text-foreground">{r.from}</span> },
  {
    key: "text",
    header: "Message",
    cell: (r) => (
      <span className="inline-flex min-w-0 max-w-[52ch] items-center gap-2">
        <span className="truncate text-subtle" title={r.text}>
          {r.text}
        </span>
        {r.is_change && <StatusPill tone="warning">change</StatusPill>}
        {r.triggered && <StatusPill tone="info">@Rev</StatusPill>}
      </span>
    ),
  },
  { key: "ts", header: "Sent", mono: true, cell: (r) => <span className="tabular-nums text-faint">{fmtTime(r.id)}</span> },
  { key: "cited", header: "Cited by findings", align: "right", mono: true, cell: (r) => r.citations.length },
];

export function ChatsTable({ rows, loading, selectedId, onSelect }: { rows: ChatRow[]; loading: boolean; selectedId: string | null; onSelect: (row: ChatRow) => void }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowId={(r) => r.id}
      onRowClick={onSelect}
      focusedId={selectedId}
      loading={loading}
      loadingRows={4}
      emptyMessage="No messages were read in this thread."
    />
  );
}

export function ChatDetailBody({ row, graphNodeIds }: { row: ChatRow; graphNodeIds: Set<string> }) {
  return (
    <>
      <p className="max-w-[68ch] whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{row.text}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <Link href={hrefs.thread(row.id)} className={LINK_CLASS}>
          Open in thread
        </Link>
        {graphNodeIds.has(row.id) && (
          <Link href={hrefs.graph(row.id)} className={LINK_CLASS}>
            Open in graph
          </Link>
        )}
      </div>
      <DetailSection title="Cited by findings">
        {row.citations.length === 0 ? (
          <p className="text-[12px] text-faint">No finding cites this message.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {row.citations.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one finding may cite a message at several locators
              <li key={`${c.finding_id}-${i}`} className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <Link href={hrefs.finding(c.finding_id)} className={cn("font-mono text-[12px]", LINK_CLASS)}>
                    {c.finding_id}
                  </Link>
                  <StatusPill tone={c.finding_status === "live" ? "success" : "neutral"}>{c.finding_status}</StatusPill>
                </span>
                {c.quote ? <blockquote className="border-l-2 border-hairline pl-3 text-[12px] text-subtle">{c.quote}</blockquote> : null}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </>
  );
}

export function ChatDetailPanel({ row, graphNodeIds }: { row: ChatRow | null; graphNodeIds: Set<string> }) {
  if (!row) return <DetailPanel emptyMessage="Select a message to see who cites it." className="lg:sticky lg:top-4 lg:self-start" />;
  return (
    <DetailPanel
      title={row.from}
      subtitle={<span className="font-mono tabular-nums">{fmtTime(row.id)} · {row.id}</span>}
      actions={row.triggered ? <StatusPill tone="info">triggered a run</StatusPill> : row.is_change ? <StatusPill tone="warning">change</StatusPill> : undefined}
      className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
    >
      <ChatDetailBody row={row} graphNodeIds={graphNodeIds} />
    </DetailPanel>
  );
}
