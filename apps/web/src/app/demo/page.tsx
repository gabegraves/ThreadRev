"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FindingDetail } from "@/components/findings/finding-detail";
import { ThreadGrid } from "@/components/thread/thread-grid";
import { buildThreadModel } from "@/components/thread/thread-model";
import { toThreadRows } from "@/lib/civic-adapters/thread-rows";
import { EvidenceGraphNetwork, KindLegend } from "@/components/graph/graph-network";
import { NodeDetail } from "@/components/graph/node-detail";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { PageHeader } from "@/components/shell/page-header";
import { SCENARIOS } from "@/lib/demo/scenarios";
import { rehearsalSnapshots } from "@/lib/rehearsal";

const scenario = SCENARIOS.find((item) => item.id === "scenario-a")!;
const snapshots = rehearsalSnapshots(scenario.events);
const graph = snapshots.after.graph;
const current = graph.findings.find((finding) => finding.status === "live")!;
const first = snapshots.before.graph.findings[0];
const published = scenario.events.filter((event) => event.kind === "finding_published");
const scenes = ["Before / after", "Thread & overlay", "Evidence graph", "Applied result"] as const;
const button = "rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-subtle transition-colors hover:bg-overlay focus-visible:outline-2 focus-visible:outline-accent";

export default function DemoPage() {
  const [scene, setScene] = useState<(typeof scenes)[number]>("Before / after");
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const model = useMemo(() => buildThreadModel(scenario.events, graph), []);
  const rows = useMemo(() => toThreadRows(model, graph, scenario.events, scenario.channel), [model]);
  const edits = scenario.events.filter((event) => ["edit_proposed", "edit_decided", "edit_applied"].includes(event.kind));

  return (
    <>
      <PageHeader title="Demo rehearsal" subtitle="Actual web-console UI · 481f355 · Scenario A fixtures, not live Slack" />
      <nav aria-label="Rehearsal scenes" className="flex flex-wrap items-center gap-2">
        {scenes.map((name) => (
          <button key={name} type="button" aria-pressed={scene === name} onClick={() => setScene(name)} className={`${button} ${scene === name ? "!bg-foreground !text-background" : ""}`}>{name}</button>
        ))}
        <Link href="/thread" className={button}>Original thread page ↗</Link>
        <a href="https://app.slack.com/client/T0C1GD3C8FK/C0C188VNKMZ" target="_blank" rel="noreferrer" className={button}>Open actual Slack ↗</a>
      </nav>

      {scene === "Before / after" && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-[15px] font-semibold">Before correction · original finding is current</h2>
            <FindingDetail finding={first} graph={snapshots.before.graph} events={snapshots.before.events} />
          </section>
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-[15px] font-semibold">After correction · 820 µF supersedes the first finding</h2>
            <FindingDetail finding={current} graph={graph} events={scenario.events} />
          </section>
        </div>
      )}

      {scene === "Thread & overlay" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => setFocus(published[0].trigger_ts ?? null)}>Show initial request</button>
            <button type="button" className={button} onClick={() => setFocus(published[published.length - 1].trigger_ts ?? null)}>Show correction</button>
          </div>
          <div className="relative flex min-h-[650px] flex-col overflow-hidden rounded-md border border-hairline">
            <ThreadGrid rows={rows} model={model} graph={graph} events={scenario.events} channelId={scenario.channel_id} focusTs={focus} onSelectedChange={(ts) => { if (ts === null) setFocus(null); }} onOpenFinding={(id) => { setSelected(id); setScene("Evidence graph"); }} />
          </div>
        </>
      )}

      {scene === "Evidence graph" && (
        <div className="flex h-[800px] min-h-[650px] flex-col overflow-hidden border border-hairline bg-background lg:h-[650px] lg:flex-row">
          <section className="flex min-w-0 flex-1 flex-col"><div className="min-h-[500px] flex-1"><EvidenceGraphNetwork graph={graph} selected={selected} onSelect={setSelected} /></div><KindLegend /></section>
          <aside className="custom-scrollbar max-h-[300px] w-full overflow-y-auto border-t border-hairline bg-surface lg:max-h-none lg:w-[380px] lg:border-t-0 lg:border-l"><NodeDetail graph={graph} events={scenario.events} node={graph.nodes.find((node) => node.id === selected) ?? null} onPick={setSelected} note={selected ? notes[selected] : undefined} onSaveNote={(id, note) => setNotes((previous) => ({ ...previous, [id]: note }))} /></aside>
        </div>
      )}

      {scene === "Applied result" && (
        <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5">
          <h2 className="text-[16px] font-semibold">Recorded approval and resulting copy</h2>
          <p className="text-[13px] text-subtle">These are the existing fixture events rendered by the actual activity feed. Approve / Reject belongs to the Slack card; this preview does not execute an edit.</p>
          <ActivityFeed events={edits} />
          {edits.map((event) => event.kind === "edit_proposed" ? <div key={event.event_id} className="text-[14px]">{event.edits.map((edit) => <p key={edit.locator}>{edit.locator}: <code>{edit.find}</code> → <code>{edit.replace}</code></p>)}</div> : event.kind === "edit_applied" ? <div key={event.event_id} className="break-all text-[13px] text-subtle"><p>New copy: {event.output}</p><p>New SHA: {event.sha256}</p><p>Original SHA: {event.source_sha256} · unchanged</p></div> : null)}
        </section>
      )}
    </>
  );
}
