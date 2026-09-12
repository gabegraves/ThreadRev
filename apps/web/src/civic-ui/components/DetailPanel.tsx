"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/* ==================================================================
   Detail / evidence panel — the right-hand column of an explorer.

   Extracted from Civic src/components/analytics/report-detail.tsx.
   That file (434 lines) also lazily fetches an AI reasoning payload,
   formats currency, and computes SLA targets against app metadata —
   none of which is portable, so only the PRESENTATION is lifted: the
   `Field` label/value helper (verbatim, minus the maps-link branch),
   the `grid-cols-2 sm:grid-cols-3` field grid, the section heading,
   and the empty state. The sibling `city/work-order-detail.tsx` (591
   lines) was rejected — more app imports, same visual vocabulary.

   Use inside components/Drawer.tsx for the mobile slide-in, or inline
   as a desktop column.
   ================================================================== */

/** Single label/value pair. The label is the 11px uppercase micro-label
 *  convention; the value is tabular so aligned columns of numbers line up. */
export function Field({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Monospace the value — sha256 digests, revisions, ids. */
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-faint">
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] font-medium tabular-nums text-foreground leading-tight",
          mono && "break-all font-mono text-[13px]",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

/** Field grid — 2-up on mobile, 3-up from sm. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">{children}</div>
  );
}

/** Section heading inside the panel (e.g. "Evidence", "Provenance"). */
export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-hairline pt-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-faint">
        {title}
      </h4>
      {children}
    </section>
  );
}

interface DetailPanelProps {
  /** Rendered as the panel heading. When null the empty state shows instead. */
  title?: ReactNode;
  /** Small line under the title — source document, address, owner. */
  subtitle?: ReactNode;
  /** Status pill / badge row, right of the title. */
  actions?: ReactNode;
  children?: ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function DetailPanel({
  title,
  subtitle,
  actions,
  children,
  emptyMessage = "Select a row to see its detail.",
  className,
}: DetailPanelProps) {
  if (!title) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]",
          className,
        )}
      >
        <p className="text-[13px] text-faint">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 overflow-y-auto custom-scrollbar rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 truncate text-[12px] text-faint">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </header>
      {children}
    </div>
  );
}
