"use client";

import { useEffect, useState } from "react";
import { buildEvidenceGraph, type EvidenceEvent, type EvidenceGraph } from "agent-core/shared";
import { SAMPLE_EVENTS } from "./sample-graph";

export type EvidenceState = {
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  sample: boolean;
  skipped: number;
  loaded: boolean;
  error: string | null;
};

type ApiPayload = { graph: EvidenceGraph; sample?: boolean; skipped?: number | unknown[]; events?: EvidenceEvent[] };

const POLL_MS = 5000;

const EMPTY: EvidenceGraph = { thread: "", nodes: [], edges: [], findings: [], generated_at: "" };

/** Polls GET /api/evidence every 5 s; falls back to the inline sample until the route answers. */
export function useEvidence(): EvidenceState {
  const [state, setState] = useState<EvidenceState>({ graph: EMPTY, events: [], sample: false, skipped: 0, loaded: false, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/evidence", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ApiPayload;
        if (!body?.graph?.nodes) throw new Error("no graph in response");
        if (cancelled) return;
        setState({
          graph: body.graph,
          events: body.events ?? [],
          sample: body.sample ?? false,
          skipped: Array.isArray(body.skipped) ? body.skipped.length : (body.skipped ?? 0),
          loaded: true,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // Nothing loaded yet: show the inline sample rather than an empty console.
        setState((prev) =>
          prev.loaded
            ? { ...prev, error: message }
            : { graph: buildEvidenceGraph(SAMPLE_EVENTS), events: SAMPLE_EVENTS, sample: true, skipped: 0, loaded: true, error: message },
        );
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return state;
}
