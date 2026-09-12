"use client";

/**
 * Messages view of the Findings page: Civic's work-order grid with one row per
 * thread message. Row click / expand opens the explorer overlay with the
 * message as the thread timeline draws it, plus the reviewer run it triggered.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/civic-ui/components/Skeleton";
import { EmptyState } from "@/civic-ui/components/Tile";
import { ThreadGrid } from "@/components/thread/thread-grid";
import { buildThreadModel } from "@/components/thread/thread-model";
import { toThreadRows } from "@/lib/civic-adapters/thread-rows";
import { useEvidence } from "@/lib/demo/use-evidence";

export function ThreadBody() {
  const router = useRouter();
  const params = useSearchParams();
  const { scenario, events, graph, loaded } = useEvidence();
  const model = useMemo(() => buildThreadModel(events, graph), [events, graph]);
  const rows = useMemo(() => toThreadRows(model, graph, events, scenario?.channel ?? null), [model, graph, events, scenario]);
  const onOpen = useCallback((id: string) => router.push(`/findings?id=${encodeURIComponent(id)}`), [router]);

  // `?ts=` → focusTs, as findings-explorer does with `?id=`: only external
  // navigation re-lands the row; the grid's own selection writes the URL.
  const paramTs = params.get("ts");
  const selfPushedRef = useRef<string | null>(paramTs);
  const [focusTs, setFocusTs] = useState<string | null>(paramTs);
  useEffect(() => {
    if (paramTs !== selfPushedRef.current) {
      selfPushedRef.current = paramTs;
      setFocusTs(paramTs);
    }
  }, [paramTs]);
  const onSelectedChange = useCallback(
    (ts: string | null) => {
      selfPushedRef.current = ts;
      router.replace(ts ? `/findings?view=messages&ts=${encodeURIComponent(ts)}` : "/findings?view=messages", { scroll: false });
    },
    [router],
  );

  return (
    <>
      {!loaded ? (
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="No messages recorded in this thread." />
      ) : (
        <ThreadGrid
          rows={rows}
          model={model}
          graph={graph}
          events={events}
          channelId={scenario?.channel_id ?? null}
          onOpenFinding={onOpen}
          focusTs={focusTs}
          onSelectedChange={onSelectedChange}
        />
      )}
    </>
  );
}

