"use client";

/**
 * Workspace segment of the Findings page: the reviewer's exact-match message
 * index as an AG grid (workspace-grid.tsx). The query bar (quantity words,
 * keyword, changes-only, cutoff) still drives which rows land in the grid;
 * AG's own column filters (Author / Channel / Documents / Quantities) replace
 * the popover facet row that used to sit above the table.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { useIsLg } from "@/components/documents/document-model";
import { WorkspaceDetailBody, WorkspaceDetailPanel } from "@/components/workspace/workspace-detail";
import { WorkspaceGrid } from "@/components/workspace/workspace-grid";
import { BY_TS, EMPTY_FILTERS, type Filters, fromQuery, hitMark, INDEX, reviewerSearch, toQuery, triggerCutoff } from "@/components/workspace/workspace-model";
import { WorkspaceQueryBar } from "@/components/workspace/workspace-query-bar";
import { toRows } from "@/components/workspace/workspace-table";
import { useEvidence } from "@/lib/demo/use-evidence";
import { queryIndex } from "@/lib/workspace-index";

export function WorkspaceBody() {
  const router = useRouter();
  const params = useSearchParams();
  const { events } = useEvidence();
  const isLg = useIsLg();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [replay, setReplay] = useState(false);
  const listRef = useRef<HTMLElement>(null);

  // `?ts=` → selection, same pattern as thread-body.tsx's focusTs: only
  // external navigation (load, back / forward) lands and scrolls the row; the
  // page's own clicks write the URL through selfPushedRef and must not scroll
  // again.
  const paramTs = params.get("ts");
  const selfPushedRef = useRef<string | null>(paramTs);
  const [selectedTs, setSelectedTs] = useState<string | null>(paramTs);
  const [landTs, setLandTs] = useState<string | null>(paramTs);
  // Below lg the detail lives in a Drawer; auto-selection must not pop it open.
  const [drawerOpen, setDrawerOpen] = useState(Boolean(paramTs));
  useEffect(() => {
    if (paramTs !== selfPushedRef.current) {
      selfPushedRef.current = paramTs;
      setSelectedTs(paramTs);
      setLandTs(paramTs);
      setDrawerOpen(Boolean(paramTs));
    }
  }, [paramTs]);
  const select = useCallback(
    (ts: string) => {
      setSelectedTs(ts);
      setDrawerOpen(true);
      selfPushedRef.current = ts;
      router.replace(`/findings?view=workspace&ts=${encodeURIComponent(ts)}`, { scroll: false });
    },
    [router],
  );

  const search = useMemo(() => reviewerSearch(events), [events]);
  const cutoffTs = useMemo(() => triggerCutoff(events, search), [events, search]);
  const searchId = search?.event_id ?? null;
  // A different evidence log means a different recorded search; drop the old marks.
  useEffect(() => setReplay(false), [searchId]);

  const query = useMemo(() => toQuery(filters, cutoffTs), [filters, cutoffTs]);
  const result = useMemo(() => queryIndex(INDEX, query), [query]);
  const rows = useMemo(() => toRows(result.hits.map((h) => BY_TS.get(h.ts)!), replay ? search : null), [result, replay, search]);
  // A deep-linked ts outside the result set is still selectable; it just carries no row.
  const selected = useMemo(() => {
    if (!selectedTs) return null;
    const row = rows.find((r) => r.ts === selectedTs);
    if (row) return row;
    const m = BY_TS.get(selectedTs);
    return m ? { ...m, mark: hitMark(m.ts, replay ? search : null) } : null;
  }, [rows, selectedTs, replay, search]);

  // Never an empty panel: with nothing selected, take the first row (the first
  // replayed hit when a replay is on).
  useEffect(() => {
    if (selectedTs && BY_TS.has(selectedTs)) return;
    const first = rows.find((r) => r.mark === "returned") ?? rows[0];
    if (first) setSelectedTs(first.ts);
  }, [rows, selectedTs]);

  // Deep-linked row: scroll it into view once it is rendered.
  useEffect(() => {
    if (!landTs) return;
    const el = listRef.current?.querySelector(".civic-row-focus");
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    setLandTs(null);
  }, [landTs, rows]);

  const onReplay = useCallback(() => {
    if (!search) return;
    setFilters({ ...fromQuery(search.query), cutoff: Boolean(search.cutoff) || Boolean(search.query.before_ts) });
    setReplay(true);
    const first = search.hit_ts[0];
    if (first) setSelectedTs(first);
  }, [search]);
  const onFilters = useCallback((f: Filters) => {
    setFilters(f);
    if (f === EMPTY_FILTERS) setReplay(false);
  }, []);
  const close = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="flex min-h-0 flex-1 border-t border-hairline">
      <section ref={listRef} className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4 lg:px-6">
        <WorkspaceQueryBar filters={filters} onChange={onFilters} cutoffTs={cutoffTs} result={result} search={search} replayActive={replay} onReplay={onReplay} />
        <WorkspaceGrid rows={rows} selectedTs={selectedTs} onSelect={(r) => select(r.ts)} />
      </section>
      <aside className="custom-scrollbar hidden w-[380px] shrink-0 overflow-y-auto border-l border-hairline bg-surface lg:block">
        <WorkspaceDetailPanel row={selected} className="min-h-full rounded-none border-0 shadow-none" />
      </aside>
      {!isLg && drawerOpen && selected && (
        <Drawer open onClose={close} title={`${selected.user_name} · #${selected.channel_name}`}>
          <div className="flex flex-col gap-4">
            <WorkspaceDetailBody row={selected} />
          </div>
        </Drawer>
      )}
    </div>
  );
}
