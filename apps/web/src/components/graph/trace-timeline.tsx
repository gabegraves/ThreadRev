"use client";

import type { ReactNode } from "react";
import type { EvidenceEvent } from "agent-core/shared";
import { Badge } from "@/civic-ui/components/Badge";
import { StatusPill } from "@/civic-ui/components/StatusPill";
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
};

const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-[11.5px] tabular-nums text-foreground">{children}</span>;

function Body({ ev, onPick }: { ev: EvidenceEvent; onPick: (id: string) => void }) {
  const link = (id: string, label: ReactNode) => (
    <button type="button" onClick={() => onPick(id)} className="font-mono text-[11.5px] tabular-nums text-foreground underline decoration-hairline-strong underline-offset-2 hover:decoration-[var(--foreground)]">
      {label}
    </button>
  );
  switch (ev.kind) {
    case "message_read":
      return (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            <span className="font-medium text-foreground">{ev.from}</span>
            {ev.ts === ev.trigger_ts && <Badge>trigger</Badge>}
            {ev.is_change && <Badge variant="warning">change</Badge>}
            {ev.is_bot && <Badge>bot</Badge>}
            {link(ev.ts, ev.ts)}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">{ev.text}</p>
        </>
      );
    case "document_read":
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
          <span className="font-medium text-foreground">{ev.document}</span>
          {ev.revision && <Badge>{ev.revision}</Badge>}
          <span className="text-faint">{ev.line_count} lines</span>
          {link(ev.sha256, `sha ${ev.sha256.slice(0, 12)}`)}
        </p>
      );
    case "check_run": {
      const s = checkSummary(ev.checks);
      return (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
            <span className="font-medium text-foreground">{ev.checker} v{ev.version}</span>
            {link(ev.run_id, ev.run_id)}
            <span className="text-faint">{s.passed}/{s.total} pass</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ev.checks.map((c) => (
              <StatusPill key={c.name} tone={c.pass ? "success" : "danger"} className="font-mono normal-case">
                <span title={`expected ${String(c.expected ?? "—")} · actual ${String(c.actual ?? "—")}`}>{c.name}</span>
              </StatusPill>
            ))}
          </div>
          {ev.error && <p className="mt-1 text-[12.5px] text-[var(--status-danger-fg)]">{ev.error}</p>}
        </>
      );
    }
    case "finding_published":
      return (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
            {link(ev.finding.finding_id, ev.finding.finding_id)}
            <StatusPill tone={ev.finding.status === "live" ? "success" : "warning"}>{ev.finding.status}</StatusPill>
            {ev.finding.supersedes && (
              <span className="text-faint">supersedes {link(ev.finding.supersedes, ev.finding.supersedes)}</span>
            )}
            <span className="text-faint">bound to <Mono>{ev.finding.requirements_revision}</Mono></span>
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">{ev.finding.discrepancy}</p>
        </>
      );
    case "finding_superseded":
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
          {link(ev.finding_id, ev.finding_id)}
          <span className="text-faint">marked stale by</span>
          {link(ev.superseded_by, ev.superseded_by)}
          {ev.cause_ts && <span className="text-faint">cause: message {fmtTime(ev.cause_ts)}</span>}
        </p>
      );
    case "publish_refused":
      return (
        <div className="rounded-[var(--radius-md)] border border-hairline bg-overlay p-2.5" style={{ boxShadow: "inset 3px 0 0 var(--color-danger)" }}>
          <p className="text-[12.5px]">{link(ev.run_id, ev.run_id)}</p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">bound</dt>
            <dd><Mono>{ev.bound_revision}</Mono> <span className="text-faint">{fmtTime(ev.bound_revision)}</span></dd>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">current</dt>
            <dd><Mono>{ev.current_revision}</Mono> <span className="text-faint">{fmtTime(ev.current_revision)}</span></dd>
          </dl>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-subtle">{ev.reason}</p>
        </div>
      );
    case "silence":
      return (
        <p className="flex items-center gap-2 text-[12.5px]">
          <StatusPill tone="neutral">{ev.reason.replace("_", " ")}</StatusPill>
          <span className="text-faint">{ev.reason === "gate_closed" ? "reviewer not addressed; nothing posted" : "reviewer ran, found nothing to say"}</span>
        </p>
      );
    case "workspace_search":
      return (
        <div className="text-[12.5px]">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-foreground">
              {ev.returned} of {ev.total} hits returned
            </span>
            {ev.cutoff && <span className="text-faint">· cutoff at {fmtTime(ev.cutoff)}</span>}
          </p>
          <p className="mt-1 font-mono text-[11px] text-subtle">
            {Object.entries(ev.query)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join(" · ")}
          </p>
        </div>
      );
  }
}

const TONE: Partial<Record<EvidenceEvent["kind"], string>> = {
  check_run: "var(--foreground)",
  finding_published: "var(--color-success)",
  finding_superseded: "var(--color-warning)",
  publish_refused: "var(--color-danger)",
};

export function TraceTimeline({ trace, onPick }: { trace: RunTrace | undefined; onPick: (id: string) => void }) {
  if (!trace) return <p className="text-[13px] text-faint">No events in this log.</p>;
  return (
    <ol className="flex flex-col">
      {trace.events.map((ev, i) => (
        <li key={ev.event_id} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="flex w-[18px] shrink-0 flex-col items-center">
            <span className="mt-1 size-2 rounded-full border border-hairline-strong" style={{ background: TONE[ev.kind] ?? "var(--elevated)" }} aria-hidden />
            {i < trace.events.length - 1 && <span className="mt-1 w-px flex-1 bg-hairline" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">{KIND_LABEL[ev.kind]}</span>
              <time dateTime={ev.at} className="font-mono text-[10.5px] tabular-nums text-faint">{new Date(ev.at).toLocaleTimeString("en-US", { timeZone: "America/New_York" })}</time>
            </p>
            <div className="mt-1">
              <Body ev={ev} onPick={onPick} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
