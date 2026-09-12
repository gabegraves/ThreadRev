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

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(fmtVal).join(", ");
  return JSON.stringify(v);
}

/** One level of nesting is flattened into dotted keys; deeper values print as JSON. */
function flatten(rec: Rec, prefix = ""): [string, string][] {
  return Object.entries(rec).flatMap(([k, v]): [string, string][] => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isRec(v)) return flatten(v, key);
    // One line per record, so a list of cases does not explode into a row per field.
    if (isArrOfRecs(v)) return v.map((r, i): [string, string] => [`${key}[${i}]`, Object.entries(r).map(([rk, rv]) => `${rk} ${fmtVal(rv)}`).join(" · ")]);
    return [[key, fmtVal(v)]];
  });
}

/** Flat two-column key/value list. Nested records become dotted keys; no nested cards. */
export function KvTable({ data, emptyMessage = "Nothing recorded." }: { data: Rec | undefined; emptyMessage?: string }) {
  const rows = data ? flatten(data) : [];
  if (rows.length === 0) return <p className="text-[12px] text-faint">{emptyMessage}</p>;
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-hairline py-1 last:border-0">
          <dt className="min-w-0 shrink-0 max-w-[55%] truncate font-mono text-[11px] uppercase tracking-[0.06em] text-faint" title={k}>
            {k}
          </dt>
          <dd className="min-w-0 truncate font-mono text-[12px] tabular-nums text-foreground" title={v}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Checks as one row each: pass/fail dot, truncated name, actual / expected. */
export function ChecksTable({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return <p className="text-[12px] text-faint">No checks.</p>;
  return (
    <table className="w-full table-fixed border-collapse">
      <tbody>
        {checks.map((c, i) => (
          <tr key={`${c.name}|${i}`} className="border-b border-hairline last:border-0">
            <td className="w-4 py-1.5 align-middle">
              <span
                aria-label={c.pass ? "pass" : "fail"}
                title={c.pass ? "pass" : "fail"}
                className="inline-block size-1.5 rounded-full"
                style={{ background: c.pass ? "var(--color-success)" : "var(--color-danger)" }}
              />
            </td>
            <td className="truncate py-1.5 pr-2 font-mono text-[12px] text-foreground" title={c.name}>
              {c.name}
            </td>
            <td
              className="w-[40%] truncate py-1.5 text-right font-mono text-[11px] tabular-nums text-subtle"
              title={`actual ${fmtVal(c.actual)} · expected ${fmtVal(c.expected)}`}
            >
              {fmtVal(c.actual)} <span className="text-faint">/ {fmtVal(c.expected)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
