"use client";

/** One reviewer run as a compact event list: kind + time, one line of detail. */
import type { ReactNode } from "react";
import type { EvidenceEvent } from "agent-core/shared";
import { fmtTime, type RunTrace } from "@/components/review-console/graph-utils";
import { checkSummary } from "@/components/runs/kv-table";

const KIND_LABEL: Record<EvidenceEvent["kind"], string> = {
  message_read: "message read",
  document_read: "document read",
  check_run: "check run",
  finding_published: "published",
  finding_superseded: "superseded",
  publish_refused: "refused",
  silence: "silence",
  workspace_search: "workspace search",
  edit_proposed: "edit proposed",
  edit_decided: "edit decided",
  edit_applied: "edit applied",
};

const TONE: Partial<Record<EvidenceEvent["kind"], string>> = {
  check_run: "var(--foreground)",
  finding_published: "var(--color-success)",
  finding_superseded: "var(--color-warning)",
  publish_refused: "var(--color-danger)",
};

/** The one line under each event's label: who / what, no nested cards. */
function summary(ev: EvidenceEvent, onPick: (id: string) => void): ReactNode {
  const link = (id: string, text?: string) => (
    <button type="button" onClick={() => onPick(id)} className="font-mono text-[12px] text-foreground underline decoration-hairline-strong underline-offset-2 hover:decoration-[var(--foreground)]">
      {text ?? id}
    </button>
  );
  switch (ev.kind) {
    case "message_read":
      return (
        <>
          <span className="text-foreground">{ev.from}</span> — {ev.text}
        </>
      );
    case "document_read":
      return `${ev.document}${ev.revision ? ` · ${ev.revision}` : ""} · ${ev.line_count} lines`;
    case "check_run": {
      const s = checkSummary(ev.checks);
      return (
        <>
          {link(ev.run_id)} · {s.passed}/{s.total} pass
          {ev.error ? ` · ${ev.error}` : ""}
        </>
      );
    }
    case "finding_published":
      return (
        <>
          {link(ev.finding.finding_id)} · {ev.finding.status} · bound to {ev.finding.requirements_revision}
        </>
      );
    case "finding_superseded":
      return (
        <>
          {link(ev.finding_id)} stale, replaced by {link(ev.superseded_by)}
        </>
      );
    case "publish_refused":
      return (
        <>
          {link(ev.run_id)} · bound {fmtTime(ev.bound_revision)}, now {fmtTime(ev.current_revision)} — {ev.reason}
        </>
      );
    case "silence":
      return ev.reason === "gate_closed" ? "reviewer not addressed; nothing posted" : "reviewer ran, found nothing to say";
    case "workspace_search":
      return `${ev.returned} of ${ev.total} hits returned`;
  }
}

export function TraceTimeline({ trace, onPick }: { trace: RunTrace | undefined; onPick: (id: string) => void }) {
  if (!trace) return <p className="text-[12px] text-faint">No events in this log.</p>;
  return (
    <ol className="flex flex-col divide-y divide-hairline">
      {trace.events.map((ev) => (
        <li key={ev.event_id} className="flex gap-3 py-2.5">
          <time dateTime={ev.at} className="mt-px w-14 shrink-0 font-mono text-[11px] tabular-nums text-faint">
            {new Date(ev.at).toLocaleTimeString("en-US", { timeZone: "America/New_York" })}
          </time>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full border border-hairline-strong" style={{ background: TONE[ev.kind] ?? "var(--elevated)" }} aria-hidden />
              <span className="text-[13px] font-semibold text-foreground">{KIND_LABEL[ev.kind]}</span>
            </p>
            <p className="truncate text-[13px] leading-relaxed text-foreground">{summary(ev, onPick)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
