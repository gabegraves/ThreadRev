"use client";

import { useState } from "react";
import type { EvidenceGraph, Finding } from "agent-core/shared";
import { changeDownstream, fmtTime, subgraph, type ThreadMessage } from "./graph-utils";
import { EvidenceGraphSvg } from "./graph";

function FindingCard({ finding }: { finding: Finding }) {
  const stale = finding.status === "stale";
  return (
    <article className={`ck-card ck-tr-card${stale ? " ck-tr-card--stale" : ""}`} aria-label="Reviewer finding">
      {stale && <span className="ck-tr-ribbon">STALE</span>}
      <h3>{finding.discrepancy === "none" ? "No discrepancy" : "Discrepancy"}</h3>
      <p>{finding.discrepancy}</p>
      {finding.reproduced.length > 0 && (
        <ul className="ck-tr-repro">
          {finding.reproduced.map((r) => (
            <li key={r.label} data-match={r.matches === undefined ? "na" : String(r.matches)}>
              <span>{r.label}</span>
              <code>
                {r.printed !== undefined ? `printed ${r.printed} → ` : ""}
                {r.computed} {r.unit}
              </code>
            </li>
          ))}
        </ul>
      )}
      <p className="ck-muted">
        bound to revision <code>{finding.requirements_revision}</code>
        {finding.supersedes && <> · supersedes <code>{finding.supersedes}</code></>}
      </p>
    </article>
  );
}

export function ThreadView({
  messages,
  graph,
  cardsByTs,
}: {
  messages: ThreadMessage[];
  graph: EvidenceGraph;
  /** Findings inserted after the message that triggered them. */
  cardsByTs: Map<string, Finding[]>;
}) {
  const [popover, setPopover] = useState<string | null>(null);
  const thread = graph.thread;
  return (
    <ol className="ck-tr-thread" aria-label="Reviewed thread">
      {messages.map((m) => {
        const cards = cardsByTs.get(m.ts) ?? [];
        return (
          <li key={m.ts} className="ck-tr-msg-wrap">
            <div
              className={`ck-tr-msg${m.is_change ? " ck-tr-msg--change" : ""}${m.ts === thread ? " ck-tr-msg--root" : ""}`}
              onMouseEnter={() => m.is_change && setPopover(m.ts)}
              onMouseLeave={() => setPopover(null)}
            >
              <div className="ck-tr-avatar" aria-hidden>{m.from.slice(0, 1)}</div>
              <div className="ck-tr-msg-body">
                <div className="ck-tr-msg-head">
                  <strong>{m.from}</strong>
                  <time dateTime={m.at}>{fmtTime(m.ts)}</time>
                  {m.is_change && <span className="ck-tr-change">requirement change</span>}
                </div>
                <p>{m.text}</p>
              </div>
              {popover === m.ts && (
                <div className="ck-tr-popover" role="tooltip">
                  <p className="ck-muted">What this change invalidated</p>
                  <EvidenceGraphSvg graph={subgraph(graph, changeDownstream(graph, m.ts))} compact />
                </div>
              )}
            </div>
            {cards.map((f) => (
              <FindingCard key={f.finding_id} finding={f} />
            ))}
          </li>
        );
      })}
    </ol>
  );
}
