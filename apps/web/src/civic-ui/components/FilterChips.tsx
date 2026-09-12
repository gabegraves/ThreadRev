"use client";

import { ChevronDown, ListFilter, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/* Extracted from Civic src/components/filters/filter-bar.tsx.

   The Civic original is 955 lines and is welded to the app's URL filter state,
   its Popover primitive, team scoping and a mobile bottom-sheet branch. What is
   reusable is the CHIP VOCABULARY, so only that is lifted here, class strings
   unchanged: the bar shell, the segmented preset row, the dropdown trigger pill
   and the reset chip. Wire your own popover to `TriggerPill` — it is a <span>
   in the original precisely so it can be a popover trigger's child. */

/** The bar shell: one rounded surface holding the chip row. Desktop (md+) in
 *  Civic; the mobile branch there is a separate bottom sheet, not extracted. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-hairline bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          <ListFilter className="h-3.5 w-3.5" />
          Filters
        </span>
        {children}
      </div>
    </div>
  );
}

/** Segmented control — mutually exclusive presets ("7 days / 30 days / All
 *  time"). Active segment inverts to the foreground fill. */
export function SegmentedChips<T extends string | number>({
  options,
  value,
  onChange,
  children,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Optional trailing segment (e.g. a "Custom" popover trigger). */
  children?: ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center rounded-[10px] border border-hairline bg-overlay p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "relative z-10 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors",
            value === opt.value
              ? "bg-foreground text-background"
              : "text-subtle hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
      {children}
    </div>
  );
}

/* A pill button used as a popover trigger / segment. */
export function TriggerPill({
  icon,
  label,
  count,
  active,
  open,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  open?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12px] font-medium transition-colors",
        active || open
          ? "border-hairline-strong bg-overlay-strong text-foreground"
          : "border-hairline bg-overlay text-subtle hover:border-hairline-strong hover:text-foreground",
      )}
    >
      <span className="text-subtle">{icon}</span>
      {label}
      {count ? (
        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-accent-contrast">
          {count}
        </span>
      ) : null}
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-faint transition-transform motion-reduce:transition-none",
          open && "rotate-180",
        )}
      />
    </span>
  );
}

/** Quiet "Reset · <summary>" chip, right-aligned at the end of the bar. */
export function ResetChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-hairline bg-overlay px-2.5 text-[11px] font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-foreground"
    >
      <X className="h-3 w-3" />
      Reset · {label}
    </button>
  );
}
