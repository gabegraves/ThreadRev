"use client";

/* Copied from src/civic/grid/work-order-explorer.tsx (the Civic port). Rows
   are thread messages, the detail pane is ThreadMessageDetail (the message
   as the thread page renders it, plus the reviewer run it triggered). Class
   strings unchanged. */

import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { Clock, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { cn } from "@/civic-ui/lib/cn";
import { toneChipClass } from "@/civic-ui/lib/status";
import { lockBodyScroll } from "@/civic-ui/lib/scroll-lock";
import { timeAgo } from "@/civic/lib/grid/time-ago";
import type { ThreadGridRow } from "@/lib/civic-adapters/thread-rows";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";
import { ThreadMessageDetail } from "./thread-message-detail";
import type { ThreadModel } from "./thread-model";

const DEPT_COLOR: Record<ThreadGridRow["dept"], string> = {
  trigger: "var(--fg-electric-indigo)",
  change: "var(--color-warning)",
  message: "var(--hairline-strong)",
};

export function ThreadExplorer({
  open,
  onClose,
  rows,
  model,
  graph,
  events,
  channelId,
  selectedId,
  onSelectId,
  onOpenFinding,
  detailDrawerOpen,
  onDetailDrawerChange,
}: {
  open: boolean;
  onClose: () => void;
  rows: ThreadGridRow[];
  model: ThreadModel;
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  channelId: string | null;
  selectedId: string | null;
  onSelectId: (id: string) => void;
  onOpenFinding: (id: string) => void;
  detailDrawerOpen: boolean;
  onDetailDrawerChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const unlock = lockBodyScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || rows.length === 0) return;
    if (!rows.some((r) => r.ts === selectedId)) {
      onSelectId(rows[0].ts);
    }
  }, [open, rows, selectedId, onSelectId]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectId(id);
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        onDetailDrawerChange(true);
      }
    },
    [onSelectId, onDetailDrawerChange],
  );

  if (!open) return null;

  const selected = rows.find((r) => r.ts === selectedId) ?? null;
  const message = selected ? (model.messages.find((m) => m.ts === selected.ts) ?? null) : null;
  const detail = message ? (
    <ThreadMessageDetail m={message} model={model} graph={graph} events={events} channelId={channelId} onOpen={onOpenFinding} />
  ) : (
    <p className="text-[13px] leading-relaxed text-subtle">Select a message to see what the reviewer did with it.</p>
  );

  return (
    <>
      <div className="absolute inset-0 z-40 animate-in fade-in duration-200 motion-reduce:animate-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thread explorer"
          className={cn("absolute inset-0 flex flex-col overflow-hidden bg-surface text-foreground")}
        >
          <header className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[16px] font-semibold text-foreground sm:text-[17px]">Thread</h2>
              <span className="text-[13px] tabular-nums text-faint">{rows.length}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1.5 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-subtle outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="custom-scrollbar w-full flex-shrink-0 overflow-y-auto pb-safe lg:w-[380px] lg:border-r lg:border-hairline">
              <ul className="flex flex-col p-2">
                {rows.map((row) => {
                  const status = row.status ?? "neutral";
                  const isSelected = row.ts === selectedId;
                  return (
                    <li key={row.ts}>
                      <button
                        type="button"
                        onClick={() => handleSelect(row.ts)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "flex min-h-[56px] w-full flex-col gap-1 rounded-md px-3 py-3 text-left",
                          "transition-[background-color,transform] duration-100 active:scale-[0.98] active:duration-75 motion-reduce:active:scale-100",
                          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                          isSelected ? "bg-overlay-strong" : "hover:bg-overlay active:bg-overlay",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium leading-tight text-foreground">
                            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: DEPT_COLOR[row.dept] }} aria-hidden />
                            <span className="truncate">{row.from || "—"}</span>
                          </p>
                          <span className={cn("flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium", toneChipClass(STATUS_TONE[status]))}>
                            {row.status ? STATUS_LABEL[status] : row.dept}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[12px] leading-tight text-faint">
                          <span className="truncate">{row.text.replace(/\s+/g, " ")}</span>
                          <span className="inline-flex flex-shrink-0 items-center gap-1">
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                            {row.at ? timeAgo(row.at) : "—"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="custom-scrollbar hidden min-w-0 flex-1 overflow-y-auto p-6 pb-safe lg:flex">
              <div className="flex-1">{detail}</div>
            </div>
          </div>
        </div>
      </div>

      <Drawer open={detailDrawerOpen} onClose={() => onDetailDrawerChange(false)} title={selected?.from ?? "Message"} side="right">
        {detail}
      </Drawer>
    </>
  );
}
