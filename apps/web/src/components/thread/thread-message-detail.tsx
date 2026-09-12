"use client";

/**
 * Explorer detail for one thread message: the message exactly as the thread
 * page renders it (docs, workspace hits, cards, decision rows), then the
 * reviewer run that message triggered as the same event timeline the graph
 * page uses — checker rows, published / superseded / refused chain.
 *
 * Every id in the timeline is a link to its page (finding → /findings,
 * run → /runs, document sha → /documents, message ts → /thread).
 */
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { Waypoints } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TraceTimeline } from "@/components/graph/trace-timeline";
import { runTraces, type ThreadMessage } from "@/components/review-console/graph-utils";
import { graphHref, hrefForId } from "@/lib/evidence-links";
import { Message } from "./thread-timeline";
import type { ThreadModel } from "./thread-model";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{children}</h4>;
}

const LINK = "inline-flex items-center gap-1 font-mono text-[11px] text-accent-text underline-offset-2 hover:underline";

export function ThreadMessageDetail({
  m,
  model,
  graph,
  events,
  channelId,
  onOpen,
}: {
  m: ThreadMessage;
  model: ThreadModel;
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  channelId: string | null;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const trace = useMemo(() => runTraces(events).find((t) => t.trigger_ts === m.ts), [events, m.ts]);
  const runIds = useMemo(() => [...new Set((trace?.events ?? []).flatMap((ev) => (ev.kind === "check_run" ? [ev.run_id] : [])))], [trace]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <code className="font-mono text-[11px] text-faint">{m.ts}</code>
        <Link href={graphHref(m.ts)} className={LINK}>
          <Waypoints className="size-3.5" strokeWidth={1.75} aria-hidden />
          Open in graph
        </Link>
      </div>
      <ol aria-label="Message" className="flex flex-col gap-1">
        <Message m={m} model={model} graph={graph} channelId={channelId} onOpen={onOpen} />
      </ol>
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SectionTitle>Reviewer run</SectionTitle>
          {runIds.map((id) => (
            <Link key={id} href={`/runs?id=${encodeURIComponent(id)}`} className={LINK}>
              {id}
            </Link>
          ))}
        </div>
        {trace ? (
          <TraceTimeline
            trace={trace}
            onPick={(id) => {
              const href = hrefForId(graph, id);
              if (href) router.push(href);
            }}
          />
        ) : (
          <p className="text-[12px] text-faint">This message did not trigger a reviewer run.</p>
        )}
      </section>
    </div>
  );
}
