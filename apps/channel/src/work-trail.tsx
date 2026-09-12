/**
 * "Show your work."
 *
 * Every reviewer action already appends an event to the evidence log, and
 * until now nothing read it back: the log was written for a console that does
 * not exist yet, so the reasoning it captures was invisible to the people in
 * the thread it was captured from.
 *
 * This renders that trail on request. It is built from recorded events only —
 * never from the model — so it says what the reviewer actually did, including
 * the parts it would be more flattering to leave out, like a publish it
 * refused or a document whose instructions it ignored.
 */
import { Message, Header, Section, Markdown, Context } from "@copilotkit/channels";
import type { EvidenceEvent } from "agent-core";
import { fitLines } from "./finding-card";

const ACCENT = "#5B6478";

function when(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toISOString().slice(11, 19);
}

/** Where a message came from, when it was not this thread. */
function origin(e: { channel?: string; via?: string }): string {
  if (e.via !== "workspace_search") return "";
  return e.channel ? ` (found in ${e.channel})` : " (found by workspace search)";
}

/** One line per event, in the order they happened. */
function line(e: EvidenceEvent): string | undefined {
  switch (e.kind) {
    case "workspace_search": {
      const terms = Object.entries(e.query ?? {})
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ");
      return `• ${when(e.at)} searched the workspace for ${terms || "everything"} up to ${e.cutoff ?? "the trigger"} — ${e.returned} of ${e.total} match${e.total === 1 ? "" : "es"}`;
    }
    case "message_read":
      // A message pulled out of another channel is the interesting case and
      // was previously indistinguishable from one in this thread.
      if (e.via === "workspace_search") {
        return `• ${when(e.at)} read ${e.from}'s message${origin(e)}${e.is_change ? ", a change" : ""}: "${e.text.slice(0, 90)}"`;
      }
      return e.is_change
        ? `• ${when(e.at)} read ${e.from}'s message and treated it as a change: "${e.text.slice(0, 90)}"`
        : undefined;
    case "document_read":
      return `• ${when(e.at)} read ${e.document}${e.revision ? ` (${e.revision})` : ""}, ${e.line_count} lines, sha \`${e.sha256.slice(0, 12)}\``;
    case "check_run":
      return e.error
        ? `• ${when(e.at)} ran ${e.checker} v${e.version} and it failed: ${e.error}`
        : `• ${when(e.at)} ran ${e.checker} v${e.version} → ${e.checks.filter((c) => c.pass).length}/${e.checks.length} checks passed · run ${e.run_id}`;
    case "followup_filed":
      return e.filed
        ? `• ${when(e.at)} filed a follow-up for ${e.finding_id} in the workplace via ${e.tool ?? "a task tool"} — ${e.detail}`
        : `• ${when(e.at)} could not file a follow-up for ${e.finding_id}: ${e.detail}`;
    case "publish_refused":
      return `• ${when(e.at)} refused to publish run ${e.run_id}: ${e.reason} (bound ${e.bound_revision}, thread at ${e.current_revision})`;
    case "finding_published":
      return `• ${when(e.at)} posted ${e.finding.finding_id}, bound to revision ${e.finding.requirements_revision}`;
    case "finding_superseded":
      return `• ${when(e.at)} marked ${e.finding_id} stale, replaced by ${e.superseded_by}`;
    case "silence":
      return undefined;
  }
}

/**
 * How many times the reviewer decided there was nothing to say. Counted rather
 * than listed: the number is the interesting part, and one line per silent
 * message would bury everything else.
 */
function silences(events: EvidenceEvent[]): number {
  return events.filter((e) => e.kind === "silence").length;
}

export function renderWorkTrail(events: EvidenceEvent[]) {
  if (events.length === 0) {
    return (
      <Message accent={ACCENT}>
        <Header>Nothing recorded for this thread yet</Header>
        <Section>
          <Markdown>
            {"I have not read anything here yet, so there is no trail to show."}
          </Markdown>
        </Section>
      </Message>
    );
  }

  const lines = events.map(line).filter(Boolean) as string[];
  const quiet = silences(events);
  const searches = events.filter((e) => e.kind === "workspace_search").length;
  const elsewhere = events.filter(
    (e) => e.kind === "message_read" && (e as { via?: string }).via === "workspace_search",
  ).length;
  const docs = new Set(
    events.filter((e) => e.kind === "document_read").map((e) => (e as { sha256: string }).sha256),
  ).size;

  return (
    <Message accent={ACCENT}>
      <Header>What I did in this thread</Header>
      <Section>
        {/*
          One workspace search records an event per hit, so a busy thread
          overruns Slack's 3000-character section limit and the post is
          rejected outright — "show your work" failing silently at the moment
          someone is checking the reviewer. Measured at 6,679 characters for 40
          hits. fitLines keeps whole lines and says how many it left out.
        */}
        <Markdown>{lines.length > 0 ? fitLines(lines) : "I read the thread and found nothing worth a card."}</Markdown>
      </Section>
      <Context>
        {[
          `${events.length} recorded events`,
          `${docs} document${docs === 1 ? "" : "s"} read`,
          searches > 0 ? `${searches} workspace search${searches === 1 ? "" : "es"}` : undefined,
          elsewhere > 0 ? `${elsewhere} message${elsewhere === 1 ? "" : "s"} from other channels` : undefined,
          `stayed silent ${quiet} time${quiet === 1 ? "" : "s"}`,
        ]
          .filter(Boolean)
          .join(" · ") + ". Recorded as I worked, not reconstructed afterwards."}
      </Context>
    </Message>
  );
}
