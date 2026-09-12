"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Tile, EmptyState } from "@/civic-ui/components/Tile";
import { cn } from "@/civic-ui/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { FindingCard } from "@/components/findings/finding-card";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { NeedsAttention, attentionRows } from "@/components/overview/needs-attention";
import { ScenarioGrid } from "@/components/overview/scenario-grid";
import { StatsStrip, type LinkedStat } from "@/components/overview/stats-strip";
import { checkTotals, documentsRead, findingStates, latestLiveFinding, pct } from "@/components/overview/metrics";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Home() {
  const { events, graph, loaded } = useEvidence();

  const cards = useMemo<LinkedStat[]>(() => {
    const states = findingStates(graph, events);
    const checks = checkTotals(events);
    return [
      { label: "Live cards", value: String(states.live), href: "/findings" },
      { label: "Stale cards", value: String(states.stale), href: "/findings" },
      { label: "Needs decision", value: String(states.needsDecision), href: "/findings" },
      { label: "Refused publishes", value: String(states.refused), href: "/runs" },
      { label: "Checker runs", value: String(checks.runs), href: "/runs", hint: `${pct(checks.pass, checks.total)} pass` },
      { label: "Documents read", value: String(documentsRead(events).length), href: "/documents" },
    ];
  }, [graph, events]);

  const attention = useMemo(() => attentionRows(graph, events), [graph, events]);
  const latest = useMemo(() => latestLiveFinding(graph), [graph]);

  return (
    <>
      <PageHeader title="Overview" subtitle="What the reviewer read, ran, and published for the selected thread. Every count below is derived from the evidence log." />
      <StatsStrip cards={cards} />
      {/* Civic analytics bento: 12-col grid, three equal tiles on the first row. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Tile title="Needs attention" subtitle={`${attention.length} card${attention.length === 1 ? "" : "s"}`} index={0} className="lg:col-span-4">
          <NeedsAttention rows={attention} />
        </Tile>
        <Tile title="Latest card" subtitle={latest ? `bound to ${latest.requirements_revision}` : undefined} index={1} className="lg:col-span-4">
          {latest ? (
            <div className="flex flex-col gap-2">
              <FindingCard finding={latest} compact className="shadow-none" />
              <Link href={hrefs.finding(latest.finding_id)} className={cn("text-[12px] font-medium", LINK_CLASS)}>
                Full card
              </Link>
            </div>
          ) : (
            <EmptyState message={loaded ? "No live finding in this log" : "Loading evidence…"} />
          )}
        </Tile>
        <Tile title="Activity" subtitle={`${events.length} events`} index={2} className="lg:col-span-4">
          <ActivityFeed events={events} limit={8} />
        </Tile>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Scenarios</h2>
        <ScenarioGrid compact />
      </section>
    </>
  );
}
