"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { SAMPLE_EVENTS, buildSampleGraph } from "./sample-graph";

export type EvidenceState = {
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  sample: boolean;
  skipped: number;
  source: "api" | "fallback";
  error: string | null;
};

type ApiPayload = { graph: EvidenceGraph; sample?: boolean; skipped?: number | unknown[]; events?: EvidenceEvent[] };

const POLL_MS = 5000;

function fallback(error: string | null): EvidenceState {
  return { graph: buildSampleGraph(), events: SAMPLE_EVENTS, sample: true, skipped: 0, source: "fallback", error };
}

/** Polls /api/evidence every 5 s; uses the inline sample until the route exists. */
export function useEvidence(): EvidenceState {
  const [state, setState] = useState<EvidenceState>(() => fallback(null));

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
          source: "api",
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => (prev.source === "api" ? { ...prev, error: String(err) } : fallback(String(err))));
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
