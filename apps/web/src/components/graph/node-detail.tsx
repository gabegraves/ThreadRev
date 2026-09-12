"use client";

import type { EvidenceEvent, EvidenceGraph, Finding, GraphNode } from "agent-core/shared";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/civic-ui/components/Badge";
import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { TraceTimeline } from "@/components/graph/trace-timeline";
import { fmtTime, runTraces } from "@/components/review-console/graph-utils";
import { asArr, asChecks, asNum, asRec, asRefs, asStr, ChecksTable, isRec, KvTable, RefChips } from "@/components/runs/kv-table";
import { RefusalBlock } from "@/components/runs/run-detail";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";

const isFinding = (v: unknown): v is Finding => isRec(v) && typeof v.finding_id === "string" && typeof v.discrepancy === "string";

function Neighbours({ graph, id, onPick }: { graph: EvidenceGraph; id: string; onPick: (id: string) => void }) {
  const rows = graph.edges
    .filter((e) => e.from === id || e.to === id)
    .map((e) => {
      const other = e.from === id ? e.to : e.from;
      const node = graph.nodes.find((n) => n.id === other);
      return { key: `${e.kind}|${e.from}|${e.to}`, dir: e.from === id ? "→" : "←", kind: e.kind, other, label: node?.label ?? other, nodeKind: node?.kind };
    });
  if (rows.length === 0) return <p className="text-[12.5px] text-faint">No edges.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-[12.5px]">
          <span className="w-4 text-center font-mono text-faint">{r.dir}</span>
          <span className="w-[11ch] shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{r.kind}</span>
          <button type="button" onClick={() => onPick(r.other)} className="min-w-0 truncate text-left text-foreground underline decoration-hairline-strong underline-offset-2 hover:decoration-[var(--foreground)]">
            {r.nodeKind && <span className="mr-1 text-faint">{r.nodeKind}</span>}
            {r.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageFields({ d }: { d: Record<string, unknown> }) {
  const ts = asStr(d.ts) ?? "";
  const from = asStr(d.from);
  const silences = asArr(d.silences).filter(isRec);
  return (
    <>
      <FieldGrid>
        <Field label="from" value={from ?? "not read"} hint={from ? undefined : "referenced by a run; no message_read"} />
        <Field label="ts" value={ts} mono hint={fmtTime(ts)} />
        <Field label="change" value={d.is_change === undefined ? "—" : d.is_change ? <Badge variant="warning">change</Badge> : "no"} />
        <Field label="bot" value={d.is_bot === undefined ? "—" : d.is_bot ? "yes" : "no"} />
        <Field label="silences" value={String(asNum(d.silence_count) ?? 0)} />
      </FieldGrid>
      {asStr(d.text) && (
        <DetailSection title="Text">
          <p className="text-[13px] leading-relaxed text-subtle">{asStr(d.text)}</p>
        </DetailSection>
      )}
      {silences.length > 0 && (
        <DetailSection title="Silences">
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {silences.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <StatusPill tone="neutral">{String(s.reason ?? "").replace("_", " ")}</StatusPill>
                <span className="font-mono text-[11px] text-faint">{asStr(s.at) ? new Date(asStr(s.at) as string).toLocaleTimeString("en-US", { timeZone: "America/New_York" }) : ""}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </>
  );
}

function DocumentFields({ d }: { d: Record<string, unknown> }) {
  const name = asStr(d.document);
  return (
    <FieldGrid>
      <Field label="document" value={name ?? "not read"} hint={name ? undefined : "referenced by a run; no document_read"} />
      <Field label="revision" value={asStr(d.revision) ?? "—"} mono />
      <Field label="lines" value={asNum(d.line_count) !== undefined ? String(d.line_count) : "—"} />
      <Field label="named in" value={asStr(d.named_in_ts) ?? "—"} mono hint={asStr(d.named_in_ts) ? fmtTime(asStr(d.named_in_ts) as string) : undefined} />
      <div className="col-span-2 sm:col-span-3">
        <Field label="sha256" value={asStr(d.sha256) ?? "—"} mono />
      </div>
    </FieldGrid>
  );
}

function RunFields({ d, onPick }: { d: Record<string, unknown>; onPick: (id: string) => void }) {
  const checks = asChecks(d.checks);
  const refused = asRec(d.refused);
  const trig = asStr(d.trigger_ts);
  return (
    <>
      <FieldGrid>
        <Field label="checker" value={asStr(d.checker) ?? "—"} />
        <Field label="version" value={asStr(d.version) ?? "—"} mono />
        <Field label="run id" value={asStr(d.run_id) ?? "—"} mono />
        <Field label="trigger" value={trig ?? "—"} mono hint={trig ? fmtTime(trig) : undefined} />
        <Field label="checks" value={`${checks.filter((c) => c.pass).length} / ${checks.length}`} />
        <Field label="error" value={asStr(d.error) ?? "none"} />
      </FieldGrid>
      {refused && (
        <DetailSection title="Refused">
          <RefusalBlock bound={asStr(refused.bound_revision) ?? ""} current={asStr(refused.current_revision) ?? ""} reason={asStr(refused.reason) ?? ""} />
        </DetailSection>
      )}
      {checks.length > 0 && (
        <DetailSection title="Checks">
          <ChecksTable checks={checks} />
        </DetailSection>
      )}
      {asRec(d.outputs) && (
        <DetailSection title="Outputs">
          <KvTable data={asRec(d.outputs)} />
        </DetailSection>
      )}
      {asRec(d.inputs) && (
        <DetailSection title="Inputs">
          <KvTable data={asRec(d.inputs)} />
        </DetailSection>
      )}
      {asArr(d.evidence_refs).length > 0 && (
        <DetailSection title="Evidence refs">
          <RefChips refs={asRefs(d.evidence_refs)} onPick={onPick} />
        </DetailSection>
      )}
      {!asStr(d.checker) && <p className="text-[12.5px] text-faint">Only the refusal was logged for this run; no check_run event carries its inputs.</p>}
    </>
  );
}

function FindingFields({ node, d, onPick }: { node: GraphNode; d: Record<string, unknown>; onPick: (id: string) => void }) {
  const f = isFinding(d.finding) ? d.finding : null;
  const supersededBy = asStr(d.superseded_by);
  if (!f) {
    return (
      <>
        <FieldGrid>
          <Field label="finding id" value={node.id} mono />
          <Field label="status" value={STATUS_LABEL[node.status]} />
          {supersededBy && <Field label="superseded by" value={<button type="button" onClick={() => onPick(supersededBy)} className="underline underline-offset-2">{supersededBy}</button>} mono />}
        </FieldGrid>
        <p className="text-[12.5px] text-faint">Referenced by a supersedes edge; never published in this log.</p>
      </>
    );
  }
  return (
    <>
      <FieldGrid>
        <Field label="finding id" value={f.finding_id} mono />
        <Field label="status" value={STATUS_LABEL[node.status]} />
        <Field label="revision" value={f.requirements_revision} mono hint={fmtTime(f.requirements_revision)} />
        <Field label="checker run" value={<button type="button" onClick={() => onPick(f.checker_run.run_id)} className="underline underline-offset-2">{f.checker_run.run_id}</button>} mono hint={`${f.checker_run.checker} v${f.checker_run.version}`} />
        {f.supersedes && <Field label="supersedes" value={<button type="button" onClick={() => onPick(f.supersedes as string)} className="underline underline-offset-2">{f.supersedes}</button>} mono />}
        {supersededBy && <Field label="superseded by" value={<button type="button" onClick={() => onPick(supersededBy)} className="underline underline-offset-2">{supersededBy}</button>} mono />}
        <Field label="reproduced" value={String(f.reproduced.length)} hint={`${f.sources.length} sources · ${f.inferred.length} inferred`} />
      </FieldGrid>
      <DetailSection title="Discrepancy">
        <p className="text-[13px] leading-relaxed text-foreground">{f.discrepancy}</p>
        <p className="text-[12.5px] leading-relaxed text-subtle">{f.why_it_matters}</p>
      </DetailSection>
      {f.question && (
        <DetailSection title="Question">
          <p className="text-[12.5px] leading-relaxed text-subtle"><span className="font-medium text-foreground">{f.question.to}</span> — {f.question.ask}</p>
        </DetailSection>
      )}
      <DetailSection title="Resolution">
        <p className="text-[12.5px] leading-relaxed text-subtle">{f.resolution}</p>
      </DetailSection>
    </>
  );
}

function RevisionFields({ graph, node, onPick }: { graph: EvidenceGraph; node: GraphNode; onPick: (id: string) => void }) {
  const ts = asStr(node.data.ts) ?? "";
  const bound = graph.edges.filter((e) => e.kind === "bound_to" && e.to === node.id).map((e) => e.from);
  const refused = graph.edges.filter((e) => e.kind === "refused_by" && e.to === node.id).map((e) => e.from);
  const cause = graph.edges.find((e) => e.kind === "changes" && e.to === node.id)?.from;
  const list = (ids: string[]) =>
    ids.length === 0 ? "none" : (
      <span className="flex flex-col gap-0.5">
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => onPick(id)} className="text-left underline underline-offset-2">{id}</button>
        ))}
      </span>
    );
  return (
    <FieldGrid>
      <Field label="ts" value={ts} mono hint={fmtTime(ts)} />
      <Field label="created by" value={cause ? <button type="button" onClick={() => onPick(cause)} className="underline underline-offset-2">{cause}</button> : "no change message read"} mono />
      <Field label="cards bound" value={list(bound)} mono />
      <Field label="runs refused" value={list(refused)} mono />
    </FieldGrid>
  );
}

const INPUT =
  "w-full rounded-[var(--radius-md)] border border-hairline bg-overlay px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint focus:border-hairline-strong focus:outline-none";
const BUTTON =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-overlay px-2.5 text-[12px] font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-foreground disabled:cursor-default disabled:opacity-50";

/** Local, display-only edits: label override + free-text note. The drafts are
 *  keyed on node.id by the caller (`key={node.id}`) so switching nodes resets them. */
function NodeEditor({
  node,
  label,
  note,
  onSaveLabel,
  onSaveNote,
}: {
  node: GraphNode;
  label: string | undefined;
  note: string | undefined;
  onSaveLabel: (id: string, label: string) => void;
  onSaveNote: (id: string, note: string) => void;
}) {
  const [labelDraft, setLabelDraft] = useState(label ?? node.label);
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  useEffect(() => setLabelDraft(label ?? node.label), [label, node.label]);
  useEffect(() => setNoteDraft(note ?? ""), [note]);
  const labelDirty = labelDraft !== (label ?? node.label);
  const noteDirty = noteDraft !== (note ?? "");
  return (
    <>
      <DetailSection title="Label">
        <div className="flex items-center gap-2">
          <input aria-label="Node label" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} className={INPUT} />
          <button type="button" disabled={!labelDirty} onClick={() => onSaveLabel(node.id, labelDraft)} className={BUTTON}>
            Save
          </button>
        </div>
        {label !== undefined && (
          <p className="text-[11px] text-faint">
            Logged as <span className="text-subtle">{node.label}</span> ·{" "}
            <button type="button" onClick={() => onSaveLabel(node.id, "")} className="underline underline-offset-2 hover:text-foreground">
              reset
            </button>
          </p>
        )}
      </DetailSection>
      <DetailSection title="Notes">
        <textarea
          aria-label="Node note"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          placeholder="Add a note for this node — stored in this browser only."
          className={`${INPUT} resize-y leading-relaxed`}
        />
        <div className="flex items-center gap-2">
          <button type="button" disabled={!noteDirty} onClick={() => onSaveNote(node.id, noteDraft)} className={BUTTON}>
            Save note
          </button>
          {note && (
            <button type="button" onClick={() => onSaveNote(node.id, "")} className={BUTTON}>
              Delete note
            </button>
          )}
        </div>
      </DetailSection>
    </>
  );
}

/** The reviewer run a run / finding node belongs to, as the same event
 *  timeline the page used to show for the whole log. */
function NodeRun({ node, events, onPick }: { node: GraphNode; events: EvidenceEvent[]; onPick: (id: string) => void }) {
  const trace = useMemo(() => {
    const trig =
      node.kind === "run"
        ? asStr(node.data.trigger_ts)
        : events.find((ev) => ev.kind === "finding_published" && ev.finding.finding_id === node.id)?.trigger_ts;
    return trig ? runTraces(events).find((t) => t.trigger_ts === trig) : undefined;
  }, [node, events]);
  if (!trace) return null;
  return (
    <DetailSection title="Reviewer run">
      <p className="text-[12px] text-faint">
        {trace.label} · {trace.events.length} events
      </p>
      <TraceTimeline trace={trace} onPick={onPick} />
    </DetailSection>
  );
}

export function NodeDetail({
  graph,
  events,
  node,
  onPick,
  className,
  label,
  note,
  onSaveLabel,
  onSaveNote,
}: {
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  node: GraphNode | null;
  onPick: (id: string) => void;
  className?: string;
  /** Local label override for this node, if any. */
  label?: string;
  /** Local note for this node, if any. */
  note?: string;
  onSaveLabel: (id: string, label: string) => void;
  onSaveNote: (id: string, note: string) => void;
}) {
  if (!node) return <DetailPanel emptyMessage="Click a node to see what the log recorded for it." className={className} />;
  const d = node.data;
  return (
    <DetailPanel
      className={className}
      title={label ?? node.label}
      subtitle={<span className="font-mono">{node.id}</span>}
      actions={
        <>
          <Badge>{node.kind}</Badge>
          {node.status !== "neutral" && <StatusPill tone={STATUS_TONE[node.status]}>{STATUS_LABEL[node.status]}</StatusPill>}
        </>
      }
    >
      <FieldGrid>
        <Field label="kind" value={node.kind} />
        <Field label="status" value={STATUS_LABEL[node.status]} />
        <Field label="at" value={node.at ? new Date(node.at).toLocaleString("en-US", { timeZone: "America/New_York" }) : "—"} hint={node.at} />
      </FieldGrid>
      {node.kind === "message" && <MessageFields d={d} />}
      {node.kind === "document" && <DocumentFields d={d} />}
      {node.kind === "run" && <RunFields d={d} onPick={onPick} />}
      {node.kind === "finding" && <FindingFields node={node} d={d} onPick={onPick} />}
      {node.kind === "revision" && <RevisionFields graph={graph} node={node} onPick={onPick} />}
      <DetailSection title="Connected nodes">
        <Neighbours graph={graph} id={node.id} onPick={onPick} />
      </DetailSection>
      <NodeEditor key={node.id} node={node} label={label} note={note} onSaveLabel={onSaveLabel} onSaveNote={onSaveNote} />
      {(node.kind === "run" || node.kind === "finding") && <NodeRun node={node} events={events} onPick={onPick} />}
      <DetailSection title="All fields">
        <KvTable data={d} />
      </DetailSection>
    </DetailPanel>
  );
}
