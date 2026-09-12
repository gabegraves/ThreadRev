"use client";

/**
 * The one data hook every page uses.
 *
 * Returns the selected scenario's events plus the graph agent-core builds from
 * them, so numbers on screen always trace to an event. For the "live" scenario
 * it polls GET /api/evidence every 5 s; demo scenarios are static.
 */
import { useEffect, useMemo, useState } from "react";
import { buildEvidenceGraph, type EvidenceEvent, type EvidenceGraph } from "agent-core/shared";
import { type DemoScenario, SCENARIOS } from "./scenarios";
import { LIVE_ID, useScenarioId } from "./store";

export type EvidenceView = {
  scenario: DemoScenario | null;
  scenarioId: string;
  live: boolean;
  /** True when the live route answered with agent-core's sample log. */
  sample: boolean;
  events: EvidenceEvent[];
  graph: EvidenceGraph;
  loaded: boolean;
  error: string | null;
};

type ApiPayload = { graph: EvidenceGraph; sample?: boolean; events?: EvidenceEvent[] };

const POLL_MS = 5000;
const EMPTY: EvidenceGraph = { thread: "", nodes: [], edges: [], findings: [], generated_at: "" };

export function useEvidence(): EvidenceView {
  const scenarioId = useScenarioId();
  const live = scenarioId === LIVE_ID;
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) ?? null, [scenarioId]);
  const [remote, setRemote] = useState<{ events: EvidenceEvent[]; graph: EvidenceGraph; sample: boolean; error: string | null; loaded: boolean }>({
    events: [],
    graph: EMPTY,
    sample: false,
    error: null,
    loaded: false,
  });

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/evidence", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ApiPayload;
        if (cancelled) return;
        setRemote({ events: body.events ?? [], graph: body.graph, sample: body.sample ?? false, error: null, loaded: true });
      } catch (err) {
        if (cancelled) return;
        setRemote((p) => ({ ...p, error: err instanceof Error ? err.message : String(err), loaded: true }));
      }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [live]);

  const demo = useMemo(() => {
    if (!scenario) return { events: [] as EvidenceEvent[], graph: EMPTY };
    return { events: scenario.events, graph: buildEvidenceGraph(scenario.events) };
  }, [scenario]);

  if (live) return { scenario: null, scenarioId, live, sample: remote.sample, events: remote.events, graph: remote.graph, loaded: remote.loaded, error: remote.error };
  return { scenario, scenarioId, live, sample: false, events: demo.events, graph: demo.graph, loaded: true, error: null };
}
