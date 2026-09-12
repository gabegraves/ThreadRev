"use client";

import { useMemo } from "react";
import { buildEvidenceGraph } from "agent-core/shared";
import { DataTable, type Column } from "@/civic-ui/components/DataTable";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import type { StatusTone } from "@/civic-ui/lib/status";
import { SCENARIOS, type DemoScenario } from "@/lib/demo/scenarios";
import { cardKind } from "@/lib/demo/status";
import { checkSummary } from "./kv-table";

type ScoreRow = {
  scenario: DemoScenario;
  runs: number;
  passed: number;
  total: number;
  live: number;
  stale: number;
  refused: number;
  silences: number;
  /** null = no stated rule for this scenario; the row shows observed facts only. */
  verdict: { pass: boolean; rule: string } | null;
};

/**
 * Control expectations, derived from the events themselves:
 *   rc1  0 stale findings and a clean card
 *   rc2  a question card
 *   rc3  a refused run
 * Scenario rows carry no rule, so they get no pass/fail.
 */
function verdictFor(s: DemoScenario, r: Omit<ScoreRow, "scenario" | "verdict">, findings: ReturnType<typeof buildEvidenceGraph>["findings"]): ScoreRow["verdict"] {
  if (s.kind !== "control") return null;
  if (s.id.startsWith("rc1")) return { pass: r.stale === 0 && findings.some((f) => cardKind(f) === "clean"), rule: "0 stale + clean card" };
  if (s.id.startsWith("rc2")) return { pass: findings.some((f) => cardKind(f) === "question"), rule: "question card" };
  if (s.id.startsWith("rc3")) return { pass: r.refused > 0, rule: "refused run" };
  return null;
}

export function scoreRows(): ScoreRow[] {
  return SCENARIOS.map((scenario) => {
    const graph = buildEvidenceGraph(scenario.events);
    const runs = scenario.events.filter((e) => e.kind === "check_run");
    const sums = runs.map((e) => (e.kind === "check_run" ? checkSummary(e.checks) : { passed: 0, total: 0 }));
    const base = {
      runs: runs.length,
      passed: sums.reduce((a, b) => a + b.passed, 0),
      total: sums.reduce((a, b) => a + b.total, 0),
      live: graph.findings.filter((f) => f.status === "live").length,
      stale: graph.findings.filter((f) => f.status === "stale").length,
      refused: new Set(scenario.events.flatMap((e) => (e.kind === "publish_refused" ? [e.run_id] : []))).size,
      silences: scenario.events.filter((e) => e.kind === "silence").length,
    };
    return { scenario, ...base, verdict: verdictFor(scenario, base, graph.findings) };
  });
}

function VerdictPill({ v }: { v: ScoreRow["verdict"] }) {
  if (!v) return <StatusPill tone="neutral">no rule</StatusPill>;
  const tone: StatusTone = v.pass ? "success" : "danger";
  return <StatusPill tone={tone}>{v.pass ? "pass" : "fail"} · {v.rule}</StatusPill>;
}

export function Scorecard({ currentId }: { currentId: string }) {
  const rows = useMemo(scoreRows, []);
  const columns = useMemo<Column<ScoreRow>[]>(
    () => [
      { key: "scenario", header: "scenario", cell: (r) => <span className="font-medium">{r.scenario.title}</span> },
      { key: "kind", header: "kind", cell: (r) => <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">{r.scenario.kind}</span> },
      { key: "runs", header: "runs", align: "right", mono: true, cell: (r) => String(r.runs) },
      { key: "checks", header: "checks pass/total", align: "right", mono: true, cell: (r) => `${r.passed}/${r.total}` },
      { key: "findings", header: "findings live/stale", align: "right", mono: true, cell: (r) => `${r.live}/${r.stale}` },
      { key: "refused", header: "refused runs", align: "right", mono: true, cell: (r) => String(r.refused) },
      { key: "silences", header: "silences", align: "right", mono: true, cell: (r) => String(r.silences) },
      { key: "expected", header: "expected behaviour", cell: (r) => <span className="block max-w-[44ch] whitespace-normal text-[12.5px] text-subtle">{r.scenario.summary}</span> },
      { key: "verdict", header: "verdict", cell: (r) => <VerdictPill v={r.verdict} /> },
    ],
    [],
  );
  return <DataTable columns={columns} rows={rows} getRowId={(r) => r.scenario.id} focusedId={currentId} />;
}
