"use client";

import { ListFilter, Search } from "lucide-react";
import { ResetChip } from "@/civic-ui/components/FilterChips";
import { Toggle } from "@/civic-ui/components/Tile";
import { fmtTime } from "@/components/review-console/graph-utils";
import type { WorkspaceResult } from "@/lib/workspace-index";
import { EMPTY_FILTERS, type Filters, isFiltered, type ReviewerSearch } from "./workspace-model";

const INPUT =
  "h-8 rounded-[10px] border border-hairline bg-overlay px-2.5 text-[12px] font-medium text-foreground outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus-visible:ring-2 focus-visible:ring-accent/60";

function Count({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <span>
      {label} <span className={mono ? "normal-case tabular-nums text-foreground" : "tabular-nums text-foreground"}>{value}</span>
    </span>
  );
}

/** The single control row: free-text query, scope toggles, replay, and the result counts. */
export function WorkspaceQueryBar({
  filters,
  onChange,
  cutoffTs,
  result,
  search,
  replayActive,
  onReplay,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** The ts the cutoff toggle pins before_ts to; undefined when the scenario has no trigger. */
  cutoffTs: string | undefined;
  result: WorkspaceResult;
  /** The recorded search, when the evidence log has one. */
  search: ReviewerSearch | null;
  replayActive: boolean;
  onReplay: () => void;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
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
    <div className="flex flex-col gap-2 rounded-[14px] border border-hairline bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          <ListFilter className="h-3.5 w-3.5" />
          Query
        </span>
        <input
          value={filters.quantity}
          onChange={(e) => set("quantity", e.target.value)}
          placeholder="quantity words · any one must appear"
          aria-label="Quantity words"
          className={`${INPUT} w-[30ch] max-w-full`}
        />
        <input value={filters.keyword} onChange={(e) => set("keyword", e.target.value)} placeholder="keyword · plain substring" aria-label="Keyword" className={`${INPUT} w-[24ch] max-w-full`} />
        <div className="w-[15ch]">
          <Toggle label="Changes only" value={filters.changes_only} onChange={(v) => set("changes_only", v)} />
        </div>
        <div className="w-[17ch]" title={cutoffTs ? `before_ts = ${cutoffTs} · ${fmtTime(cutoffTs)}` : "no trigger in this evidence log"}>
          <Toggle label="Cutoff at trigger" value={filters.cutoff} onChange={(v) => set("cutoff", v)} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {search && (
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
        <Count label="total" value={result.total} />
        <Count label="returned" value={result.hits.length} />
        <Count label="truncated" value={result.truncated ? "yes" : "no"} />
        <Count label="latest change" value={result.latest_change_ts ? fmtTime(result.latest_change_ts) : "—"} mono />
        {result.cutoff && <Count label="cutoff" value={fmtTime(result.cutoff)} mono />}
        {replayActive && search && (
          <span className="ml-auto">
            recorded · <Count label="total" value={search.total} /> · <Count label="returned" value={search.returned} /> · <Count label="hits" value={search.hit_ts.length} />
          </span>
        )}
      </div>
    </div>
  );
}
