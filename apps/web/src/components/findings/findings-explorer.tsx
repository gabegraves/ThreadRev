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
import { useEvidence } from "@/lib/demo/use-evidence";

export function FindingsExplorer() {
  const { graph, events, scenario, loaded } = useEvidence();
  const router = useRouter();
  const params = useSearchParams();

  // Memoized so the grid's `useEffect(() => setData(rows), [rows])` only
  // re-seeds when the evidence changes — a fresh array every render would wipe
  // session-only cell edits on each keystroke.
  const rows = useMemo(() => toGridRows(graph, events, scenario?.channel ?? null), [graph, events, scenario]);

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

  if (loaded && graph.findings.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center">
        <p className="text-[13px] text-faint">No findings in this evidence log yet.</p>
      </div>
    );
  }

  return <WorkOrderGrid rows={rows} graph={graph} events={events} focusReportId={focusId} onSelectedChange={onSelectedChange} />;
}
