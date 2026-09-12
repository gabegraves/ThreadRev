/**
 * Thread messages → Civic grid rows (one row per message_read, in ts order).
 *
 *   ts / at         Slack ts of the message ("Reported" sorts on `at`, the ISO form)
 *   from / text     author + text (the Issue cell shows author + an excerpt)
 *   team_*          the scenario channel (same palette pick as grid-rows.ts)
 *   severity        worst severity across the cards published under this message
 *   priority        highest reproduced-value count across those cards
 *   status          status of the latest card under the message (refused when its
 *                   run was refused), "refused" when only a refusal was logged,
 *                   null when the message produced no card
 *   dept            trigger > change > message (a message can be both; trigger wins)
 *   cards           number of cards published under the message
 */
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import type { TeamId } from "@/civic/lib/grid/teams";
import type { ThreadModel } from "@/components/thread/thread-model";
import { tsToDate } from "@/components/review-console/graph-utils";
import { severityFromChecks, teamForChannel } from "./grid-rows";

export type ThreadRowStatus = "live" | "stale" | "refused";
export type ThreadRowDept = "trigger" | "change" | "message";

export interface ThreadGridRow {
  ts: string;
  at: string;
  from: string;
  text: string;
  is_change: boolean;
  is_bot: boolean;
  team_key: TeamId;
  team_label: string;
  severity: number | null;
  priority: number | null;
  status: ThreadRowStatus | null;
  dept: ThreadRowDept;
  cards: number;
}

export function toThreadRows(model: ThreadModel, graph: EvidenceGraph, events: EvidenceEvent[], channel: string | null): ThreadGridRow[] {
  const checkRuns = new Map<string, { fails: number; errored: boolean }>();
  const refusedRuns = new Set<string>();
  let fallbackChannel: string | null = null;
  for (const ev of events) {
    if (ev.kind === "check_run") checkRuns.set(ev.run_id, { fails: ev.checks.filter((c) => !c.pass).length, errored: ev.error != null });
    else if (ev.kind === "publish_refused") refusedRuns.add(ev.run_id);
    else if (ev.kind === "message_read" && ev.channel && !fallbackChannel) fallbackChannel = ev.channel;
  }
  const team_label = channel ?? fallbackChannel ?? "—";
  const team_key = team_label === "—" ? "general_admin" : teamForChannel(team_label);

  return model.messages.map((m): ThreadGridRow => {
    const inline = model.inlineByTs.get(m.ts) ?? [];
    const cards = inline.flatMap((i) => (i.kind === "card" ? [i.finding] : []));
    let severity: number | null = null;
    let priority: number | null = null;
    for (const f of cards) {
      const run = checkRuns.get(f.checker_run.run_id);
      if (run) severity = Math.max(severity ?? 0, severityFromChecks(run.fails, run.errored));
      priority = Math.max(priority ?? 0, f.reproduced.length);
    }
    const last = cards[cards.length - 1];
    const status: ThreadRowStatus | null = last
      ? refusedRuns.has(last.checker_run.run_id)
        ? "refused"
        : last.status
      : inline.some((i) => i.kind === "refused")
        ? "refused"
        : null;
    const at = tsToDate(m.ts);
    return {
      ts: m.ts,
      at: Number.isNaN(at.getTime()) ? m.at : at.toISOString(),
      from: m.from,
      text: m.text,
      is_change: m.is_change,
      is_bot: m.is_bot,
      team_key,
      team_label,
      severity,
      priority,
      status,
      dept: model.triggers.has(m.ts) ? "trigger" : m.is_change ? "change" : "message",
      cards: cards.length,
    };
  });
}
