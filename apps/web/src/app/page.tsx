"use client";

import { useMemo } from "react";
import { Tile } from "@/civic-ui/components/Tile";
import { PageHeader } from "@/components/shell/page-header";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { NeedsAttention, attentionRows } from "@/components/overview/needs-attention";
import { StatsStrip, type LinkedStat } from "@/components/overview/stats-strip";
import { findingStates } from "@/components/overview/metrics";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Home() {
  const { events, graph } = useEvidence();

  const cards = useMemo<LinkedStat[]>(() => {
    const states = findingStates(graph, events);
    return [
      { label: "Live cards", value: String(states.live), href: "/findings" },
      { label: "Stale cards", value: String(states.stale), href: "/findings" },
      { label: "Needs decision", value: String(states.needsDecision), href: "/findings" },
      { label: "Refused publishes", value: String(states.refused), href: "/runs" },
    ];
  }, [graph, events]);

  const attention = useMemo(() => attentionRows(graph, events), [graph, events]);

  return (
    <>
      <PageHeader title="Overview" subtitle="What is standing, stale, or waiting on a decision." />
      <StatsStrip cards={cards} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <Tile title="Needs attention" index={0} className="lg:col-span-7">
          <NeedsAttention rows={attention} />
        </Tile>
        <Tile title="Activity" subtitle={`${events.length} events`} index={1} className="lg:col-span-5">
          <ActivityFeed events={events} limit={8} />
        </Tile>
      </div>
    </>
  );
}
