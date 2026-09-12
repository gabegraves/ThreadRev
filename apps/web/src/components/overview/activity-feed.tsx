"use client";

import type { EvidenceEvent } from "agent-core/shared";
import { cn } from "@/civic-ui/lib/cn";
import { EmptyState } from "@/civic-ui/components/Tile";
import { KIND_LABEL, TONE_DOT_CLASS, eventSubject, fmtAt, kindTone } from "./metrics";

/** Compact timeline of the newest events, one row each, state dot per kind. */
export function ActivityFeed({ events, limit = 8 }: { events: EvidenceEvent[]; limit?: number }) {
  const rows = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  if (rows.length === 0) return <EmptyState message="No events yet" />;
  return (
    <ol className="flex flex-col">
      {rows.map((ev, i) => (
        <li key={ev.event_id} className={cn("flex items-start gap-3 py-2", i > 0 && "border-t border-hairline")}>
          <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE_DOT_CLASS[kindTone(ev.kind)])} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{KIND_LABEL[ev.kind]}</p>
            <p className="truncate text-[13px] text-foreground">{eventSubject(ev)}</p>
          </div>
          <time dateTime={ev.at} className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
            {fmtAt(ev.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
