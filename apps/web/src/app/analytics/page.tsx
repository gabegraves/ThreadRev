"use client";

import { useMemo } from "react";
import { Stat, StatGrid, Tile } from "@/civic-ui/components/Tile";
import { PageHeader } from "@/components/shell/page-header";
import { BarList, SourceCaption, StackedRunBars, TimelineStrip } from "@/components/overview/charts";
import {
  KIND_LABEL,
  checkTotals,
  countByKind,
  documentsRead,
  findingStates,
  kindTone,
  messagesPerEngineer,
  pct,
  runChecks,
  SERIES,
  eventSubject,
} from "@/components/overview/metrics";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Page() {
  const { events, graph } = useEvidence();

  const byKind = useMemo(() => countByKind(events), [events]);
  const runs = useMemo(() => runChecks(events), [events]);
  const totals = useMemo(() => checkTotals(events), [events]);
  const engineers = useMemo(() => messagesPerEngineer(events), [events]);
  const states = useMemo(() => findingStates(graph, events), [graph, events]);
  const docs = useMemo(() => documentsRead(events), [events]);
  const timeline = useMemo(
    () => [...events].sort((a, b) => a.at.localeCompare(b.at)).map((ev) => ({ id: ev.event_id, at: ev.at, tone: kindTone(ev.kind), label: `${KIND_LABEL[ev.kind]} · ${eventSubject(ev)}` })),
    [events],
  );

  return (
    <>
      <PageHeader title="Analytics" subtitle="Shape of the evidence log. Bars count events; nothing here is recomputed from a card." />
      <Tile title="Totals" index={0}>
        <StatGrid>
          <Stat label="Events" value={String(events.length)} hint="all kinds" />
          <Stat label="Checker runs" value={String(totals.runs)} hint={`${totals.total} checks`} />
          <Stat label="Checks passing" value={pct(totals.pass, totals.total)} hint={`${totals.pass} of ${totals.total}`} />
          <Stat label="Findings" value={String(states.live + states.stale)} hint={`${states.live} live · ${states.stale} stale`} />
        </StatGrid>
        <SourceCaption>events[], check_run.checks[], graph.findings[]</SourceCaption>
      </Tile>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tile title="Events by kind" subtitle={`${events.length} total`} index={1}>
          <BarList rows={byKind.map((r) => ({ label: KIND_LABEL[r.kind], value: r.count }))} />
          <SourceCaption>event.kind</SourceCaption>
        </Tile>

        <Tile title="Checks per run" subtitle="pass vs fail" index={2}>
          <StackedRunBars cols={runs.map((r) => ({ key: r.run_id, label: r.run_id.slice(-4), pass: r.pass, fail: r.fail }))} />
          <SourceCaption>check_run.checks[].pass</SourceCaption>
        </Tile>

        <Tile title="Messages per engineer" subtitle="deduped by ts" index={3}>
          <BarList rows={engineers.map((e) => ({ label: e.from, value: e.count, hint: e.changes > 0 ? `${e.changes} change${e.changes === 1 ? "" : "s"}` : undefined }))} />
          <SourceCaption>message_read.from, .is_change</SourceCaption>
        </Tile>

        <Tile title="Findings by state" index={4}>
          <BarList
            rows={[
              { label: "live", value: states.live, color: "var(--color-success)" },
              { label: "stale", value: states.stale, color: "var(--color-warning)" },
              { label: "refused run", value: states.refused, color: "var(--color-danger)" },
            ]}
          />
          <SourceCaption>graph.findings[].status, publish_refused</SourceCaption>
        </Tile>

        <Tile title="Documents by revision" subtitle={`${docs.length} distinct`} index={5}>
          <BarList
            rows={docs.map((d, i) => ({ label: `${d.document}${d.revision ? ` · ${d.revision}` : ""}`, value: d.reads, hint: d.sha256.slice(0, 8), color: SERIES[i % SERIES.length] }))}
            unit="reads"
          />
          <SourceCaption>document_read.sha256, .revision</SourceCaption>
        </Tile>

        <Tile title="Events over time" subtitle="tall ticks are state changes" index={6} className="md:col-span-2 xl:col-span-1">
          <TimelineStrip points={timeline} />
          <SourceCaption>event.at</SourceCaption>
        </Tile>
      </div>
    </>
  );
}
