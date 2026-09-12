"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { StatsCards } from "@/civic-ui/components/StatsCards";
import { useIsLg } from "@/components/documents/document-model";
import { PageHeader } from "@/components/shell/page-header";
import { WorkspaceDetailBody, WorkspaceDetailPanel } from "@/components/workspace/workspace-detail";
import { WorkspaceColumnFilters } from "@/components/workspace/workspace-filters";
import { BY_TS, EMPTY_FILTERS, type Filters, fromQuery, hitMark, INDEX, reviewerSearch, toQuery, triggerCutoff } from "@/components/workspace/workspace-model";
import { WorkspaceQueryBar } from "@/components/workspace/workspace-query-bar";
import { toRows, WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceTimeline } from "@/components/workspace/workspace-timeline";
import { useEvidence } from "@/lib/demo/use-evidence";
import { queryIndex } from "@/lib/workspace-index";

const STATS = [
  { label: "Messages indexed", value: String(INDEX.messages.length) },
  { label: "Channels", value: String(INDEX.channels.size) },
  { label: "Documents named", value: String(INDEX.byDocument.size) },
  { label: "Distinct units", value: String(INDEX.byUnit.size) },
];

function Workspace() {
  const router = useRouter();
  const params = useSearchParams();
  const { events } = useEvidence();
  const isLg = useIsLg();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [replay, setReplay] = useState(false);
  const listRef = useRef<HTMLElement>(null);

  // `?ts=` → selection. Only external navigation (load, back / forward) lands
  // and scrolls the row; the page's own clicks write the URL through
  // selfPushedRef and must not scroll again.
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
      router.replace(`/workspace?ts=${encodeURIComponent(ts)}`, { scroll: false });
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
  // A timeline dot outside the result set is still selectable; it just carries no row.
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
    const tr = listRef.current?.querySelector('tr[aria-current="true"]');
    if (!tr) return;
    tr.scrollIntoView({ block: "center" });
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
    // Same full-bleed frame as findings/page.tsx: height is 100dvh divided back
    // out of the html zoom; the header sits inside so the body gets the rest.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      <div className="px-3 pt-4 pb-3 sm:px-4 lg:px-6">
        <PageHeader
          title="Workspace"
          subtitle="The Slack export the reviewer searches. Every query is an exact match on document name, unit, quantity words, keyword, author or channel, cut off at the trigger message. Nothing here is ranked by similarity."
        />
      </div>
      <div className="flex min-h-0 flex-1 border-t border-hairline">
        <section ref={listRef} className="custom-scrollbar flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4 lg:px-6">
          <StatsCards cards={STATS} />
          <WorkspaceQueryBar filters={filters} onChange={onFilters} cutoffTs={cutoffTs} result={result} search={search} replayActive={replay} onReplay={onReplay} />
          <WorkspaceTimeline messages={INDEX.messages} rows={rows} cutoffTs={filters.cutoff ? cutoffTs : replay ? search?.cutoff : undefined} selectedTs={selectedTs} onSelect={select} />
          <div className="flex flex-col">
            <WorkspaceColumnFilters index={INDEX} filters={filters} onChange={onFilters} />
            <WorkspaceTable rows={rows} replayActive={replay} selectedTs={selectedTs} onSelect={(r) => select(r.ts)} />
          </div>
        </section>
        <aside className="custom-scrollbar hidden w-[380px] shrink-0 overflow-y-auto border-l border-hairline bg-surface lg:block">
          <WorkspaceDetailPanel row={selected} className="min-h-full rounded-none border-0 shadow-none" />
        </aside>
      </div>
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

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-[13px] text-subtle">Loading workspace…</p>}>
      <Workspace />
    </Suspense>
  );
}
