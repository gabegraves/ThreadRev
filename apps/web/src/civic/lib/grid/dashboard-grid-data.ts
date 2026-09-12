/* Ported from Civic src/lib/dashboard-grid-data.ts. The Supabase readers
   (getGridRows / getCityCrewOptions / fetchLiability) are gone — rows come
   from src/lib/civic-adapters/grid-rows.ts — so only the row shape remains,
   with the work-order cost/liability fields dropped and three ThreadRev
   fields added (team_key / team_label / bound_revision). */

import type { TeamId } from "./teams";

/**
 * One row of the findings grid. Field names keep Civic's report vocabulary so
 * the grid's cell renderers port unchanged; the adapter documents what each
 * one means for a finding.
 */
export interface GridReportRow {
  /** finding_id */
  report_id: string;
  /** Card kind: "discrepancy" | "clean" | "question". */
  category: string | null;
  /** The discrepancy text (searchable; shown as the Issue cell's title). */
  subcategory: string | null;
  /** 1–5, derived from failing checks in the finding's check_run. */
  severity: number | null;
  /** "live" | "stale" | "refused" — drives the Status column. */
  status: string;
  /** Bound revision label, shown where Civic showed the address. */
  address: string | null;
  /** finding_published.at */
  created_at: string;
  /** Checker name + version. */
  department: string | null;
  /** question.to, or null. */
  crew_type: string | null;
  /** Reproduced-value count (the Priority bar). */
  priority_score: number | null;
  /** True when the card carries inferred (un-recomputed) claims. */
  needs_manual_review: boolean;
  /** Team palette entry chosen for the channel. */
  team_key: TeamId;
  /** Channel name shown in the Team cell. */
  team_label: string;
  /** requirements_revision (Slack ts or document revision) — the SLA anchor. */
  bound_revision: string;
}

/** One assignable crew for the grid's crew control (no roster — the grid
 *  doesn't need names, just the unit). */
export interface GridCrewOption {
  id: string;
  name: string;
  teamKey: string;
  crewType: string | null;
}
