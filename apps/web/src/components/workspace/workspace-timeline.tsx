"use client";

import { useEffect, useRef, useState } from "react";
import { fmtTime, tsToDate } from "@/components/review-console/graph-utils";
import type { IndexedMessage } from "@/lib/workspace-index";
import { tsNum } from "@/lib/workspace-index";
import type { WorkspaceRow } from "./workspace-table";

const GUTTER = 120;
const RIGHT = 16;
const LANE = 22;
const TOP = 8;
const BOTTOM = 22;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function fmtDay(ts: string) {
  return tsToDate(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Every indexed message as a dot on its channel's lane, by ts. Rows in the
 * current result are ink; everything else is hairline. Replayed hits are
 * success-filled; the cutoff is a dashed vertical rule.
 */
export function WorkspaceTimeline({
  messages,
  rows,
  cutoffTs,
  selectedTs,
  onSelect,
}: {
  /** The whole index, oldest first. */
  messages: IndexedMessage[];
  /** The current result set with replay marks. */
  rows: WorkspaceRow[];
  cutoffTs: string | undefined;
  selectedTs: string | null;
  onSelect: (ts: string) => void;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const lanes = [...new Set(messages.map((m) => m.channel_name))].sort();
  const laneY = new Map(lanes.map((name, i) => [name, TOP + LANE * i + LANE / 2]));
  const height = TOP + LANE * lanes.length + BOTTOM;
  const t0 = tsNum(messages[0]?.ts);
  const t1 = tsNum(messages[messages.length - 1]?.ts);
  const span = Math.max(1, t1 - t0);
  const plot = Math.max(1, width - GUTTER - RIGHT);
  const x = (ts: string) => GUTTER + ((tsNum(ts) - t0) / span) * plot;
  const byTs = new Map(rows.map((r) => [r.ts, r]));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + f * span);

  return (
    <div ref={ref} className="w-full rounded-[var(--radius-lg)] border border-hairline bg-surface px-2 py-2 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between px-2 pb-1">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Timeline · {messages.length} messages · {lanes.length} lanes</span>
        <span className="font-mono text-[10.5px] tabular-nums text-faint">
          {messages.length ? `${fmtDay(messages[0]!.ts)} → ${fmtDay(messages[messages.length - 1]!.ts)}` : "—"}
        </span>
      </div>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Workspace messages by time and channel" className="block">
          {lanes.map((name) => {
            const y = laneY.get(name)!;
            return (
              <g key={name}>
                <line x1={GUTTER} x2={width - RIGHT} y1={y} y2={y} stroke="var(--hairline)" strokeWidth={1} />
                <text x={GUTTER - 8} y={y + 3.5} textAnchor="end" fontSize={10.5} fontFamily="var(--font-mono), ui-monospace, monospace" fill="var(--faint)">
                  #{name}
                </text>
              </g>
            );
          })}
          {ticks.map((t) => {
            const tx = GUTTER + ((t - t0) / span) * plot;
            const d = new Date(t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
            return (
              <text key={t} x={tx} y={height - 6} textAnchor={t === t0 ? "start" : t === t1 ? "end" : "middle"} fontSize={10} fontFamily="var(--font-mono), ui-monospace, monospace" fill="var(--faint)">
                {d}
              </text>
            );
          })}
          {cutoffTs && (
            <g>
              <line x1={x(cutoffTs)} x2={x(cutoffTs)} y1={TOP} y2={height - BOTTOM + 4} stroke="var(--foreground)" strokeWidth={1} strokeDasharray="3 3" />
              <text
                x={x(cutoffTs) + (x(cutoffTs) > width - 60 ? -4 : 4)}
                y={TOP + 8}
                textAnchor={x(cutoffTs) > width - 60 ? "end" : "start"}
                fontSize={10}
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fill="var(--foreground)"
              >
                cutoff
              </text>
            </g>
          )}
          {messages.map((m) => {
            const row = byTs.get(m.ts);
            const inResult = Boolean(row);
            const mark = row?.mark ?? null;
            const selected = m.ts === selectedTs;
            const fill = mark === "returned" ? "var(--color-success)" : inResult ? "var(--foreground)" : "var(--surface)";
            const stroke = mark === "returned" ? "var(--color-success)" : inResult ? "var(--foreground)" : "var(--hairline-strong)";
            return (
              <g key={m.ts} className="cursor-pointer" onClick={() => onSelect(m.ts)}>
                <title>{`${m.user_name} · ${fmtTime(m.ts)} · #${m.channel_name}${mark === "returned" ? " · returned to reviewer" : mark === "hidden" ? " · after trigger, hidden" : ""}\n${m.text}`}</title>
                {selected && <circle cx={x(m.ts)} cy={laneY.get(m.channel_name)} r={8} fill="none" stroke="var(--foreground)" strokeWidth={1} />}
                <circle cx={x(m.ts)} cy={laneY.get(m.channel_name)} r={mark === "returned" ? 5 : 4} fill={fill} stroke={stroke} strokeWidth={m.is_change ? 2 : 1} opacity={mark === "hidden" ? 0.45 : 1} />
              </g>
            );
          })}
        </svg>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1 font-mono text-[10.5px] text-faint">
        <span>● in result</span>
        <span>○ filtered out</span>
        <span>thick ring = reads as change</span>
        <span>success fill = returned to reviewer</span>
      </div>
    </div>
  );
}
