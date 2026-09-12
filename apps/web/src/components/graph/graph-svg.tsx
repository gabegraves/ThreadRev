"use client";

/**
 * Column-layout evidence graph: message → document → run → finding → revision.
 * Nodes are rounded rects with a kind micro-label; stroke hue is status only.
 * Edge kind is encoded by dash pattern + marker, never by hue, so the seven
 * kinds stay distinguishable in grayscale and in both themes. All colours are
 * CSS vars from tokens.css.
 */
import { useMemo, useState } from "react";
import { downstreamOf, type EvidenceGraph, type GraphEdge, type GraphNode } from "agent-core/shared";
import { EmptyState } from "@/civic-ui/components/Tile";

const COLUMNS: GraphNode["kind"][] = ["message", "document", "run", "finding", "revision"];
const COL_W = 200;
const NODE_W = 164;
const NODE_H = 40;
const ROW_H = 58;
const PAD_X = 16;
const PAD_TOP = 34;

type Marker = "arrow" | "arrow-open" | "circle" | "diamond" | "bar";
type EdgeStyle = { dash?: string; width: number; marker: Marker; note: string };

export const EDGE_STYLES: Record<GraphEdge["kind"], EdgeStyle> = {
  read: { width: 1, marker: "arrow-open", note: "run read this" },
  checked_with: { dash: "6 3", width: 1, marker: "arrow", note: "inputs extracted from" },
  published_from: { width: 1.8, marker: "arrow", note: "card copied from run" },
  bound_to: { dash: "2 3", width: 1.2, marker: "circle", note: "card bound to revision" },
  supersedes: { dash: "8 3 2 3", width: 1.2, marker: "diamond", note: "newer card replaces older" },
  refused_by: { dash: "3 3", width: 1.8, marker: "bar", note: "revision moved; publish refused" },
  changes: { dash: "12 4", width: 1, marker: "arrow-open", note: "change message created revision" },
};

const STATUS_STROKE: Record<GraphNode["status"], string> = {
  live: "var(--color-success)",
  stale: "var(--color-warning)",
  refused: "var(--color-danger)",
  neutral: "var(--hairline-strong)",
};

function Markers({ prefix }: { prefix: string }) {
  // Marker content inherits colour from <defs>, not the referencing path, so
  // the whole marker set is painted in --subtle and edges fade via opacity.
  const c = "var(--subtle)";
  return (
    <defs>
      <marker id={`${prefix}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={c} />
      </marker>
      <marker id={`${prefix}-arrow-open`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M1,1 L9,5 L1,9" fill="none" stroke={c} strokeWidth="1.5" />
      </marker>
      <marker id={`${prefix}-circle`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7">
        <circle cx="5" cy="5" r="3.5" fill="var(--surface)" stroke={c} strokeWidth="1.5" />
      </marker>
      <marker id={`${prefix}-diamond`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M1,5 L5,1 L9,5 L5,9 z" fill={c} />
      </marker>
      <marker id={`${prefix}-bar`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M7,1 L7,9" stroke={c} strokeWidth="2.5" />
        <path d="M0,5 L7,5" stroke={c} strokeWidth="1.5" />
      </marker>
    </defs>
  );
}

type Placed = { node: GraphNode; col: number; x: number; y: number };

function layout(graph: EvidenceGraph) {
  const columns = COLUMNS.filter((kind) => graph.nodes.some((n) => n.kind === kind));
  const placed = new Map<string, Placed>();
  let rows = 1;
  columns.forEach((kind, col) => {
    const nodes = graph.nodes.filter((n) => n.kind === kind).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
    rows = Math.max(rows, nodes.length);
    nodes.forEach((node, row) => placed.set(node.id, { node, col, x: PAD_X + col * COL_W, y: PAD_TOP + row * ROW_H }));
  });
  return { columns, placed, width: PAD_X * 2 + (columns.length - 1) * COL_W + NODE_W, height: PAD_TOP + rows * ROW_H };
}

function edgePath(a: Placed, b: Placed): string {
  if (a.col === b.col) {
    // Same column (supersedes): bow out to the right so the curve clears the rects.
    const x = a.x + NODE_W, ay = a.y + NODE_H / 2, by = b.y + NODE_H / 2;
    return `M${x},${ay} C${x + 44},${ay} ${x + 44},${by} ${x},${by}`;
  }
  const ax = a.x + NODE_W, ay = a.y + NODE_H / 2;
  const bx = b.x, by = b.y + NODE_H / 2;
  const mx = (ax + bx) / 2;
  return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function EvidenceGraphSvg({
  graph,
  selected,
  onSelect,
}: {
  graph: EvidenceGraph;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const { columns, placed, width, height } = useMemo(() => layout(graph), [graph]);

  const lit = useMemo(() => {
    if (!hover) return null;
    const d = downstreamOf(graph, hover);
    return { nodes: d.nodes, edges: new Set(d.edges) };
  }, [hover, graph]);

  const toggle = (id: string) => onSelect(selected === id ? null : id);

  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <EmptyState message="No events in this log yet." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evidence graph"
        className="block text-foreground"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <Markers prefix="eg" />
        {columns.map((kind, col) => (
          <text
            key={kind}
            x={PAD_X + col * COL_W}
            y={16}
            fill="var(--faint)"
            fontSize={10.5}
            fontWeight={600}
            letterSpacing="0.12em"
            style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
          >
            {kind}s
          </text>
        ))}

        {graph.edges.map((e) => {
          const a = placed.get(e.from);
          const b = placed.get(e.to);
          if (!a || !b) return null;
          const st = EDGE_STYLES[e.kind];
          const on = lit ? lit.edges.has(e) : false;
          return (
            <path
              key={`${e.kind}|${e.from}|${e.to}`}
              d={edgePath(a, b)}
              fill="none"
              stroke="var(--subtle)"
              strokeWidth={on ? st.width + 0.6 : st.width}
              strokeDasharray={st.dash}
              markerEnd={`url(#eg-${st.marker})`}
              opacity={lit ? (on ? 1 : 0.12) : 0.6}
              style={{ transition: "opacity 120ms linear" }}
            >
              <title>{`${e.kind}: ${e.from} → ${e.to}`}</title>
            </path>
          );
        })}

        {[...placed.values()].map(({ node, x, y }) => {
          const dim = lit !== null && !lit.nodes.has(node.id);
          const isSel = selected === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${x},${y})`}
              opacity={dim ? 0.25 : 1}
              style={{ cursor: "pointer", transition: "opacity 120ms linear", outline: "none" }}
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(node.id)}
              onBlur={() => setHover(null)}
              onClick={() => toggle(node.id)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  toggle(node.id);
                }
              }}
            >
              <title>{`${node.kind} · ${node.status} · ${node.label}`}</title>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={isSel ? "var(--accent-soft)" : "var(--surface)"}
                stroke={STATUS_STROKE[node.status]}
                strokeWidth={isSel ? 2 : node.status === "neutral" ? 1 : 1.5}
              />
              <text
                x={10}
                y={14}
                fill="var(--faint)"
                fontSize={9.5}
                fontWeight={600}
                letterSpacing="0.1em"
                style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
              >
                {node.kind}
                {node.status !== "neutral" ? ` · ${node.status}` : ""}
              </text>
              <text x={10} y={30} fill="var(--foreground)" fontSize={12} fontWeight={500}>
                {clip(node.label, 22)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Seven edge kinds as swatches drawn with the exact path attributes the graph uses. */
export function EdgeLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {(Object.keys(EDGE_STYLES) as GraphEdge["kind"][]).map((kind) => {
        const st = EDGE_STYLES[kind];
        const prefix = `lg-${kind}`;
        return (
          <li key={kind} className="flex items-center gap-2" title={st.note}>
            <svg width={52} height={12} viewBox="0 0 52 12" aria-hidden className="shrink-0">
              <Markers prefix={prefix} />
              <path d="M2,6 L44,6" fill="none" stroke="var(--subtle)" strokeWidth={st.width} strokeDasharray={st.dash} markerEnd={`url(#${prefix}-${st.marker})`} />
            </svg>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{kind}</span>
          </li>
        );
      })}
    </ul>
  );
}
