"use client";

/**
 * Column filters for the workspace table: one popover pill per dimension
 * (channel, author, document, unit), each a single-select list. Popover and
 * MenuRow are transcribed from Civic src/civic/filters/filter-bar.tsx (not
 * exported there); TriggerPill / ResetChip come from the civic-ui kit.
 */
import { AtSign, Check, FileText, Hash, ListFilter, Ruler } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { ResetChip, TriggerPill } from "@/civic-ui/components/FilterChips";
import { cn } from "@/civic-ui/lib/cn";
import type { WorkspaceIndex } from "@/lib/workspace-index";
import type { Filters } from "./workspace-model";

function Popover({ trigger, children }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const beginClose = useCallback(() => {
    setOpen(false);
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setClosing(false), 100);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) beginClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") beginClose();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, beginClose]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} onClick={() => (open ? beginClose() : setOpen(true))} className="contents">
        {trigger(open)}
      </button>
      {(open || closing) && (
        <div
          id={panelId}
          role="dialog"
          className={cn(
            "absolute left-0 top-[calc(100%+6px)] z-50 min-w-[13rem] origin-top",
            "rounded-[14px] border border-hairline bg-surface p-1.5",
            "shadow-[var(--shadow-pop)] ring-1 ring-hairline",
            closing ? "animate-[popover-out_100ms_ease-in_forwards]" : "animate-[popover-in_120ms_ease-out]",
          )}
        >
          {children(beginClose)}
        </div>
      )}
    </div>
  );
}

function MenuRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] transition-colors",
        selected ? "text-foreground" : "text-subtle hover:bg-overlay",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          selected ? "border-accent bg-accent text-accent-contrast" : "border-hairline-strong text-transparent",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="flex flex-1 items-center gap-2">{children}</span>
    </button>
  );
}

/** Single-select popover: the pill shows the chosen value, the list clears on re-pick. */
function PickFilter({
  icon,
  label,
  options,
  value,
  onChange,
  mono,
}: {
  icon: ReactNode;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Render option text in the mono face (channels, documents). */
  mono?: boolean;
}) {
  return (
    <Popover trigger={(open) => <TriggerPill icon={icon} label={value ? `${label}: ${value}` : label} active={Boolean(value)} open={open} />}>
      {(close) => (
        <div className="w-[16rem] p-0.5">
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
            <span className="text-[11px] uppercase tracking-wide text-faint">{label}</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="text-[11px] font-medium text-subtle hover:text-foreground hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-[15rem] overflow-y-auto custom-scrollbar">
            {options.map((o) => (
              <MenuRow
                key={o}
                selected={value === o}
                onClick={() => {
                  onChange(value === o ? "" : o);
                  close();
                }}
              >
                <span className={cn("truncate", mono && "font-mono text-[12px]")}>{o}</span>
              </MenuRow>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Toolbar strip that sits flush on top of the table card. */
export function WorkspaceColumnFilters({ index, filters, onChange }: { index: WorkspaceIndex; filters: Filters; onChange: (f: Filters) => void }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const channels = [...index.channels.values()].sort();
  const people = [...index.people.values()].sort();
  const documents = [...index.byDocument.keys()].sort();
  const units = [...index.byUnit.keys()].sort((a, b) => a.localeCompare(b));
  const active = [filters.channel && `#${filters.channel}`, filters.from, filters.document, filters.unit].filter(Boolean) as string[];

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-t-[var(--radius-lg)] border border-b-0 border-hairline bg-surface px-3 py-2">
      <style>{`@media (prefers-reduced-motion:no-preference){@keyframes popover-in{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}@keyframes popover-out{from{opacity:1;transform:none}to{opacity:0;transform:scale(.98)}}}`}</style>
      <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        <ListFilter className="h-3.5 w-3.5" />
        Columns
      </span>
      <PickFilter icon={<Hash className="h-3.5 w-3.5" />} label="Channel" options={channels} value={filters.channel} onChange={(v) => set("channel", v)} mono />
      <PickFilter icon={<AtSign className="h-3.5 w-3.5" />} label="Author" options={people} value={filters.from} onChange={(v) => set("from", v)} />
      <PickFilter icon={<FileText className="h-3.5 w-3.5" />} label="Document" options={documents} value={filters.document} onChange={(v) => set("document", v)} mono />
      <PickFilter icon={<Ruler className="h-3.5 w-3.5" />} label="Unit" options={units} value={filters.unit} onChange={(v) => set("unit", v)} mono />
      {active.length > 0 && <ResetChip label={active.join(" · ")} onClick={() => onChange({ ...filters, channel: "", from: "", document: "", unit: "" })} />}
    </div>
  );
}
