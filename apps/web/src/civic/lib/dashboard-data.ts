import type { TeamId } from "@/civic/lib/teams";
import type { ReportCategory, ReportStatus } from "@/civic/lib/types";

/* ------------------------------------------------------------------
   Dashboard-specific types (Civic shape, ThreadRev semantics):
   a report is a published finding. See src/lib/civic-adapters/reports.ts.
   ------------------------------------------------------------------ */

export interface DashboardReport {
  id: string;
  category: ReportCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  status: ReportStatus;
  address: string;
  location: { lng: number; lat: number };
  photo_public_url: string;
  created_at: string;
  reporter_id: string;
  tags?: string[];
  assigned_team?: TeamId;
  fix_cost_estimate?: number | null;
  fix_time_estimate_days?: number | null;
  fix_note?: string | null;
  marked_under_fix_at?: string | null;
  demo?: boolean;
  ai_reasoning?: string;
  afterPhoto?: string;
  completed_at?: string;
}

/* Category = checker + card kind. Colors are token references. */
export const CATEGORY_META: Record<
  ReportCategory,
  { label: string; color: string; icon: string }
> = {
  "rc:discrepancy": { label: "RC · discrepancy", color: "var(--status-danger-fg)", icon: "circle-alert" },
  "rc:clean": { label: "RC · clean", color: "var(--status-success-fg)", icon: "check" },
  "rc:question": { label: "RC · question", color: "var(--status-warning-fg)", icon: "help-circle" },
  "route:discrepancy": { label: "Route · discrepancy", color: "var(--pastel-blush-strong)", icon: "circle-alert" },
  "route:clean": { label: "Route · clean", color: "var(--pastel-mint-strong)", icon: "check" },
  "route:question": { label: "Route · question", color: "var(--pastel-butter-strong)", icon: "help-circle" },
  other: { label: "Other", color: "var(--status-neutral-fg)", icon: "help-circle" },
};

export function categoryMeta(category: string): {
  label: string;
  color: string;
  icon: string;
} {
  const builtin = CATEGORY_META[category as ReportCategory];
  if (builtin) return builtin;
  return {
    label: humanizeCategoryKey(category),
    color: CATEGORY_META.other.color,
    icon: CATEGORY_META.other.icon,
  };
}

function humanizeCategoryKey(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  if (words === "") return "Uncategorised";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* Supersession-time target (hours). Config, not evidence: one uniform
   window since ThreadRev has no per-checker SLA. */
const SLA_HOURS = 72;

export const CATEGORY_SLA_TARGETS: Record<ReportCategory, number> = {
  "rc:discrepancy": SLA_HOURS,
  "rc:clean": SLA_HOURS,
  "rc:question": SLA_HOURS,
  "route:discrepancy": SLA_HOURS,
  "route:clean": SLA_HOURS,
  "route:question": SLA_HOURS,
  other: SLA_HOURS,
};

export function categorySlaHours(category: string): number {
  return (
    CATEGORY_SLA_TARGETS[category as ReportCategory] ??
    CATEGORY_SLA_TARGETS.other
  );
}
