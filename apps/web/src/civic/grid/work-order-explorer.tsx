"use client";

/* Ported from Civic src/components/city/work-order-explorer.tsx. Rows are
   findings, the detail pane is ThreadRev's FindingDetail (Civic's
   WorkOrderDetail is Supabase-bound), and the list/detail split moved from
   md to lg to match the findings page contract. Class strings unchanged. */

import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { Clock, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { cn } from "@/civic-ui/lib/cn";
import { toneChipClass } from "@/civic-ui/lib/status";
import { lockBodyScroll } from "@/civic-ui/lib/scroll-lock";
import type { GridReportRow } from "@/civic/lib/grid/dashboard-grid-data";
import { timeAgo } from "@/civic/lib/grid/time-ago";
import { FindingDetail } from "@/components/findings/finding-detail";
import { CARD_ACCENT, STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";

const titleize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Card kind → label + list-dot hue (Slack-side accent, kept for parity).
export const KIND_META: Record<string, { label: string; color: string }> = {
  discrepancy: { label: "Discrepancy", color: CARD_ACCENT.finding },
  clean: { label: "Clean", color: CARD_ACCENT.clean },
  question: { label: "Needs decision", color: CARD_ACCENT.question },
};

type RowStatus = keyof typeof STATUS_TONE;

/* ==================================================================
   Work-order explorer — grid sibling of analytics' ReportsExplorer.

   Same list (left) + detail (right) layout, opened from the grid's
   per-row expand control. Two deliberate differences:

   1. NOT portaled to document.body. The analytics explorer is
      `fixed inset-0` on the body, so it covers the app sidebar. This
      one renders inline as `absolute inset-0` inside the grid's
      (relative) root, so it fills only the content column and the
      left sidebar stays visible and usable — per the "full screen but
      keep the sidebar" requirement.
   2. Reads GridReportRow + renders the finding card, so the list and
      detail speak the grid's vocabulary.

   `rows` is the grid's already-filtered set, so the list mirrors what
   the grid is currently showing. Selection is owned by the parent so
   the grid can open the explorer pre-focused on the clicked row.
   ================================================================== */

export function WorkOrderExplorer({
  open,
  onClose,
  rows,
  graph,
  events,
  selectedId,
  onSelectId,
  detailDrawerOpen,
  onDetailDrawerChange,
}: {
  open: boolean;
  onClose: () => void;
  rows: GridReportRow[];
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  selectedId: string | null;
  onSelectId: (id: string) => void;
  detailDrawerOpen: boolean;
  onDetailDrawerChange: (open: boolean) => void;
}) {
  // Escape-to-close + body scroll lock while the overlay is open. (The content
  // column doesn't scroll on its own, but the lock also parks the sidebar so a
  // scroll gesture over the dimmed grid doesn't leak through.)
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

  // Keep a valid selection: when the overlay opens (or the filtered set drops
  // the current selection) fall back to the first row.
  useEffect(() => {
    if (!open || rows.length === 0) return;
    if (!rows.some((r) => r.report_id === selectedId)) {
      onSelectId(rows[0].report_id);
    }
  }, [open, rows, selectedId, onSelectId]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectId(id);
      // On a narrow viewport the detail lives in a Drawer, not the side pane.
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        onDetailDrawerChange(true);
      }
    },
    [onSelectId, onDetailDrawerChange],
  );

  if (!open) return null;

  const selected = rows.find((r) => r.report_id === selectedId) ?? null;
  const selectedFinding = selected
    ? (graph.findings.find((f) => f.finding_id === selected.report_id) ?? null)
    : null;
  const detail = selectedFinding ? (
    <FindingDetail finding={selectedFinding} graph={graph} events={events} />
  ) : (
    <p className="text-[13px] text-faint">Select a finding to see its card.</p>
  );

  return (
    <>
      {/* Full-bleed within the grid's relative root — inset-0 fills the entire
          content column (never the app sidebar). Not a floating card: no
          backdrop/margins/rounding, so it reads as the grid expanding into a
          detail view rather than a modal popping over it. */}
      <div className="absolute inset-0 z-40 animate-in fade-in duration-200 motion-reduce:animate-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Finding explorer"
          className={cn(
            "absolute inset-0 flex flex-col overflow-hidden bg-surface text-foreground",
          )}
        >
          <header className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[16px] font-semibold text-foreground sm:text-[17px]">
                Findings
              </h2>
              <span className="text-[13px] tabular-nums text-faint">
                {rows.length}
              </span>
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
            {/* List — full width below lg, fixed rail on lg+ */}
            <div className="custom-scrollbar w-full flex-shrink-0 overflow-y-auto pb-safe lg:w-[380px] lg:border-r lg:border-hairline">
              <ul className="flex flex-col p-2">
                {rows.map((row) => {
                  const meta = KIND_META[row.category ?? ""] ?? KIND_META.discrepancy;
                  const status = (row.status in STATUS_TONE ? row.status : "neutral") as RowStatus;
                  const isSelected = row.report_id === selectedId;
                  return (
                    <li key={row.report_id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(row.report_id)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "flex min-h-[56px] w-full flex-col gap-1 rounded-md px-3 py-3 text-left",
                          "transition-[background-color,transform] duration-100 active:scale-[0.98] active:duration-75 motion-reduce:active:scale-100",
                          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                          isSelected
                            ? "bg-overlay-strong"
                            : "hover:bg-overlay active:bg-overlay",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium leading-tight text-foreground">
                            <span
                              className="h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: meta.color }}
                              aria-hidden
                            />
                            <span className="truncate">
                              {row.category ? meta.label : "Unclassified"}
                            </span>
                          </p>
                          <span
                            className={cn(
                              "flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                              toneChipClass(STATUS_TONE[status]),
                            )}
                          >
                            {STATUS_LABEL[status] ?? titleize(row.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[12px] leading-tight text-faint">
                          <span className="truncate font-mono">
                            {row.subcategory ?? row.report_id}
                          </span>
                          <span className="inline-flex flex-shrink-0 items-center gap-1">
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                            {row.created_at ? timeAgo(row.created_at) : "—"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Detail — hidden below lg (Drawer instead), visible lg+ */}
            <div className="custom-scrollbar hidden min-w-0 flex-1 overflow-y-auto p-6 pb-safe lg:flex">
              <div className="flex-1">{detail}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Below lg: detail in a Drawer */}
      <Drawer
        open={detailDrawerOpen}
        onClose={() => onDetailDrawerChange(false)}
        title={selected?.report_id ?? "Finding"}
        side="right"
      >
        {detail}
      </Drawer>
    </>
  );
}
