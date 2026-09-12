"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Skeleton } from "@/civic-ui/components/Skeleton";
import { EmptyState } from "@/civic-ui/components/Tile";
import { PageHeader } from "@/components/shell/page-header";
import { ThreadFacts } from "@/components/thread/thread-facts";
import { buildThreadModel } from "@/components/thread/thread-model";
import { ThreadTimeline } from "@/components/thread/thread-timeline";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Page() {
  const router = useRouter();
  const { scenario, events, graph, loaded } = useEvidence();
  const model = useMemo(() => buildThreadModel(events, graph), [events, graph]);
  const onOpen = useCallback((id: string) => router.push(`/findings?id=${encodeURIComponent(id)}`), [router]);

  return (
    <>
      <PageHeader title="Thread" subtitle="The Slack thread as the reviewer read it. Cards and decisions sit under the message that triggered them." />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {!loaded ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : model.messages.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
            <EmptyState message="No messages recorded in this thread." />
          </div>
        ) : (
          <ThreadTimeline model={model} graph={graph} channelId={scenario?.channel_id ?? null} onOpen={onOpen} />
        )}
        <div className="hidden lg:block">
          <ThreadFacts model={model} graph={graph} channel={scenario?.channel ?? null} onOpen={onOpen} />
        </div>
      </div>
    </>
  );
}
