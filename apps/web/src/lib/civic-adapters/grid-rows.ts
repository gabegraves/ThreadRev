/**
 * Findings → Civic grid rows.
 *
 * Every column of the ported work-order grid reads a GridReportRow field;
 * this is the one place that says what each field means for a finding:
 *
 *   report_id       finding_id
 *   created_at      finding_published.at for that finding ("" → "—")
 *   category        card kind: discrepancy | clean | question
 *   subcategory     discrepancy text
 *   team_*          the scenario channel (palette entry picked by name hash)
 *   severity        failing checks in the finding's check_run → 1–5
 *   priority_score  reproduced-value count
 *   status          live | stale | refused (refused = a publish_refused event
 *                   for the same run_id, the predicate FindingDetail uses)
 *   bound_revision  requirements_revision (SLA age anchor)
 *   department      checker name + version
 *   crew_type       question.to or null
 */
import type { EvidenceEvent, EvidenceGraph, Finding } from "agent-core/shared";
import type { GridReportRow } from "@/civic/lib/grid/dashboard-grid-data";
import { TEAM_LIST, type TeamId } from "@/civic/lib/grid/teams";

export type CardKind = "discrepancy" | "clean" | "question";

export function cardKindOf(f: Finding): CardKind {
  if (f.discrepancy === "none") return "clean";
  if (f.question) return "question";
  return "discrepancy";
}

/** 0 fails → 1 (Minor), 1 → 3 (Moderate), 2 → 4 (High), 3+ or a run error → 5. */
function severityFromChecks(fails: number, errored: boolean): number {
  if (errored || fails >= 3) return 5;
  return [1, 3, 4][fails] ?? 5;
}

// Chromatic teams only — "all" and "general_admin" are the neutral pair.
const CHROMATIC: TeamId[] = TEAM_LIST.filter((t) => t.id !== "all" && t.id !== "general_admin").map((t) => t.id);

function teamForChannel(channel: string): TeamId {
  let h = 0;
  for (const ch of channel) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHROMATIC[h % CHROMATIC.length] ?? "general_admin";
}

export function toGridRows(graph: EvidenceGraph, events: EvidenceEvent[], channel: string | null): GridReportRow[] {
  const publishedAt = new Map<string, string>();
  const checkRuns = new Map<string, { fails: number; errored: boolean }>();
  const refusedRuns = new Set<string>();
  let fallbackChannel: string | null = null;
  for (const ev of events) {
    if (ev.kind === "finding_published") publishedAt.set(ev.finding.finding_id, ev.at);
    else if (ev.kind === "check_run") checkRuns.set(ev.run_id, { fails: ev.checks.filter((c) => !c.pass).length, errored: ev.error != null });
    else if (ev.kind === "publish_refused") refusedRuns.add(ev.run_id);
    else if (ev.kind === "message_read" && ev.channel && !fallbackChannel) fallbackChannel = ev.channel;
  }
  const team_label = channel ?? fallbackChannel ?? "—";
  const team_key = team_label === "—" ? "general_admin" : teamForChannel(team_label);

  return graph.findings.map((f): GridReportRow => {
    const run = checkRuns.get(f.checker_run.run_id);
    return {
      report_id: f.finding_id,
      category: cardKindOf(f),
      subcategory: f.discrepancy === "none" ? null : f.discrepancy,
      severity: run ? severityFromChecks(run.fails, run.errored) : null,
      status: refusedRuns.has(f.checker_run.run_id) ? "refused" : f.status,
      address: f.requirements_revision,
      created_at: publishedAt.get(f.finding_id) ?? "",
      department: `${f.checker_run.checker} ${f.checker_run.version}`,
      crew_type: f.question?.to ?? null,
      priority_score: f.reproduced.length,
      needs_manual_review: f.inferred.length > 0,
      team_key,
      team_label,
      bound_revision: f.requirements_revision,
    };
  });
}
