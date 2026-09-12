"use client";

import { useState } from "react";
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { defaultTrace, fmtTime, runTraces } from "./graph-utils";
import { EvidenceGraphSvg } from "./graph";

function TraceItem({ ev }: { ev: EvidenceEvent }) {
  const time = <time dateTime={ev.at}>{new Date(ev.at).toLocaleTimeString("en-US", { timeZone: "America/New_York" })}</time>;
  switch (ev.kind) {
    case "message_read":
      return (
        <li data-kind={ev.trigger_ts === ev.ts ? "trigger" : "message"}>
          {time}
          <div><strong>{ev.trigger_ts === ev.ts ? "trigger" : "message read"}</strong> · {ev.from}{ev.is_change && <span className="ck-tr-change">change</span>}<p>{ev.text}</p></div>
        </li>
      );
    case "workspace_search":
      return (
        <li data-kind="search">
          {time}
          <div>
            <strong>searched workspace</strong> · {ev.returned} of {ev.total} hits
            <p>
              {Object.entries(ev.query)
                .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
                .join(" · ")}
              {ev.cutoff ? ` · cutoff ${fmtTime(ev.cutoff)}` : ""}
            </p>
            {ev.hit_ts.length > 0 && (
              <p>
                hits:{" "}
                {ev.hit_ts.map((ts) => (
                  <code key={ts}>{fmtTime(ts)} </code>
                ))}
              </p>
            )}
          </div>
        </li>
      );
    case "document_read":
      return (
        <li data-kind="document">
          {time}
          <div><strong>document read</strong><p>{ev.document}{ev.revision ? ` (${ev.revision})` : ""} · {ev.line_count} lines · sha <code>{ev.sha256.slice(0, 8)}</code></p></div>
        </li>
      );
    case "check_run":
      return (
        <li data-kind="run">
          {time}
          <div>
            <strong>check run</strong> · <code>{ev.checker} v{ev.version} · {ev.run_id}</code>
            <div className="ck-tr-chips">
              {ev.checks.map((c) => (
                <span key={c.name} className="ck-tr-chip" data-pass={String(c.pass)} title={`expected ${String(c.expected)} · actual ${String(c.actual)}`}>
                  {c.pass ? "pass" : "fail"} · {c.name}
                </span>
              ))}
            </div>
            {ev.error && <p className="ck-error">{ev.error}</p>}
          </div>
        </li>
      );
    case "finding_published":
      return (
        <li data-kind="publish">
          {time}
          <div><strong>published</strong> · <code>{ev.finding.finding_id}</code>{ev.finding.supersedes && <> supersedes <code>{ev.finding.supersedes}</code></>}<p>{ev.finding.discrepancy}</p></div>
        </li>
      );
    case "finding_superseded":
      return (
        <li data-kind="supersede">
          {time}
          <div><strong>superseded</strong> · <code>{ev.finding_id}</code> by <code>{ev.superseded_by}</code>{ev.cause_ts && <p>cause: message {fmtTime(ev.cause_ts)}</p>}</div>
        </li>
      );
    case "publish_refused":
      return (
        <li data-kind="refuse">
          {time}
          <div><strong>refused</strong> · <code>{ev.run_id}</code><p>bound {ev.bound_revision}, current {ev.current_revision}. {ev.reason}</p></div>
        </li>
      );
    case "silence":
      return (
        <li data-kind="silence">
          {time}
          <div><strong>silence</strong><p>{ev.reason}</p></div>
        </li>
      );
    case "edit_proposed":
      return (
        <li data-kind="proposal">
          {time}
          <div><strong>edit proposed</strong> · <code>{ev.proposal_id}</code><p>{ev.document}: {ev.edits.map((e) => `${e.locator}: "${e.find}" → "${e.replace}"`).join("; ")}</p></div>
        </li>
      );
    case "edit_decided":
      return (
        <li data-kind={ev.decision === "approved" ? "approve" : "reject"}>
          {time}
          <div><strong>edit {ev.decision}</strong> · <code>{ev.proposal_id}</code>{ev.by && <p>by {ev.by}</p>}</div>
        </li>
      );
    case "edit_applied":
      return (
        <li data-kind="applied">
          {time}
          <div><strong>edit applied</strong> · <code>{ev.proposal_id}</code><p>{ev.error ? ev.error : `${ev.output} · sha ${ev.sha256.slice(0, 8)} (source ${ev.source_sha256.slice(0, 8)} untouched)`}</p></div>
        </li>
      );
    default:
      return null;
  }
}

export function EvidenceTab({ graph, events }: { graph: EvidenceGraph; events: EvidenceEvent[] }) {
  const traces = runTraces(events);
  const [selected, setSelected] = useState<string | null>(null);
  const current = traces.find((t) => t.trigger_ts === selected) ?? defaultTrace(traces);
  return (
    <div className="ck-tr-evidence">
      <div className="ck-tr-trace">
        <label className="ck-tr-run-pick">
          Run
          <select value={current?.trigger_ts ?? ""} onChange={(e) => setSelected(e.target.value)}>
            {traces.map((t) => <option key={t.trigger_ts} value={t.trigger_ts}>{t.label}</option>)}
          </select>
        </label>
        {current ? <ol className="ck-timeline ck-tr-timeline">{current.events.map((ev) => <TraceItem key={ev.event_id} ev={ev} />)}</ol> : <p className="ck-empty">No events.</p>}
      </div>
      <div className="ck-tr-graph-pane">
        <p className="ck-muted">Hover a node to see its downstream set. Click for details.</p>
        <EvidenceGraphSvg graph={graph} />
      </div>
    </div>
  );
}
