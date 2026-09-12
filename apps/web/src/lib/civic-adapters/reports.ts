/**
 * Civic -> ThreadRev adapter.
 *
 * Civic's analytics screen reasons about "reports". Here a report is a
 * published finding, derived from the evidence log alone:
 *   status       live -> open (in_progress when a person must decide),
 *                stale -> closed, refused run -> rejected
 *   severity     1-5 from the failing-check count of the finding's checker run
 *   category     checker + card kind (discrepancy / clean / question)
 *   reporter     engineer whose message triggered the run
 *   created_at   finding_published.at; completed_at = finding_superseded.at
 *   team         channel of the scenario the finding was recorded in
 *   address      primary evidence source (document + revision, or message ts)
 */
import type { EvidenceEvent, Finding } from "agent-core/shared";
import type { DashboardReport } from "@/civic/lib/dashboard-data";
import type { ReportCategory } from "@/civic/lib/types";
import type { TeamId } from "@/civic/lib/teams";
import { isValidTeamId } from "@/civic/lib/teams";
import { type DemoScenario, SCENARIOS } from "@/lib/demo/scenarios";
import { HOUR_MS } from "@/civic/lib/time-constants";

export interface ReasoningSection {
  title: string;
  value: string;
}

export interface ReasoningResponse {
  reportId: string;
  reasoning: string;
  costBreakdown: ReasoningSection[];
  scoringExplanation: ReasoningSection[];
}

/** Where a report's evidence lives in the console, plus the log slice that produced it. */
export interface ReportEvidence {
  /** Graph node id (finding_id or run_id) to highlight on /graph. */
  nodeId: string;
  links: { label: string; href: string; mono?: boolean }[];
  log: { at: string; kind: EvidenceEvent["kind"]; text: string }[];
}

export interface AnalyticsCorpus {
  reports: DashboardReport[];
  reasoning: Map<string, ReasoningResponse>;
  evidence: Map<string, ReportEvidence>;
  /** Reference "now": one hour after the latest recorded event. */
  now: number;
}

type CheckRun = Extract<EvidenceEvent, { kind: "check_run" }>;
type MessageRead = Extract<EvidenceEvent, { kind: "message_read" }>;

const KNOWN_CATEGORIES: readonly ReportCategory[] = [
  "rc:discrepancy",
  "rc:clean",
  "rc:question",
  "route:discrepancy",
  "route:clean",
  "route:question",
];

function clampSeverity(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5;
}

function categoryOf(checker: string, finding?: Finding): ReportCategory {
  const kind = finding?.question
    ? "question"
    : !finding || finding.discrepancy === "none"
      ? "clean"
      : "discrepancy";
  const key = `${checker}:${kind}` as ReportCategory;
  return KNOWN_CATEGORIES.includes(key) ? key : "other";
}

function sourceLabel(finding: Finding): string {
  const s = finding.sources[0];
  if (!s) return "Unknown";
  return s.kind === "document"
    ? `${s.id}${s.revision ? ` ${s.revision}` : ""}`
    : `message ${s.id}`;
}

/** Deterministic pseudo-coordinate per source so hotspot grouping (same
 *  source recurring across weeks) works without inventing geography. */
function pseudoLocation(key: string): { lng: number; lat: number } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { lng: (h % 1000) / 100, lat: ((h >>> 10) % 1000) / 100 };
}

function num(v: unknown): string {
  return typeof v === "number"
    ? String(Math.round(v * 1000) / 1000)
    : String(v ?? "-");
}

function checkSections(run: CheckRun | undefined): ReasoningSection[] {
  const rows = (run?.checks ?? []).map((c) => ({
    title: `${c.pass ? "Pass" : "Fail"} - ${c.name}`,
    value: `expected ${num(c.expected)}, actual ${num(c.actual)}`,
  }));
  return rows.length
    ? rows
    : [{ title: "Checks", value: "No checker run recorded" }];
}

function logLine(e: EvidenceEvent): string {
  switch (e.kind) {
    case "message_read":
      return `${e.is_bot ? "bot" : e.from}: ${e.text.slice(0, 90)}${e.text.length > 90 ? "…" : ""}`;
    case "workspace_search":
      return `workspace search · ${e.returned} of ${e.total} hit${e.total === 1 ? "" : "s"}`;
    case "document_read":
      return `read ${e.document}${e.revision ? ` ${e.revision}` : ""} · ${e.sha256.slice(0, 8)}`;
    case "check_run":
      return `${e.checker} ${e.version} · ${e.checks.filter((c) => !c.pass).length} of ${e.checks.length} failing`;
    case "finding_published":
      return `published ${e.finding.finding_id} · ${e.finding.discrepancy}`;
    case "finding_superseded":
      return `superseded ${e.finding_id}`;
    case "publish_refused":
      return `refused · ${e.reason}`;
    case "silence":
      return `silent · ${e.reason}`;
    case "edit_proposed":
      return `edit proposed against ${e.source_sha256.slice(0, 8)}`;
    case "edit_decided":
      return `edit ${e.decision}`;
    case "edit_applied":
      return `edit applied · ${e.sha256.slice(0, 8)}`;
  }
}

function traceLog(events: EvidenceEvent[], triggerTs: string | undefined, until: string): ReportEvidence["log"] {
  return events
    .filter((e) => (triggerTs ? e.trigger_ts === triggerTs : e.at <= until))
    .map((e) => ({ at: e.at, kind: e.kind, text: logLine(e) }));
}

function buildReasoning(
  id: string,
  finding: Finding,
  run: CheckRun | undefined,
): ReasoningResponse {
  const reproduced: ReasoningSection[] = finding.reproduced.map((r) => ({
    title: r.label,
    value: `${r.printed !== undefined ? `printed ${r.printed}, ` : ""}computed ${r.computed} ${r.unit}${
      r.matches === undefined ? "" : r.matches ? " (matches)" : " (mismatch)"
    }`,
  }));
  return {
    reportId: id,
    reasoning: finding.why_it_matters,
    costBreakdown: checkSections(run),
    scoringExplanation: [
      { title: "Discrepancy", value: finding.discrepancy },
      { title: "Resolution", value: finding.resolution },
      ...reproduced,
      {
        title: "Checker",
        value: `${finding.checker_run.checker} ${finding.checker_run.version}`,
      },
    ],
  };
}

export function buildCorpus(
  scenarios: DemoScenario[] = SCENARIOS,
): AnalyticsCorpus {
  const reports: DashboardReport[] = [];
  const reasoning = new Map<string, ReasoningResponse>();
  const evidence = new Map<string, ReportEvidence>();
  let latest = 0;

  for (const scenario of scenarios) {
    const events = scenario.events;
    const runs = new Map<string, CheckRun>();
    const messagesByTs = new Map<string, MessageRead>();
    const supersededAt = new Map<string, string>();
    for (const e of events) {
      latest = Math.max(latest, Date.parse(e.at));
      if (e.kind === "check_run") runs.set(e.run_id, e);
      else if (e.kind === "message_read") messagesByTs.set(e.ts, e);
      else if (e.kind === "finding_superseded")
        supersededAt.set(e.finding_id, e.at);
    }
    const team: TeamId | undefined = isValidTeamId(scenario.channel)
      ? scenario.channel
      : undefined;

    const reporterFor = (
      triggerTs: string | undefined,
      before: string,
    ): string => {
      const trig = triggerTs ? messagesByTs.get(triggerTs) : undefined;
      if (trig && !trig.is_bot) return trig.from;
      // Fallback: last human message read before this event.
      let last: MessageRead | undefined;
      for (const e of events) {
        if (e.kind === "message_read" && !e.is_bot && e.at <= before) last = e;
      }
      return last?.from ?? "Unknown";
    };

    for (const e of events) {
      if (e.kind === "finding_published") {
        const f = e.finding;
        const id = `${scenario.id}/${f.finding_id}`;
        const run = runs.get(f.checker_run.run_id);
        const failing = run ? run.checks.filter((c) => !c.pass).length : 0;
        const completed_at = supersededAt.get(f.finding_id);
        const status =
          completed_at || f.status === "stale"
            ? "closed"
            : f.question
              ? "in_progress"
              : "open";
        const address = sourceLabel(f);
        reports.push({
          id,
          category: categoryOf(f.checker_run.checker, f),
          severity: clampSeverity(failing === 0 ? 1 : failing),
          status,
          address,
          location: pseudoLocation(`${scenario.channel}|${address}`),
          photo_public_url: "",
          created_at: e.at,
          reporter_id: reporterFor(e.trigger_ts, e.at),
          tags: [scenario.title, f.requirements_revision],
          assigned_team: team,
          ai_reasoning: f.why_it_matters,
          completed_at,
        });
        reasoning.set(id, buildReasoning(id, f, run));
        evidence.set(id, {
          nodeId: f.finding_id,
          links: [
            { label: "Graph", href: `/graph?node=${encodeURIComponent(f.finding_id)}` },
            { label: "Finding", href: `/findings?id=${encodeURIComponent(f.finding_id)}` },
            { label: "Run", href: `/runs?id=${encodeURIComponent(f.checker_run.run_id)}` },
            ...(e.trigger_ts ? [{ label: "Thread", href: `/thread?ts=${encodeURIComponent(e.trigger_ts)}` }] : []),
            ...f.sources
              .filter((s) => s.kind === "document" && s.sha256)
              .map((s) => ({ label: s.id, href: `/documents?id=${encodeURIComponent(s.sha256 as string)}`, mono: true })),
          ],
          log: traceLog(events, e.trigger_ts, e.at),
        });
      } else if (e.kind === "publish_refused") {
        const id = `${scenario.id}/${e.run_id}`;
        const run = runs.get(e.run_id);
        const checker = run?.checker ?? e.run_id.split("-")[0];
        const failing = run ? run.checks.filter((c) => !c.pass).length : 0;
        const address =
          run?.evidence_refs[0]?.id ?? `revision ${e.bound_revision}`;
        reports.push({
          id,
          category: categoryOf(checker),
          severity: clampSeverity(failing === 0 ? 1 : failing),
          status: "rejected",
          address,
          location: pseudoLocation(`${scenario.channel}|${address}`),
          photo_public_url: "",
          created_at: e.at,
          reporter_id: reporterFor(e.trigger_ts, e.at),
          tags: [scenario.title],
          assigned_team: team,
          ai_reasoning: e.reason,
        });
        evidence.set(id, {
          nodeId: e.run_id,
          links: [
            { label: "Graph", href: `/graph?node=${encodeURIComponent(e.run_id)}` },
            { label: "Run", href: `/runs?id=${encodeURIComponent(e.run_id)}` },
            ...(e.trigger_ts ? [{ label: "Thread", href: `/thread?ts=${encodeURIComponent(e.trigger_ts)}` }] : []),
            ...(run?.evidence_refs ?? [])
              .filter((r) => r.kind === "document")
              .map((r) => ({ label: r.id.slice(0, 8), href: `/documents?id=${encodeURIComponent(r.id)}`, mono: true })),
          ],
          log: traceLog(events, e.trigger_ts, e.at),
        });
        reasoning.set(id, {
          reportId: id,
          reasoning: e.reason,
          costBreakdown: checkSections(run),
          scoringExplanation: [
            { title: "Bound revision", value: e.bound_revision },
            { title: "Current revision", value: e.current_revision },
            {
              title: "Checker",
              value: run ? `${run.checker} ${run.version}` : checker,
            },
          ],
        });
      }
    }
  }

  reports.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return { reports, reasoning, evidence, now: latest + HOUR_MS };
}

/** Every recorded scenario, built once. Static data: identical on server and client. */
export const ANALYTICS_CORPUS: AnalyticsCorpus = buildCorpus();

export function getReasoning(reportId: string): ReasoningResponse | undefined {
  return ANALYTICS_CORPUS.reasoning.get(reportId);
}

export function getEvidence(reportId: string): ReportEvidence | undefined {
  return ANALYTICS_CORPUS.evidence.get(reportId);
}
