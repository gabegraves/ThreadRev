"use client";

/**
 * Findings page body: Civic's work-order grid (src/civic/grid) fed by the
 * adapter in src/lib/civic-adapters/grid-rows.ts. Row click / expand opens the
 * explorer overlay with FindingDetail (side pane at lg+, Drawer below), and
 * the selection is mirrored into `?id=` so the deep link keeps working.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkOrderGrid } from "@/civic/grid/work-order-grid";
import { toGridRows } from "@/lib/civic-adapters/grid-rows";
import type { GridReportRow } from "@/civic/lib/grid/dashboard-grid-data";
import { SCENARIOS } from "@/lib/demo/scenarios";
import { buildEvidenceGraph, type EvidenceEvent, type EvidenceGraph } from "agent-core/shared";
import { useEvidence } from "@/lib/demo/use-evidence";

export function FindingsExplorer() {
  const { graph, events, scenario, loaded, live } = useEvidence();
  const router = useRouter();
  const params = useSearchParams();

  // Memoized so the grid's `useEffect(() => setData(rows), [rows])` only
  // re-seeds when the evidence changes — a fresh array every render would wipe
  // session-only cell edits on each keystroke.
  // Demo mode lists every finding across all recorded scenarios (Civic's grid
  // is city-wide, not per report); live mode is the one polled log. Ids that
  // repeat across scenarios (A and A-cross share fixtures) keep their first row.
  const { rows, allGraph, allEvents } = useMemo(() => {
    if (live) return { rows: toGridRows(graph, events, scenario?.channel ?? null), allGraph: graph, allEvents: events };
    const seen = new Set<string>();
    const rows: GridReportRow[] = [];
    const findings: EvidenceGraph["findings"] = [];
    const allEvents: EvidenceEvent[] = [];
    for (const s of SCENARIOS) {
      const g = buildEvidenceGraph(s.events);
      for (const r of toGridRows(g, s.events, s.channel)) {
        if (seen.has(r.report_id)) continue;
        seen.add(r.report_id);
        rows.push(r);
        const f = g.findings.find((x) => x.finding_id === r.report_id);
        if (f) findings.push(f);
      }
      allEvents.push(...s.events);
    }
    return { rows, allGraph: { ...graph, findings }, allEvents };
  }, [live, graph, events, scenario]);

  // `?id=` → focusReportId. Only external navigation (initial load, back /
  // forward) should re-land the row; the grid's own selection writes the URL
  // through onSelectedChange and must not flash the highlight again.
  const paramId = params.get("id");
  const selfPushedRef = useRef<string | null>(paramId);
  const [focusId, setFocusId] = useState<string | null>(paramId);
  useEffect(() => {
    if (paramId !== selfPushedRef.current) {
      selfPushedRef.current = paramId;
      setFocusId(paramId);
    }
  }, [paramId]);

  const onSelectedChange = useCallback(
    (id: string | null) => {
      selfPushedRef.current = id;
      router.replace(id ? `/findings?id=${encodeURIComponent(id)}` : "/findings", { scroll: false });
    },
    [router],
  );

  if (loaded && rows.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center">
        <p className="text-[13px] text-faint">No findings in this evidence log yet.</p>
      </div>
    );
  }

  return <WorkOrderGrid rows={rows} graph={allGraph} events={allEvents} focusReportId={focusId} onSelectedChange={onSelectedChange} />;
}
