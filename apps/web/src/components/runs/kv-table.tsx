"use client";

/**
 * Generic renderers for checker payloads (inputs / outputs / checks). Shapes
 * vary within one checker (rc per_capacitance vs rc1 flat labels, route
 * versioned inputs vs rc2 cases), so nothing here keys on checker name: the
 * value's shape decides the table.
 */
import type { ReactNode } from "react";
import type { EvidenceEvent } from "agent-core/shared";
import { StatusPill } from "@/civic-ui/components/StatusPill";

export type Rec = Record<string, unknown>;
export type Check = Extract<EvidenceEvent, { kind: "check_run" }>["checks"][number];

export const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
export const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
export const asNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
export const asRec = (v: unknown): Rec | undefined => (isRec(v) ? v : undefined);
export const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const asChecks = (v: unknown): Check[] =>
  asArr(v).filter((c): c is Check => isRec(c) && typeof c.name === "string" && typeof c.pass === "boolean");

const isRecOfRecs = (v: unknown): v is Record<string, Rec> => isRec(v) && Object.keys(v).length > 0 && Object.values(v).every(isRec);
const isArrOfRecs = (v: unknown): v is Rec[] => Array.isArray(v) && v.length > 0 && v.every(isRec);

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(fmtVal).join(", ");
  return JSON.stringify(v);
}

const TH = "h-8 whitespace-nowrap px-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-faint";
const TD = "px-2.5 py-1.5 align-top text-[12.5px] text-foreground";
const TD_NUM = `${TD} font-mono text-[12px] tabular-nums`;

function Table({ head, rows, caption }: { head: ReactNode[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-hairline">
      {caption && (
        <p className="border-b border-hairline bg-overlay px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{caption}</p>
      )}
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {head.map((h, i) => (
              <th key={i} scope="col" className={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-hairline last:border-0">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? `${TD} font-medium` : TD_NUM}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rows = keys, columns = union of inner keys. */
function RecOfRecsTable({ rec, caption, rowHeader }: { rec: Record<string, Rec>; caption?: string; rowHeader: string }) {
  const cols = [...new Set(Object.values(rec).flatMap((r) => Object.keys(r)))];
  return (
    <Table
      caption={caption}
      head={[rowHeader, ...cols]}
      rows={Object.entries(rec).map(([k, r]) => [k, ...cols.map((c) => fmtVal(r[c]))])}
    />
  );
}

function ArrOfRecsTable({ arr, caption }: { arr: Rec[]; caption?: string }) {
  const cols = [...new Set(arr.flatMap((r) => Object.keys(r)))];
  const labelFirst = cols.includes("label") ? ["label", ...cols.filter((c) => c !== "label")] : cols;
  return <Table caption={caption} head={labelFirst} rows={arr.map((r) => labelFirst.map((c) => fmtVal(r[c])))} />;
}

/**
 * Renders any record. Keys whose values are flat records are grouped into one
 * table; a record-of-records or an array of records gets its own captioned
 * table; everything else lands in a key/value table.
 */
export function KvTable({ data, emptyMessage = "Nothing recorded." }: { data: Rec | undefined; emptyMessage?: string }) {
  if (!data || Object.keys(data).length === 0) return <p className="text-[12.5px] text-faint">{emptyMessage}</p>;
  const scalars: [string, unknown][] = [];
  const flatRecs: Record<string, Rec> = {};
  const blocks: ReactNode[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (isRecOfRecs(v)) blocks.push(<RecOfRecsTable key={k} rec={v} caption={k} rowHeader="label" />);
    else if (isArrOfRecs(v)) blocks.push(<ArrOfRecsTable key={k} arr={v} caption={k} />);
    else if (isRec(v)) flatRecs[k] = v;
    else scalars.push([k, v]);
  }
  return (
    <div className="flex flex-col gap-3">
      {scalars.length > 0 && <Table head={["key", "value"]} rows={scalars.map(([k, v]) => [k, fmtVal(v)])} />}
      {Object.keys(flatRecs).length > 0 && <RecOfRecsTable rec={flatRecs} rowHeader="label" />}
      {blocks}
    </div>
  );
}

export function ChecksTable({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return <p className="text-[12.5px] text-faint">No checks.</p>;
  return (
    <Table
      head={["check", "result", "expected", "actual"]}
      rows={checks.map((c) => [
        <span key="n" className="font-mono text-[12px] font-normal">{c.name}</span>,
        <StatusPill key="p" tone={c.pass ? "success" : "danger"}>{c.pass ? "pass" : "fail"}</StatusPill>,
        fmtVal(c.expected),
        fmtVal(c.actual),
      ])}
    />
  );
}

export function checkSummary(checks: Check[]): { passed: number; total: number } {
  return { passed: checks.filter((c) => c.pass).length, total: checks.length };
}

/** Tiny pass/total bar: neutral track, success fill, warning fill when any fail. */
export function CheckBar({ passed, total }: { passed: number; total: number }) {
  const pct = total === 0 ? 0 : (passed / total) * 100;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-[12px] tabular-nums">{passed}/{total}</span>
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-overlay-strong" aria-hidden>
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: passed === total ? "var(--color-success)" : "var(--color-warning)" }}
        />
      </span>
    </span>
  );
}

export type EvidenceRefLike = { kind: "document" | "message"; id: string };

/** Narrow + dedupe evidence_refs (scenario A lists the same sha twice). */
export function asRefs(v: unknown): EvidenceRefLike[] {
  const seen = new Set<string>();
  return asArr(v).flatMap((r) => {
    if (!isRec(r) || (r.kind !== "document" && r.kind !== "message") || typeof r.id !== "string") return [];
    const key = `${r.kind}|${r.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind: r.kind, id: r.id }];
  });
}

/** Evidence refs as chips: document → sha12, message → ts. */
export function RefChips({ refs, onPick }: { refs: EvidenceRefLike[]; onPick?: (id: string) => void }) {
  if (refs.length === 0) return <p className="text-[12.5px] text-faint">No evidence refs.</p>;
  const cls = "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-hairline bg-overlay px-2 py-0.5 font-mono text-[11px] text-foreground";
  return (
    <div className="flex flex-wrap gap-1.5">
      {refs.map((r) => {
        const key = `${r.kind}|${r.id}`;
        const body = (
          <>
            <span className="uppercase tracking-[0.08em] text-faint">{r.kind === "document" ? "doc" : "msg"}</span>
            {r.kind === "document" ? r.id.slice(0, 12) : r.id}
          </>
        );
        return onPick ? (
          <button key={key} type="button" onClick={() => onPick(r.id)} className={`${cls} hover:border-hairline-strong`}>{body}</button>
        ) : (
          <span key={key} className={cls}>{body}</span>
        );
      })}
    </div>
  );
}
