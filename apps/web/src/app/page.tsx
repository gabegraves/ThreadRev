"use client";

import { useMemo } from "react";
import { StatsCards, type StatCardDef } from "@/civic-ui/components/StatsCards";
import { Tile, EmptyState } from "@/civic-ui/components/Tile";
import { PageHeader } from "@/components/shell/page-header";
import { FindingCard } from "@/components/findings/finding-card";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { ScenarioGrid } from "@/components/overview/scenario-grid";
import { checkTotals, documentsRead, findingStates, latestLiveFinding, pct } from "@/components/overview/metrics";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Home() {
  const { events, graph, loaded } = useEvidence();

  const cards = useMemo<StatCardDef[]>(() => {
    const states = findingStates(graph, events);
    const checks = checkTotals(events);
    return [
      { label: "Live findings", value: String(states.live) },
      { label: "Stale findings", value: String(states.stale) },
      { label: `Checker runs · ${pct(checks.pass, checks.total)} checks pass`, value: String(checks.runs) },
      { label: "Documents read", value: String(documentsRead(events).length) },
    ];
  }, [graph, events]);

  const latest = useMemo(() => latestLiveFinding(graph), [graph]);

  return (
    <>
      <PageHeader title="Overview" subtitle="What the reviewer read, ran, and published for the selected thread. Every count below is derived from the evidence log." />
      <StatsCards cards={cards} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Tile title="Latest finding" subtitle={latest ? `bound to ${latest.requirements_revision}` : undefined} index={0}>
          {latest ? <FindingCard finding={latest} /> : <EmptyState message={loaded ? "No live finding in this log" : "Loading evidence…"} />}
        </Tile>
        <Tile title="Activity" subtitle={`${events.length} events`} index={1}>
          <ActivityFeed events={events} />
        </Tile>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Scenarios</h2>
        <ScenarioGrid />
      </section>
    </>
  );
}
