"use client";

import type { EvidenceEvent, EvidenceGraph, Finding } from "agent-core/shared";
import { findingById, threadMessages } from "./graph-utils";

type Row = { label: string; before: string; after: string };

const reproText = (f: Finding) =>
  f.reproduced.map((r) => `${r.label}: ${r.printed !== undefined ? `printed ${r.printed} → ` : ""}${r.computed} ${r.unit}`).join("\n");

function rows(before: Finding, after: Finding): Row[] {
  return [
    { label: "requirements_revision", before: before.requirements_revision, after: after.requirements_revision },
    { label: "discrepancy", before: before.discrepancy, after: after.discrepancy },
    { label: "reproduced", before: reproText(before), after: reproText(after) },
    { label: "resolution", before: before.resolution, after: after.resolution },
  ];
}

function PairDiff({ before, after }: { before: Finding; after: Finding }) {
  return (
    <section className="ck-tr-diff">
      <h3>
        <code>{before.finding_id}</code> → <code>{after.finding_id}</code>
      </h3>
      <div className="ck-scroll">
        <table className="ck-tr-diff-table">
          <thead>
            <tr><th>field</th><th>stale</th><th>live</th></tr>
          </thead>
          <tbody>
            {rows(before, after).map((r) => (
              <tr key={r.label} className={r.before !== r.after ? "is-changed" : ""}>
                <th>{r.label}</th>
                <td className="ck-preserve-lines">{r.before || <span className="ck-muted">—</span>}</td>
                <td className="ck-preserve-lines">{r.after || <span className="ck-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const VALUE_RE = /(\d+(?:\.\d+)?)\s*(uF|mF|nF|ohm|s|ms|V|A|W|J)\b/g;

function values(text: string): { value: string; unit: string }[] {
  return [...text.matchAll(VALUE_RE)].map((m) => ({ value: m[1], unit: m[2] }));
}

/** Document-stated values vs what change messages say, grouped by unit. */
function docVsThread(graph: EvidenceGraph, events: EvidenceEvent[]): { unit: string; doc: string[]; thread: string[] }[] {
  const doc = new Map<string, Set<string>>();
  const thread = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, unit: string, v: string) => m.set(unit, new Set([...(m.get(unit) ?? []), v]));
  for (const f of graph.findings) for (const s of f.sources) if (s.kind === "document" && s.quote) for (const v of values(s.quote)) add(doc, v.unit, v.value);
  for (const ev of events) {
    if (ev.kind !== "check_run") continue;
    const caps = ev.inputs.capacitances;
    if (!Array.isArray(caps)) continue;
    for (const c of caps as { label?: string; C_F?: number }[]) {
      if (typeof c.C_F !== "number" || !c.label) continue;
      const uF = String(Math.round(c.C_F * 1e6));
      if (/_(text|diagram)$/.test(c.label)) add(doc, "uF", uF);
      if (/_change$/.test(c.label)) add(thread, "uF", uF);
    }
  }
  for (const m of threadMessages(events)) if (m.is_change) for (const v of values(m.text)) add(thread, v.unit, v.value);
  const units = new Set([...doc.keys(), ...thread.keys()]);
  return [...units].map((unit) => ({ unit, doc: [...(doc.get(unit) ?? [])], thread: [...(thread.get(unit) ?? [])] }));
}

export function DiffsTab({ graph, events }: { graph: EvidenceGraph; events: EvidenceEvent[] }) {
  const pairs = graph.findings
    .filter((f) => f.supersedes)
    .map((f) => ({ after: f, before: findingById(graph, f.supersedes!) }))
    .filter((p): p is { after: Finding; before: Finding } => Boolean(p.before));
  const dvt = docVsThread(graph, events);
  return (
    <div className="ck-tr-list">
      {pairs.length === 0 ? <p className="ck-empty">No superseded findings.</p> : pairs.map((p) => <PairDiff key={p.after.finding_id} {...p} />)}
      <section className="ck-tr-diff">
        <h3>Document vs thread</h3>
        {dvt.length === 0 ? <p className="ck-empty">No comparable values.</p> : (
          <div className="ck-scroll">
            <table className="ck-tr-diff-table">
              <thead><tr><th>unit</th><th>document states</th><th>thread changes say</th></tr></thead>
              <tbody>
                {dvt.map((r) => {
                  const same = r.doc.join() === r.thread.join();
                  return (
                    <tr key={r.unit} className={same ? "" : "is-changed"}>
                      <th>{r.unit}</th>
                      <td>{r.doc.length ? r.doc.join(", ") : <span className="ck-muted">—</span>}</td>
                      <td>{r.thread.length ? r.thread.join(", ") : <span className="ck-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
