"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { StatsCards } from "@/civic-ui/components/StatsCards";
import { useIsLg } from "@/components/documents/document-model";
import { fmtTime } from "@/components/review-console/graph-utils";
import { PageHeader } from "@/components/shell/page-header";
import { WorkspaceDetailBody, WorkspaceDetailPanel } from "@/components/workspace/workspace-detail";
import { BY_TS, EMPTY_FILTERS, type Filters, fromQuery, hitMark, INDEX, reviewerSearch, toQuery, triggerCutoff } from "@/components/workspace/workspace-model";
import { WorkspaceQueryBar } from "@/components/workspace/workspace-query-bar";
import { toRows, WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceTimeline } from "@/components/workspace/workspace-timeline";
import { setScenario } from "@/lib/demo/store";
import { useEvidence } from "@/lib/demo/use-evidence";
import { queryIndex } from "@/lib/workspace-index";

export default function Page() {
  const router = useRouter();
  const { events } = useEvidence();
  const isLg = useIsLg();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [replay, setReplay] = useState(false);
  const [selectedTs, setSelectedTs] = useState<string | null>(null);

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

  const stats = useMemo(
    () => [
      { label: "Messages indexed", value: String(INDEX.messages.length) },
      { label: "Channels", value: String(INDEX.channels.size) },
      { label: "Documents named", value: String(INDEX.byDocument.size) },
      { label: "Distinct units", value: String(INDEX.byUnit.size) },
    ],
    [],
  );

  const onReplay = useCallback(() => {
    if (!search) return;
    setFilters({ ...fromQuery(search.query), cutoff: Boolean(search.cutoff) || Boolean(search.query.before_ts) });
    setReplay(true);
  }, [search]);
  const onFilters = useCallback((f: Filters) => {
    setFilters(f);
    if (f === EMPTY_FILTERS) setReplay(false);
  }, []);
  const onOpenFinding = useCallback(
    (scenarioId: string, findingId: string) => {
      setScenario(scenarioId);
      router.push(`/findings?id=${encodeURIComponent(findingId)}`);
    },
    [router],
  );
  const close = useCallback(() => setSelectedTs(null), []);

  return (
    <>
      <PageHeader
        title="Workspace"
        subtitle="The Slack export the reviewer searches. Every query is an exact match on document name, unit, quantity words, keyword, author or channel, cut off at the trigger message. Nothing here is ranked by similarity."
      />
      <div className="mt-4 flex flex-col gap-4">
        <StatsCards cards={stats} />
        <WorkspaceQueryBar
          index={INDEX}
          filters={filters}
          onChange={onFilters}
          cutoffTs={cutoffTs}
          replayActive={replay}
          canReplay={Boolean(search)}
          onReplay={onReplay}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
          <span>
            total <span className="tabular-nums text-foreground">{result.total}</span>
          </span>
          <span>
            returned <span className="tabular-nums text-foreground">{result.hits.length}</span>
          </span>
          <span>
            truncated <span className="text-foreground">{result.truncated ? "yes" : "no"}</span>
          </span>
          <span>
            latest change <span className="normal-case tabular-nums text-foreground">{result.latest_change_ts ? fmtTime(result.latest_change_ts) : "—"}</span>
          </span>
          {result.cutoff && (
            <span>
              cutoff <span className="normal-case tabular-nums text-foreground">{fmtTime(result.cutoff)}</span>
            </span>
          )}
          {replay && search && (
            <span className="ml-auto">
              recorded · total <span className="tabular-nums text-foreground">{search.total}</span> · returned{" "}
              <span className="tabular-nums text-foreground">{search.returned}</span> · hits <span className="tabular-nums text-foreground">{search.hit_ts.length}</span>
            </span>
          )}
        </div>
        <WorkspaceTimeline messages={INDEX.messages} rows={rows} cutoffTs={filters.cutoff ? cutoffTs : replay ? search?.cutoff : undefined} selectedTs={selectedTs} onSelect={setSelectedTs} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <WorkspaceTable rows={rows} replayActive={replay} selectedTs={selectedTs} onSelect={(r) => setSelectedTs(r.ts)} />
          <div className="hidden lg:block">
            <WorkspaceDetailPanel row={selected} onOpenFinding={onOpenFinding} />
          </div>
        </div>
      </div>
      {!isLg && selected && (
        <Drawer open onClose={close} title={`${selected.user_name} · #${selected.channel_name}`}>
          <div className="flex flex-col gap-4">
            <WorkspaceDetailBody row={selected} onOpenFinding={onOpenFinding} />
          </div>
        </Drawer>
      )}
    </>
  );
}
