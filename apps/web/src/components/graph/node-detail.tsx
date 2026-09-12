"use client";

/**
 * Right-hand panel for the selected graph node. One question only: what did
 * this change invalidate. Header (label / kind / time), the nodes it touches,
 * the fields the log actually recorded, a local note, and — for run and
 * finding nodes — the reviewer run's event trace.
 */
import type { EvidenceEvent, EvidenceGraph, Finding, GraphNode } from "agent-core/shared";
import { Copy } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { TraceTimeline } from "@/components/graph/trace-timeline";
import { fmtTime, runTraces } from "@/components/review-console/graph-utils";
import { asChecks, asNum, asRec, asStr, isRec } from "@/components/runs/kv-table";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/demo/status";

const isFinding = (v: unknown): v is Finding => isRec(v) && typeof v.finding_id === "string" && typeof v.discrepancy === "string";

const LABEL = "text-[11px] uppercase tracking-wide text-faint";
const SECTION = "flex flex-col gap-2 border-t border-hairline px-4 py-3";

function shortId(id: string): string {
  return id.length > 24 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id;
}

/** Truncated id + copy. Shown once per node, in the header. */
function IdChip({ id }: { id: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate font-mono text-[11px] text-faint" title={id}>
        {shortId(id)}
      </span>
      <button
        type="button"
        aria-label="Copy id"
        onClick={() => void navigator.clipboard?.writeText(id).catch(() => {})}
        className="shrink-0 text-faint hover:text-foreground"
      >
        <Copy className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

function NodeLink({ id, onPick }: { id: string; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(id)}
      className="max-w-full truncate text-left font-mono text-[11px] text-foreground underline decoration-hairline-strong underline-offset-2 hover:decoration-[var(--foreground)]"
    >
      {shortId(id)}
    </button>
  );
}

type Row = { k: string; v: ReactNode };

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-1.5">
      {rows.map((r) => (
        <Fragment key={r.k}>
          <dt className={LABEL}>{r.k}</dt>
          <dd className="min-w-0 break-words text-[12px] leading-snug text-foreground">{r.v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Only the fields the log recorded. The node's own id lives in the header,
 *  so no kind repeats it here. */
function fieldsFor(node: GraphNode, graph: EvidenceGraph, onPick: (id: string) => void): Row[] {
  const d = node.data;
  const rows: Row[] = [];
  const add = (k: string, v: ReactNode | undefined | null) => {
    if (v !== undefined && v !== null && v !== "") rows.push({ k, v });
  };
  const link = (id: string | undefined) => (id ? <NodeLink id={id} onPick={onPick} /> : undefined);

  switch (node.kind) {
    case "message": {
      add("from", asStr(d.from));
      add("text", asStr(d.text));
      if (d.is_change) add("change", "created a new revision");
      if (d.is_bot) add("bot", "yes");
      const silences = asNum(d.silence_count) ?? 0;
      if (silences > 0) add("silences", String(silences));
      break;
    }
    case "document":
      add("document", asStr(d.document));
      add("revision", asStr(d.revision));
      add("lines", asNum(d.line_count) !== undefined ? String(d.line_count) : undefined);
      add("named in", asStr(d.named_in_ts) ? fmtTime(asStr(d.named_in_ts) as string) : undefined);
      break;
    case "run": {
      const checks = asChecks(d.checks);
      const refused = asRec(d.refused);
      add("checker", asStr(d.checker));
      add("version", asStr(d.version));
      add("trigger", asStr(d.trigger_ts) ? fmtTime(asStr(d.trigger_ts) as string) : undefined);
      if (checks.length > 0) add("checks", `${checks.filter((c) => c.pass).length} / ${checks.length} pass`);
      if (checks.some((c) => !c.pass))
        add(
          "failed",
          checks
            .filter((c) => !c.pass)
            .map((c) => c.name)
            .join(", "),
        );
      add("error", asStr(d.error));
      if (refused) {
        add("bound to", asStr(refused.bound_revision));
        add("current", asStr(refused.current_revision));
        add("refused", asStr(refused.reason));
      }
      break;
    }
    case "finding": {
      const f = isFinding(d.finding) ? d.finding : null;
      add("status", STATUS_LABEL[node.status]);
      if (!f) {
        add("note", "Referenced by a supersedes edge; never published in this log.");
      } else {
        add("bound to", f.requirements_revision);
        add("from run", link(f.checker_run.run_id));
        add("supersedes", link(f.supersedes ?? undefined));
        add("discrepancy", f.discrepancy);
        add("matters", f.why_it_matters);
        if (f.question) add("asks", `${f.question.to} — ${f.question.ask}`);
        add("resolution", f.resolution);
      }
      add("superseded by", link(asStr(d.superseded_by)));
      break;
    }
    case "revision": {
      add("at", asStr(d.ts) ? fmtTime(asStr(d.ts) as string) : undefined);
      add("created by", link(graph.edges.find((e) => e.kind === "changes" && e.to === node.id)?.from));
      const count = (kind: string) => graph.edges.filter((e) => e.kind === kind && e.to === node.id).length;
      if (count("bound_to") > 0) add("cards bound", String(count("bound_to")));
      if (count("refused_by") > 0) add("runs refused", String(count("refused_by")));
      break;
    }
  }
  return rows;
}

function Connected({ graph, id, onPick }: { graph: EvidenceGraph; id: string; onPick: (id: string) => void }) {
  const rows = graph.edges
    .filter((e) => e.from === id || e.to === id)
    .map((e) => {
      const other = e.from === id ? e.to : e.from;
      return { key: `${e.kind}|${e.from}|${e.to}`, kind: e.kind, other, label: graph.nodes.find((n) => n.id === other)?.label ?? other };
    });
  if (rows.length === 0) return <p className="text-[12px] text-faint">No edges.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline gap-2">
          <span className={`w-[11ch] shrink-0 ${LABEL}`}>{r.kind}</span>
          <button type="button" onClick={() => onPick(r.other)} className="min-w-0 truncate text-left text-[12px] text-foreground hover:underline">
            {r.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Free-text note, this browser only. Keyed on node.id by the caller so
 *  switching nodes resets the draft. Saving an empty note deletes it. */
function Note({ id, note, onSave }: { id: string; note: string | undefined; onSave: (id: string, note: string) => void }) {
  const [draft, setDraft] = useState(note ?? "");
  useEffect(() => setDraft(note ?? ""), [note]);
  return (
    <>
      <textarea
        aria-label="Node note"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Note — this browser only"
        className="w-full resize-y rounded-[var(--radius-md)] border border-hairline bg-overlay px-2.5 py-1.5 text-[12px] leading-snug text-foreground placeholder:text-faint focus:border-hairline-strong focus:outline-none"
      />
      <button
        type="button"
        disabled={draft === (note ?? "")}
        onClick={() => onSave(id, draft)}
        className="self-start rounded-md border border-hairline bg-overlay px-2.5 py-1 text-[12px] font-medium text-subtle hover:border-hairline-strong hover:text-foreground disabled:cursor-default disabled:opacity-50"
      >
        Save
      </button>
    </>
  );
}

function Trace({ node, events, onPick }: { node: GraphNode; events: EvidenceEvent[]; onPick: (id: string) => void }) {
  const trace = useMemo(() => {
    const trig =
      node.kind === "run"
        ? asStr(node.data.trigger_ts)
        : events.find((ev) => ev.kind === "finding_published" && ev.finding.finding_id === node.id)?.trigger_ts;
    return trig ? runTraces(events).find((t) => t.trigger_ts === trig) : undefined;
  }, [node, events]);
  if (!trace) return null;
  return (
    <section className={SECTION}>
      <h4 className={LABEL}>Trace</h4>
      <TraceTimeline trace={trace} onPick={onPick} />
    </section>
  );
}

export function NodeDetail({
  graph,
  events,
  node,
  onPick,
  note,
  onSaveNote,
}: {
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  node: GraphNode | null;
  onPick: (id: string) => void;
  /** Local note for this node, if any. */
  note?: string;
  onSaveNote: (id: string, note: string) => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-[12px] text-faint">Click a node</p>
      </div>
    );
  }
  const fields = fieldsFor(node, graph, onPick);
  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-1.5 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-foreground">{node.label}</h3>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={LABEL}>{node.kind}</span>
            {node.status !== "neutral" && <StatusPill tone={STATUS_TONE[node.status]}>{STATUS_LABEL[node.status]}</StatusPill>}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <IdChip id={node.id} />
          {node.at && (
            <time dateTime={node.at} className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
              {new Date(node.at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </time>
          )}
        </div>
      </header>

      <section className={SECTION}>
        <h4 className={LABEL}>Connected</h4>
        <Connected graph={graph} id={node.id} onPick={onPick} />
      </section>

      {fields.length > 0 && (
        <section className={SECTION}>
          <h4 className={LABEL}>Fields</h4>
          <Rows rows={fields} />
        </section>
      )}

      <section className={SECTION}>
        <h4 className={LABEL}>Note</h4>
        <Note key={node.id} id={node.id} note={note} onSave={onSaveNote} />
      </section>

      {(node.kind === "run" || node.kind === "finding") && <Trace node={node} events={events} onPick={onPick} />}
    </div>
  );
}
