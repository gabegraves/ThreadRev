"use client";

import Link from "next/link";
import type { EvidenceEvent } from "agent-core/shared";
import { cn } from "@/civic-ui/lib/cn";
import { EmptyState } from "@/civic-ui/components/Tile";
import { KIND_LABEL, TONE_DOT_CLASS, eventHref, eventSubject, fmtAt, kindTone } from "./metrics";

/** Newest events, one line each: state dot, kind, subject, time. Each row links to its entity. */
export function ActivityFeed({ events, limit = 8 }: { events: EvidenceEvent[]; limit?: number }) {
  const rows = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  if (rows.length === 0) return <EmptyState message="No events yet" />;
  return (
    <ol className="flex flex-col">
      {rows.map((ev, i) => {
        const href = eventHref(ev);
        const body = (
          <>
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT_CLASS[kindTone(ev.kind)])} />
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">{KIND_LABEL[ev.kind]}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{eventSubject(ev)}</span>
            <time dateTime={ev.at} className="shrink-0 font-mono text-[12px] tabular-nums text-faint">
              {fmtAt(ev.at)}
            </time>
          </>
        );
        const cls = "flex items-center gap-2.5 py-2.5";
        return (
          <li key={ev.event_id} className={cn(i > 0 && "border-t border-hairline")}>
            {href ? (
              <Link href={href} className={cn(cls, "-mx-2 rounded-md px-2 transition-colors hover:bg-overlay focus-visible:outline-2 focus-visible:outline-accent")}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
