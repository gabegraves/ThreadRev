import type { ReportCategory, ReportStatus } from "@/civic/lib/types";

/* ------------------------------------------------------------------
   Analytics types
   ------------------------------------------------------------------ */

export interface AnalyticsKpis {
  /**
   * True when these numbers are illustrative rather than measured — the demo
   * literals below, or the fallback taken when the live aggregate errors or the
   * city has no reports yet. The UI must label them: an unmarked 76.5% reads to
   * anyone looking at the dashboard as a real outcome.
   */
  synthetic: boolean;
  resolution_rate_pct: number;
  resolution_rate_delta_pct: number;
  mttr_hours: number;
  mttr_delta_pct: number;
  sla_compliance_pct: number;
  sla_target_pct: number;
  active_backlog: number;
  backlog_delta_pct: number;
}

export interface TrendPoint {
  date: string; // ISO date (day)
  created: number;
  closed: number;
}

export interface ResolutionBucket {
  label: string; // e.g. "0-24h"
  hours_max: number;
  count: number;
}

export interface StatusFunnelStep {
  status: ReportStatus;
  label: string;
  count: number;
}

export interface SeveritySlice {
  severity: 1 | 2 | 3 | 4 | 5;
  count: number;
}

export interface HeatCell {
  day: number; // 0=Sun..6=Sat
  hour: number; // 0..23
  count: number;
}

export interface NeighborhoodVolume {
  name: string;
  count: number;
  open: number;
}

export interface CategoryResolution {
  category: ReportCategory;
  label: string;
  color: string;
  avg_hours: number;
  target_hours: number;
  count: number;
}

export interface ReporterVelocity {
  unique_reporters: number;
  reports_per_reporter: number;
  spark: number[]; // last 14 days
}

export interface RecurringHotspot {
  category: ReportCategory;
  label: string;
  color: string;
  lng: number;
  lat: number;
  total: number;
  open_count: number;
  episodes: number; // distinct weeks the spot recurred
  first_seen: string; // ISO date
  last_seen: string; // ISO date
}
