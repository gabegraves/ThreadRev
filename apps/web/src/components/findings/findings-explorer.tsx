"use client";

/**
 * Findings page body: filter chips + DataTable of graph.findings in publish
 * order, with the selected finding's full card in a sticky right column (lg+)
 * or a Drawer (below lg). `?id=` preselects a row.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Finding } from "agent-core/shared";
import { type Column, DataTable } from "@/civic-ui/components/DataTable";
import { Drawer } from "@/civic-ui/components/Drawer";
import { SegmentedChips } from "@/civic-ui/components/FilterChips";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";
import { useEvidence } from "@/lib/demo/use-evidence";
import { FindingDetail } from "./finding-detail";

type Filter = "all" | "live" | "stale" | "question" | "clean";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "stale", label: "Stale" },
  { value: "question", label: "Needs decision" },
  { value: "clean", label: "Clean" },
];

function matches(f: Finding, filter: Filter) {
  switch (filter) {
    case "live":
      return f.status === "live";
    case "stale":
      return f.status === "stale";
    case "question":
      return Boolean(f.question);
    case "clean":
      return f.discrepancy === "none";
    default:
      return true;
  }
}

function rowKind(f: Finding): "discrepancy" | "clean" | "question" {
  if (f.discrepancy === "none") return "clean";
  if (f.question) return "question";
  return "discrepancy";
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function CountChip({ n, warn }: { n: number; warn?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-6 justify-center rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        warn && n > 0 ? "bg-pastel-butter font-semibold text-pastel-butter-strong" : "text-subtle",
      )}
    >
      {n}
    </span>
  );
}

const LG = "(min-width: 1024px)";
function useIsLg() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(LG);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(LG).matches,
    () => true,
  );
}

const COLUMNS: Column<Finding>[] = [
  {
    key: "status",
    header: "Status",
    cell: (f) => <StatusPill tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</StatusPill>,
  },
  { key: "kind", header: "Kind", cell: (f) => <span className="text-subtle">{rowKind(f)}</span> },
  {
    key: "discrepancy",
    header: "Discrepancy",
    width: "40ch",
    cell: (f) => (
      <span className="block max-w-[40ch] truncate" title={f.discrepancy}>
        {f.discrepancy === "none" ? <span className="text-faint">none</span> : truncate(f.discrepancy, 90)}
      </span>
    ),
  },
  { key: "revision", header: "Bound to revision", mono: true, cell: (f) => f.requirements_revision },
  { key: "run", header: "Checker run", mono: true, cell: (f) => f.checker_run.run_id },
  { key: "sources", header: "Sources", align: "right", cell: (f) => <CountChip n={f.sources.length} /> },
  { key: "reproduced", header: "Reproduced", align: "right", cell: (f) => <CountChip n={f.reproduced.length} /> },
  { key: "inferred", header: "Inferred", align: "right", cell: (f) => <CountChip n={f.inferred.length} warn /> },
  { key: "supersedes", header: "Supersedes", mono: true, cell: (f) => f.supersedes ?? <span className="text-faint">—</span> },
];

export function FindingsExplorer() {
  const { graph, events, loaded } = useEvidence();
  const router = useRouter();
  const params = useSearchParams();
  const isLg = useIsLg();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("id"));

  // Deep link changes (back/forward) re-select.
  const paramId = params.get("id");
  useEffect(() => {
    if (paramId) setSelectedId(paramId);
  }, [paramId]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      router.replace(id ? `/findings?id=${encodeURIComponent(id)}` : "/findings", { scroll: false });
    },
    [router],
  );

  const rows = useMemo(() => graph.findings.filter((f) => matches(f, filter)), [graph.findings, filter]);
  const selected = useMemo(() => graph.findings.find((f) => f.finding_id === selectedId) ?? null, [graph.findings, selectedId]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((o) => [o.value, graph.findings.filter((f) => matches(f, o.value)).length])) as Record<Filter, number>, [graph.findings]);

  if (loaded && graph.findings.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <p className="text-[13px] text-faint">No findings in this evidence log yet.</p>
      </div>
    );
  }

  const detail = selected ? <FindingDetail finding={selected} graph={graph} events={events} /> : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedChips options={FILTERS.map((o) => ({ value: o.value, label: `${o.label} ${counts[o.value]}` }))} value={filter} onChange={setFilter} />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">publish order · latest last</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(f) => f.finding_id}
          onRowClick={(f) => select(f.finding_id)}
          focusedId={selectedId}
          loading={!loaded}
          emptyMessage="No findings match this filter."
          className="min-w-0 self-start"
        />

        <aside className="hidden min-w-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto custom-scrollbar">
          {detail ?? (
            <div className="flex min-h-[200px] items-center justify-center rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
              <p className="text-[13px] text-faint">Select a finding to see its card.</p>
            </div>
          )}
        </aside>
      </div>

      <Drawer open={Boolean(selected) && !isLg} onClose={() => select(null)} title={selected?.finding_id}>
        {detail}
      </Drawer>
    </div>
  );
}
