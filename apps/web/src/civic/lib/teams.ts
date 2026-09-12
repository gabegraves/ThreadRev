import type { ReportCategory } from "@/civic/lib/types";

/* Civic "teams" map onto ThreadRev channels. Colors are token references
   (never literal hex) so the other agent can retune tokens.css freely. */

export type TeamId =
  | "all"
  | "#ks4-electrical"
  | "#ks4-purchasing"
  | "#ks4-strategy-sim";

export interface TeamMeta {
  id: TeamId;
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
  duties: string;
  categories: ReportCategory[];
}

export const TEAMS: Record<TeamId, TeamMeta> = {
  all: {
    id: "all",
    label: "All channels",
    shortLabel: "All channels",
    color: "var(--status-neutral-fg)",
    icon: "users",
    duties: "Every recorded scenario across channels.",
    categories: [],
  },
  "#ks4-electrical": {
    id: "#ks4-electrical",
    label: "#ks4-electrical",
    shortLabel: "#ks4-electrical",
    color: "var(--pastel-sky-strong)",
    icon: "zap",
    duties: "Precharge, bus capacitance, relay timing reviews.",
    categories: ["rc:discrepancy", "rc:clean", "rc:question"],
  },
  "#ks4-purchasing": {
    id: "#ks4-purchasing",
    label: "#ks4-purchasing",
    shortLabel: "#ks4-purchasing",
    color: "var(--pastel-butter-strong)",
    icon: "shopping-cart",
    duties: "Part sourcing threads that cross-reference electrical reviews.",
    categories: [],
  },
  "#ks4-strategy-sim": {
    id: "#ks4-strategy-sim",
    label: "#ks4-strategy-sim",
    shortLabel: "#ks4-strategy-sim",
    color: "var(--pastel-lavender-strong)",
    icon: "route",
    duties: "Route and simulation input reviews.",
    categories: ["route:discrepancy", "route:clean", "route:question"],
  },
};

export const TEAM_LIST: TeamMeta[] = Object.values(TEAMS);

export function isValidTeamId(value: string): value is TeamId {
  return value in TEAMS;
}
