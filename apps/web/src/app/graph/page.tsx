"use client";

import { useEffect, useMemo, useState } from "react";
import { EvidenceGraphMap, MapLegend } from "@/components/graph/graph-map";
import { EdgeLegend, EvidenceGraphSvg } from "@/components/graph/graph-svg";
import { NodeDetail } from "@/components/graph/node-detail";
import { TraceTimeline } from "@/components/graph/trace-timeline";
import { defaultTrace, runTraces } from "@/components/review-console/graph-utils";
import { PageHeader } from "@/components/shell/page-header";
import { PillGroup } from "@/civic-ui/components/Tile";
import { useEvidence } from "@/lib/demo/use-evidence";

type GraphView = "columns" | "map";
const VIEW_KEY = "threadrev.graph-view";

export default function Page() {
  // Default to map; read the saved choice after mount so SSR and hydration agree.
  const [view, setView] = useState<GraphView>("map");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "columns" || saved === "map") setView(saved);
    } catch {}
  }, []);
  const pickView = (v: GraphView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const { graph, events } = useEvidence();
  const traces = useMemo(() => runTraces(events), [events]);
  const [pickedTrace, setPickedTrace] = useState<string | null>(null);
  const trace = traces.find((t) => t.trigger_ts === pickedTrace) ?? defaultTrace(traces);
  const [selected, setSelected] = useState<string | null>(null);
  const node = selected ? (graph.nodes.find((n) => n.id === selected) ?? null) : null;

  return (
    <>
      <PageHeader
        title="Evidence graph"
        subtitle="Built from the append-only event log by agent-core. Hover a node to light everything downstream of it; click to inspect what the log recorded."
      />
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">reviewer run</p>
            {traces.length > 2 ? (
              <select
                value={trace?.trigger_ts ?? ""}
                onChange={(e) => setPickedTrace(e.target.value)}
                className="h-9 rounded-[var(--radius-md)] border border-hairline bg-overlay px-2 text-[13px] text-foreground"
              >
                {traces.map((t) => (
                  <option key={t.trigger_ts} value={t.trigger_ts}>{t.label}</option>
                ))}
              </select>
            ) : (
              <PillGroup options={traces.map((t) => ({ value: t.trigger_ts, label: t.label }))} value={trace?.trigger_ts ?? ""} onChange={setPickedTrace} />
            )}
            {trace && (
              <p className="text-[12px] text-faint">
                {trace.events.length} events · {trace.hasRun ? "ran a checker" : "no checker run"}
              </p>
            )}
          </div>
          <div className="border-t border-hairline pt-4">
            <TraceTimeline trace={trace} onPick={setSelected} />
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">
              {graph.nodes.length} nodes · {graph.edges.length} edges
            </p>
            <PillGroup<GraphView> options={[{ value: "columns", label: "Columns" }, { value: "map", label: "Map" }]} value={view} onChange={pickView} />
          </div>
          {view === "map" ? (
            <>
              <EvidenceGraphMap graph={graph} selected={selected} onSelect={setSelected} />
              <div className="px-1">
                <MapLegend />
              </div>
            </>
          ) : (
            <>
              <EvidenceGraphSvg graph={graph} selected={selected} onSelect={setSelected} />
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <EdgeLegend />
                <ul className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
                  {(["live", "stale", "refused"] as const).map((s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px] border-[1.5px] bg-surface" style={{ borderColor: `var(--color-${s === "live" ? "success" : s === "stale" ? "warning" : "danger"})` }} aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <NodeDetail graph={graph} node={node} onPick={setSelected} />
      </div>
    </>
  );
}
