"use client";

/**
 * Generic renderers for checker payloads (inputs / outputs / checks). Shapes
 * vary within one checker (rc per_capacitance vs rc1 flat labels, route
 * versioned inputs vs rc2 cases), so nothing here keys on checker name: the
 * value's shape decides the table.
 */
import Link from "next/link";
import type { EvidenceEvent } from "agent-core/shared";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import { Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
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

const isArrOfRecs = (v: unknown): v is Rec[] => Array.isArray(v) && v.length > 0 && v.every(isRec);
const isScalar = (v: unknown): boolean => v === null || v === undefined || typeof v !== "object";

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(fmtVal).join(", ");
  return JSON.stringify(v);
}

/** Round to N significant figures, dropping trailing noise from float math. */
function sigFigs(n: number, digits = 4): string {
  if (n === 0) return "0";
  if (!Number.isFinite(n)) return String(n);
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const factor = 10 ** (digits - 1 - magnitude);
  return String(Math.round(n * factor) / factor);
}

function fmtDelta(actual: number, expected: number): string {
  const d = actual - expected;
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  return `${sign}${sigFigs(Math.abs(d))}`;
}

/** Union of keys across a set of records, first-seen order, `label` pinned first. */
function unionKeys(recs: Rec[]): string[] {
  const keys: string[] = [];
  for (const r of recs) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  const withoutLabel = keys.filter((k) => k !== "label");
  return keys.includes("label") ? ["label", ...withoutLabel] : withoutLabel;
}

function cellFor(v: unknown): string {
  if (Array.isArray(v)) return v.map(fmtVal).join(", ");
  if (isRec(v)) return JSON.stringify(v);
  return fmtVal(v);
}

const TABLE_CLS = "w-full text-[12px] border-collapse";
const TH_CLS = "px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-faint";
const TD_CLS = "px-2 py-1.5 border-t border-hairline align-top";
const TD_NUM_CLS = `${TD_CLS} text-right tabular-nums`;
const TD_KEY_CLS = `${TD_CLS} font-mono text-foreground`;

/** One row per array element, columns = union of object keys (label pinned first). */
function ArrayTable({ title, rows }: { title: string; rows: Rec[] }) {
  const columns = unionKeys(rows);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[11px] text-faint" title={title}>
        {title}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-hairline">
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className={TH_CLS}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c} className={c === "label" ? TD_KEY_CLS : TD_NUM_CLS} title={cellFor(r[c])}>
                    {cellFor(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** One row per outer key, columns = union of inner keys — for records of uniform objects (e.g. per_capacitance). */
function ObjectTable({ title, data }: { title: string; data: Record<string, Rec> }) {
  const outerKeys = Object.keys(data);
  const columns = unionKeys(Object.values(data));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[11px] text-faint" title={title}>
        {title}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-hairline">
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              <th className={TH_CLS}>label</th>
              {columns.map((c) => (
                <th key={c} className={TH_CLS}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outerKeys.map((k) => (
              <tr key={k}>
                <td className={TD_KEY_CLS} title={k}>
                  {k}
                </td>
                {columns.map((c) => (
                  <td key={c} className={TD_NUM_CLS} title={cellFor(data[k][c])}>
                    {cellFor(data[k][c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sameKeySet(a: Rec, b: Rec): boolean {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  return ak.length === bk.length && ak.every((k, i) => k === bk[i]);
}

/** records whose values are objects sharing one key set, distinct from a merely uniform-shaped array */
function isUniformObjectOfRecords(v: unknown): v is Record<string, Rec> {
  if (!isRec(v)) return false;
  const values = Object.values(v);
  if (values.length === 0 || !values.every(isRec)) return false;
  return values.every((r) => sameKeySet(r, values[0]));
}

/** Buckets one record's entries by shape so each renders with the right widget. */
function classify(data: Rec) {
  const scalars: [string, unknown][] = [];
  const arrayTables: [string, Rec[]][] = [];
  const objectTables: [string, Record<string, Rec>][] = [];
  const other: [string, unknown][] = [];
  for (const [k, v] of Object.entries(data)) {
    if (isScalar(v) || (Array.isArray(v) && v.length === 0)) scalars.push([k, v]);
    else if (isArrOfRecs(v)) arrayTables.push([k, v]);
    else if (isUniformObjectOfRecords(v)) objectTables.push([k, v as Record<string, Rec>]);
    else other.push([k, v]);
  }
  return { scalars, arrayTables, objectTables, other };
}

/** Generic record renderer: scalars → FieldGrid, arrays-of-objects and uniform object-tables → small tables, anything else → collapsible raw JSON. */
export function RecordFields({ data, emptyMessage = "Nothing recorded." }: { data: Rec | undefined; emptyMessage?: string }) {
  if (!data || Object.keys(data).length === 0) return <p className="text-[12px] text-faint">{emptyMessage}</p>;
  const { scalars, arrayTables, objectTables, other } = classify(data);
  return (
    <div className="flex flex-col gap-4">
      {scalars.length > 0 && (
        <FieldGrid>
          {scalars.map(([k, v]) => (
            <Field key={k} label={k} value={<span className="tabular-nums">{fmtVal(v)}</span>} />
          ))}
        </FieldGrid>
      )}
      {arrayTables.map(([k, rows]) => (
        <ArrayTable key={k} title={k} rows={rows} />
      ))}
      {objectTables.map(([k, obj]) => (
        <ObjectTable key={k} title={k} data={obj} />
      ))}
      {other.length > 0 && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.08em] text-faint">raw</summary>
          <pre className="mt-1.5 overflow-x-auto rounded-[var(--radius-md)] border border-hairline bg-overlay p-2 font-mono text-[11px] text-subtle">
            {JSON.stringify(Object.fromEntries(other), null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Checks as the hero table: name / expected / actual / Δ / result. Failing checks first. */
export function ChecksTable({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return <p className="text-[12px] text-faint">No checks.</p>;
  const { passed, total } = checkSummary(checks);
  const ordered = [...checks].sort((a, b) => Number(a.pass) - Number(b.pass));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CheckBar passed={passed} total={total} />
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-hairline">
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              <th className={TH_CLS}>name</th>
              <th className={`${TH_CLS} text-right`}>expected</th>
              <th className={`${TH_CLS} text-right`}>actual</th>
              <th className={`${TH_CLS} text-right`}>Δ</th>
              <th className={TH_CLS}>result</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((c, i) => {
              const expected = asNum(c.expected);
              const actual = asNum(c.actual);
              const hasDelta = expected !== undefined && actual !== undefined;
              return (
                <tr key={`${c.name}|${i}`}>
                  <td className={`${TD_CLS} whitespace-normal break-words font-mono text-foreground`}>{c.name}</td>
                  <td className={`${TD_CLS} text-right font-mono text-[13px] tabular-nums text-subtle`}>{fmtVal(c.expected)}</td>
                  <td className={`${TD_CLS} text-right font-mono text-[13px] tabular-nums text-subtle`}>{fmtVal(c.actual)}</td>
                  <td
                    className={`${TD_CLS} text-right font-mono text-[13px] tabular-nums ${!c.pass && hasDelta ? "text-[var(--status-danger-fg)]" : "text-faint"}`}
                  >
                    {hasDelta ? fmtDelta(actual, expected) : "—"}
                  </td>
                  <td className={TD_CLS}>
                    <StatusPill tone={c.pass ? "success" : "danger"}>{c.pass ? "pass" : "fail"}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
      <span className="font-mono text-[12px] tabular-nums font-medium">{passed}/{total} pass</span>
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

/** Evidence refs as chips: document → sha12, message → ts. Without onPick each chip deep-links to its page. */
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
          <Link key={key} href={r.kind === "document" ? hrefs.document(r.id) : hrefs.thread(r.id)} className={`${cls} ${LINK_CLASS} hover:border-hairline-strong`}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
