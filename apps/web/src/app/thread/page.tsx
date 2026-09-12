"use client";

/**
 * Thread page: Civic's work-order grid (copied to components/thread/thread-grid)
 * with one row per thread message. Row click / expand opens the explorer
 * overlay with the message rendered as the thread timeline draws it, plus the
 * reviewer run it triggered. Same full-bleed frame as the findings page.
 */
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Skeleton } from "@/civic-ui/components/Skeleton";
import { EmptyState } from "@/civic-ui/components/Tile";
import { ThreadGrid } from "@/components/thread/thread-grid";
import { buildThreadModel } from "@/components/thread/thread-model";
import { toThreadRows } from "@/lib/civic-adapters/thread-rows";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Page() {
  const router = useRouter();
  const { scenario, events, graph, loaded } = useEvidence();
  const model = useMemo(() => buildThreadModel(events, graph), [events, graph]);
  const rows = useMemo(() => toThreadRows(model, graph, events, scenario?.channel ?? null), [model, graph, events, scenario]);
  const onOpen = useCallback((id: string) => router.push(`/findings?id=${encodeURIComponent(id)}`), [router]);

  return (
    // Same full-bleed frame as findings/page.tsx: the grid owns the content
    // area, height is 100dvh divided back out of the html zoom.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      <h1 className="sr-only">Thread</h1>
      {!loaded ? (
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="No messages recorded in this thread." />
      ) : (
        <ThreadGrid rows={rows} model={model} graph={graph} events={events} channelId={scenario?.channel_id ?? null} onOpenFinding={onOpen} />
      )}
    </div>
  );
}
