/* Ported from Civic src/lib/teams.ts. The category → team routing (and its
   client-side override store) is gone: ThreadRev rows carry a `team_key`
   chosen by the adapter, so only the palette/meta table survives. */

/* ------------------------------------------------------------------
   Team palette: 10 chromatic identities generated in OKLCH at a constant
   L=0.63 with C = min(0.185, 90% of the in-gamut maximum for that hue), so
   no single team out-shouts the rest while each stays vivid enough to read
   as a 6px dot on both --surface values (#fff / #101012). Hues keep their
   semantic anchor (water=cyan, stormwater=blue, parks=green, lighting=gold).
   Code Enforcement is the one reassignment: it had no meaningful hue (near-
   grey #b6b6bc, indistinguishable from All Teams and General Admin), so it
   took the open teal slot. All Teams and General Admin stay deliberately
   neutral (aggregate / triage) and are separated by lightness, not hue.
   Used as TEXT anywhere? Mix toward --team-text-mix (see globals.css) —
   the raw hues sit at ~3.3-3.9:1 on white, which is graphic-only contrast.
   ------------------------------------------------------------------ */

export type TeamId =
  | "all"
  | "streets_roads"
  | "sidewalks_ada"
  | "stormwater"
  | "water_utilities"
  | "street_lighting"
  | "traffic_engineering"
  | "parks_forestry"
  | "graffiti_abatement"
  | "code_enforcement"
  | "environmental_services"
  | "general_admin";

export interface TeamMeta {
  id: TeamId;
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
  duties: string;
}

export const TEAMS: Record<TeamId, TeamMeta> = {
  all: {
    id: "all",
    label: "All Teams (Admin View)",
    shortLabel: "All Teams",
    color: "#91919b",
    icon: "users",
    duties: "Citywide oversight across every department.",
  },
  streets_roads: {
    id: "streets_roads",
    label: "Streets & Roads Division",
    shortLabel: "Streets & Roads",
    color: "#f24335",
    icon: "construction",
    duties:
      "Pothole repair, milling, repaving, full street reconstruction. Curb/gutter, lane markings, asphalt and concrete maintenance.",
  },
  sidewalks_ada: {
    id: "sidewalks_ada",
    label: "Sidewalk & ADA Compliance Division",
    shortLabel: "Sidewalks & ADA",
    color: "#d97010",
    icon: "footprints",
    duties:
      "Sidewalk repair and replacement. Curb ramp installation and upgrades. ADA accessibility audits and trip hazard remediation.",
  },
  stormwater: {
    id: "stormwater",
    label: "Stormwater / Drainage Division",
    shortLabel: "Stormwater",
    color: "#4a80fa",
    icon: "waves",
    duties:
      "Catch basin cleaning, storm pipe maintenance, flood mitigation. 24/7 emergency response to localized flooding and stormwater pollution.",
  },
  water_utilities: {
    id: "water_utilities",
    label: "Water & Utilities Division",
    shortLabel: "Water & Utilities",
    color: "#129cd2",
    icon: "droplets",
    duties:
      "Water main breaks, leak detection, fire hydrant maintenance. Potable and reclaimed water distribution systems.",
  },
  street_lighting: {
    id: "street_lighting",
    label: "Street Lighting Division",
    shortLabel: "Street Lighting",
    color: "#b38b11",
    icon: "lightbulb",
    duties:
      "Streetlight repair, replacement, new installations. Energy efficiency upgrades and outage response.",
  },
  traffic_engineering: {
    id: "traffic_engineering",
    label: "Traffic Engineering & Signals Division",
    shortLabel: "Traffic Engineering",
    color: "#9a5af4",
    icon: "sign-post",
    duties:
      "Traffic signal installation/timing. Road pavement markings, signage, crosswalk safety, school zone systems.",
  },
  parks_forestry: {
    id: "parks_forestry",
    label: "Parks & Recreation / Urban Forestry",
    shortLabel: "Parks & Forestry",
    color: "#11a666",
    icon: "tree-pine",
    duties:
      "Park facility maintenance. Right-of-way tree trimming, removal, planting. Irrigation, turf, landscaping.",
  },
  graffiti_abatement: {
    id: "graffiti_abatement",
    label: "Graffiti Abatement / Community Beautification",
    shortLabel: "Graffiti Abatement",
    color: "#ea38b1",
    icon: "spray-can",
    duties:
      "Graffiti removal from public infrastructure and city facilities. Coordinates with code enforcement and law enforcement.",
  },
  code_enforcement: {
    id: "code_enforcement",
    label: "Code Enforcement Division",
    shortLabel: "Code Enforcement",
    color: "#12a4a5",
    icon: "shield-alert",
    duties:
      "Property maintenance violations, illegal dumping, derelict buildings, inoperable vehicles, unpermitted construction.",
  },
  environmental_services: {
    id: "environmental_services",
    label: "Environmental Services / Solid Waste",
    shortLabel: "Environmental Services",
    color: "#65a010",
    icon: "trash-2",
    duties:
      "Trash and recycling collection. Illegal dumping cleanup, bulky item pickup, household hazardous waste disposal, public debris.",
  },
  general_admin: {
    id: "general_admin",
    label: "General Administration / 311 Triage",
    shortLabel: "General Admin",
    color: "#787783",
    icon: "help-circle",
    duties:
      "Initial triage for uncategorized reports. Routes to appropriate department after manual review.",
  },
};

export const TEAM_LIST: TeamMeta[] = Object.values(TEAMS);

export function isValidTeamId(value: string): value is TeamId {
  return value in TEAMS;
}
