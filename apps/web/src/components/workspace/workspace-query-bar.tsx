"use client";

import { ListFilter, Search } from "lucide-react";
import type { ReactNode } from "react";
import { ResetChip, SegmentedChips } from "@/civic-ui/components/FilterChips";
import { Toggle } from "@/civic-ui/components/Tile";
import type { WorkspaceIndex } from "@/lib/workspace-index";
import { fmtTime } from "@/components/review-console/graph-utils";
import { EMPTY_FILTERS, type Filters, isFiltered } from "./workspace-model";

const INPUT =
  "h-8 rounded-[10px] border border-hairline bg-overlay px-2.5 text-[12px] font-medium text-foreground outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus-visible:ring-2 focus-visible:ring-accent/60";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-[9ch] shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{label}</span>
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&_button]:whitespace-nowrap">{children}</div>
    </div>
  );
}

function withAny(values: string[]): { value: string; label: string }[] {
  return [{ value: "", label: "Any" }, ...values.map((v) => ({ value: v, label: v }))];
}

export function WorkspaceQueryBar({
  index,
  filters,
  onChange,
  cutoffTs,
  replayActive,
  canReplay,
  onReplay,
}: {
  index: WorkspaceIndex;
  filters: Filters;
  onChange: (f: Filters) => void;
  /** The ts the cutoff toggle pins before_ts to; undefined when the scenario has no trigger. */
  cutoffTs: string | undefined;
  replayActive: boolean;
  canReplay: boolean;
  onReplay: () => void;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const channels = [...index.channels.values()].sort();
  const people = [...index.people.values()].sort();
  const units = [...index.byUnit.keys()].sort((a, b) => a.localeCompare(b));
  const documents = [...index.byDocument.keys()].sort();
  const active = [
    filters.channel && `#${filters.channel}`,
    filters.from,
    filters.unit,
    filters.document,
    filters.quantity.trim() && `“${filters.quantity.trim()}”`,
    filters.keyword.trim() && `“${filters.keyword.trim()}”`,
    filters.changes_only && "changes",
    filters.cutoff && "cutoff",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-hairline bg-surface px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          <ListFilter className="h-3.5 w-3.5" />
          Query
        </span>
        <span className="text-[11.5px] text-faint">exact match on every set field · never by similarity</span>
        <div className="ml-auto flex items-center gap-2">
          {canReplay && (
            <button
              type="button"
              onClick={onReplay}
              aria-pressed={replayActive}
              className={
                replayActive
                  ? "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-hairline-strong bg-foreground px-2.5 text-[12px] font-medium text-background"
                  : "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-hairline bg-overlay px-2.5 text-[12px] font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-foreground"
              }
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2} />
              Replay the reviewer's search
            </button>
          )}
          {isFiltered(filters) && <ResetChip label={active.length > 2 ? `${active.length} fields` : active.join(" · ")} onClick={() => onChange(EMPTY_FILTERS)} />}
        </div>
      </div>

      <Row label="Channel">
        <SegmentedChips options={withAny(channels).map((o) => ({ ...o, label: o.value ? `#${o.value}` : o.label }))} value={filters.channel} onChange={(v) => set("channel", v)} />
      </Row>
      <Row label="Author">
        <SegmentedChips options={withAny(people)} value={filters.from} onChange={(v) => set("from", v)} />
      </Row>
      <Row label="Unit">
        <SegmentedChips options={withAny(units)} value={filters.unit} onChange={(v) => set("unit", v)} />
      </Row>
      <Row label="Document">
        <select value={filters.document} onChange={(e) => set("document", e.target.value)} className={`${INPUT} cursor-pointer appearance-none pr-7`} aria-label="Document">
          <option value="">Any document</option>
          {documents.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Words">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filters.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            placeholder="quantity words · any one must appear"
            aria-label="Quantity words"
            className={`${INPUT} w-[30ch] max-w-full`}
          />
          <input
            value={filters.keyword}
            onChange={(e) => set("keyword", e.target.value)}
            placeholder="keyword · plain substring"
            aria-label="Keyword"
            className={`${INPUT} w-[24ch] max-w-full`}
          />
        </div>
      </Row>
      <Row label="Scope">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div className="w-[15ch]">
            <Toggle label="Changes only" value={filters.changes_only} onChange={(v) => set("changes_only", v)} />
          </div>
          <div className="w-[17ch]">
            <Toggle label="Cutoff at trigger" value={filters.cutoff} onChange={(v) => set("cutoff", v)} />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-faint">
            {cutoffTs ? `before_ts = ${cutoffTs} · ${fmtTime(cutoffTs)}` : "no trigger in this evidence log"}
          </span>
        </div>
      </Row>
    </div>
  );
}
