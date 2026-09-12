"use client";

import type { EvidenceGraph, Finding } from "agent-core/shared";
import { orderedFindings } from "./graph-utils";

function FindingDetail({ f }: { f: Finding }) {
  return (
    <details className="ck-tr-issue" data-status={f.status}>
      <summary>
        <span className="ck-tr-status" data-status={f.status}>{f.status}</span>
        <span className="ck-tr-issue-title">{f.discrepancy}</span>
      </summary>
      <dl className="ck-facts">
        <dt>Finding</dt><dd><code>{f.finding_id}</code>{f.supersedes && <> supersedes <code>{f.supersedes}</code></>}</dd>
        <dt>Revision</dt><dd><code>{f.requirements_revision}</code></dd>
        <dt>Why it matters</dt><dd>{f.why_it_matters}</dd>
        <dt>Reproduced</dt>
        <dd>
          {f.reproduced.length === 0 ? <span className="ck-muted">none</span> : (
            <ul className="ck-tr-repro">
              {f.reproduced.map((r) => (
                <li key={r.label} data-match={r.matches === undefined ? "na" : String(r.matches)}>
                  <span>{r.label}</span>
                  <code>{r.printed !== undefined ? `printed ${r.printed} → ` : ""}{r.computed} {r.unit}{r.tolerance !== undefined ? ` ±${r.tolerance}` : ""}</code>
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Inferred</dt>
        <dd>{f.inferred.length === 0 ? <span className="ck-muted">none</span> : <ul>{f.inferred.map((s) => <li key={s}>{s}</li>)}</ul>}</dd>
        <dt>Sources</dt>
        <dd>
          <ul className="ck-tr-sources">
            {f.sources.map((s, i) => (
              <li key={i}>
                <span className="ck-tr-kind">{s.kind}</span> <code>{s.id}</code>
                {s.revision && <> ({s.revision})</>}
                {s.sha256 && <> sha <code>{s.sha256.slice(0, 8)}</code></>}
                {s.locator && <> · {s.locator}</>}
                {s.quote && <blockquote>{s.quote}</blockquote>}
              </li>
            ))}
          </ul>
        </dd>
        {f.question && (<><dt>Question</dt><dd><strong>{f.question.to}:</strong> {f.question.ask}</dd></>)}
        <dt>Resolution</dt><dd>{f.resolution}</dd>
        <dt>Checker run</dt><dd><code>{f.checker_run.checker} v{f.checker_run.version} · {f.checker_run.run_id}</code></dd>
      </dl>
    </details>
  );
}

export function IssuesTab({ graph }: { graph: EvidenceGraph }) {
  const findings = orderedFindings(graph);
  if (findings.length === 0) return <p className="ck-empty">No findings yet.</p>;
  return <div className="ck-tr-list">{findings.map((f) => <FindingDetail key={f.finding_id} f={f} />)}</div>;
}
