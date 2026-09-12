"use client";

/**
 * Hand-rolled SVG/CSS charts for the analytics bento. No chart library.
 * Series hue comes from --fg-* tokens; state hue from status tokens only.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/civic-ui/lib/cn";
import { EmptyState } from "@/civic-ui/components/Tile";
import type { StatusTone } from "@/civic-ui/lib/status";
import { STATUS_TONE } from "@/lib/demo/status";
import { SERIES, TONE_DOT_CLASS, fmtAt } from "./metrics";

export type BarRow = { label: string; value: number; hint?: string; color?: string };

/** Horizontal bar list: label · bar · tabular value. */
export function BarList({ rows, unit }: { rows: BarRow[]; unit?: string }) {
  if (rows.length === 0) return <EmptyState />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-[12.5px] text-subtle" title={r.label}>
            {r.label}
          </span>
          <span className="h-2 overflow-hidden rounded-sm bg-overlay">
            <span
              data-bento-bar
              className="block h-full rounded-sm"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? SERIES[i % SERIES.length], "--bar-idx": i } as CSSProperties}
            />
          </span>
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {r.value}
            {unit ? ` ${unit}` : ""}
            {r.hint && <span className="text-faint"> · {r.hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export type StackedCol = { key: string; label: string; pass: number; fail: number };

/** Stacked pass/fail columns per run. Pass = success tone, fail = danger tone (state hue). */
export function StackedRunBars({ cols }: { cols: StackedCol[] }) {
  if (cols.length === 0) return <EmptyState message="No checker runs" />;
  const W = 100;
  const H = 56;
  const gap = 2;
  const cw = (W - gap * (cols.length - 1)) / cols.length;
  const max = Math.max(...cols.map((c) => c.pass + c.fail), 1);
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Checks pass versus fail per run">
        {cols.map((c, i) => {
          const x = i * (cw + gap);
          const ph = (c.pass / max) * H;
          const fh = (c.fail / max) * H;
          return (
            <g key={c.key}>
              <rect x={x} y={H - ph} width={cw} height={ph} fill="var(--color-success)" />
              <rect x={x} y={H - ph - fh} width={cw} height={fh} fill="var(--color-danger)" />
            </g>
          );
        })}
      </svg>
      <ul className="grid gap-1 font-mono text-[11px] tabular-nums text-faint" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
        {cols.map((c) => (
          <li key={c.key} className="min-w-0 truncate text-center" title={c.label}>
            {c.label}
          </li>
        ))}
      </ul>
      <p className="flex gap-4 text-[11px] uppercase tracking-[0.08em] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-1.5 rounded-full", TONE_DOT_CLASS[STATUS_TONE.live])} /> pass
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-1.5 rounded-full", TONE_DOT_CLASS[STATUS_TONE.refused])} /> fail
        </span>
      </p>
    </div>
  );
}

export type TimelinePoint = { id: string; at: string; tone: StatusTone; label: string };

const TONE_FILL: Record<StatusTone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "#5b6b8c",
  neutral: "var(--faint)",
};

/** Events over time as ticks on a strip; state-toned ticks are taller. */
export function TimelineStrip({ points }: { points: TimelinePoint[] }) {
  const times = points.map((p) => new Date(p.at).getTime()).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return <EmptyState message="No events" />;
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const span = Math.max(t1 - t0, 1);
  const W = 100;
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} 24`} preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label="Events over time">
        <line x1={0} x2={W} y1={12} y2={12} stroke="var(--hairline-strong)" strokeWidth={0.4} />
        {points.map((p, i) => {
          const t = new Date(p.at).getTime();
          const x = Number.isNaN(t) ? 0 : ((t - t0) / span) * W;
          const isState = p.tone !== "neutral";
          return (
            <rect key={p.id} x={x - 0.3} y={isState ? 4 : 8} width={0.6} height={isState ? 16 : 8} fill={TONE_FILL[p.tone]} opacity={isState ? 1 : 0.55}>
              <title>{`${i + 1}. ${p.label}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between font-mono text-[11px] tabular-nums text-faint">
        <span>{fmtAt(new Date(t0).toISOString())}</span>
        <span>{fmtAt(new Date(t1).toISOString())}</span>
      </div>
    </div>
  );
}

/** Mono caption under a tile naming the source event field. */
export function SourceCaption({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-t border-hairline pt-2 text-[11px] uppercase tracking-[0.08em] text-faint">from {children}</p>;
}
