"use client";

import { useMemo, useState } from "react";
import type { EvidenceGraph, GraphNode } from "agent-core/shared";
import { localDownstreamOf } from "./graph-utils";

const COLUMNS: GraphNode["kind"][] = ["message", "document", "run", "finding", "revision"];
const COL_W = 150;
const ROW_H = 46;
const NODE_W = 124;
const NODE_H = 30;
const PAD = 12;

type Placed = { node: GraphNode; x: number; y: number };

export function EvidenceGraphSvg({
  graph,
  compact = false,
  downstreamOf,
}: {
  graph: EvidenceGraph;
  compact?: boolean;
  /** Override for the local BFS when agent-core exports one. */
  downstreamOf?: (graph: EvidenceGraph, id: string) => Set<string> | string[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const placed = useMemo(() => {
    const out = new Map<string, Placed>();
    let maxRows = 1;
    COLUMNS.forEach((kind, col) => {
      const nodes = graph.nodes.filter((n) => n.kind === kind).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((node, row) => {
        out.set(node.id, { node, x: PAD + col * COL_W, y: PAD + 18 + row * ROW_H });
      });
    });
    return { nodes: out, height: PAD * 2 + 18 + maxRows * ROW_H };
  }, [graph]);

  const highlighted = useMemo(() => {
    if (!hover) return null;
    const set = downstreamOf ? new Set(downstreamOf(graph, hover)) : localDownstreamOf(graph, hover);
    set.add(hover);
    return set;
  }, [hover, graph, downstreamOf]);

  const width = PAD * 2 + COLUMNS.length * COL_W;
  const selectedNode = selected ? graph.nodes.find((n) => n.id === selected) : null;
  const dim = (id: string) => highlighted !== null && !highlighted.has(id);

  return (
    <div className={`ck-tr-graph${compact ? " ck-tr-graph--compact" : ""}`}>
      <svg viewBox={`0 0 ${width} ${placed.height}`} width="100%" role="img" aria-label="Evidence graph">
        {!compact &&
          COLUMNS.map((kind, col) => (
            <text key={kind} x={PAD + col * COL_W + NODE_W / 2} y={PAD + 4} className="ck-tr-graph-col" textAnchor="middle">
              {kind}s
            </text>
          ))}
        {graph.edges.map((e, i) => {
          const a = placed.nodes.get(e.from);
          const b = placed.nodes.get(e.to);
          if (!a || !b) return null;
          const ax = a.x + NODE_W / 2, ay = a.y + NODE_H / 2;
          const bx = b.x + NODE_W / 2, by = b.y + NODE_H / 2;
          const lit = highlighted !== null && highlighted.has(e.from) && highlighted.has(e.to);
          return (
            <g key={i} className={`ck-tr-edge${lit ? " is-lit" : ""}${highlighted && !lit ? " is-dim" : ""}`}>
              <line x1={ax} y1={ay} x2={bx} y2={by} />
              {!compact && (
                <text x={(ax + bx) / 2} y={(ay + by) / 2 - 3} textAnchor="middle">
                  {e.kind}
                </text>
              )}
            </g>
          );
        })}
        {[...placed.nodes.values()].map(({ node, x, y }) => (
          <g
            key={node.id}
            className={`ck-tr-node${dim(node.id) ? " is-dim" : ""}${selected === node.id ? " is-selected" : ""}`}
            data-status={node.status}
            transform={`translate(${x},${y})`}
            onMouseEnter={() => setHover(node.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setSelected((s) => (s === node.id ? null : node.id))}
            tabIndex={0}
            onKeyDown={(ev) => ev.key === "Enter" && setSelected((s) => (s === node.id ? null : node.id))}
          >
            <title>{`${node.kind}: ${node.label}`}</title>
            <rect width={NODE_W} height={NODE_H} rx={6} />
            <text x={8} y={NODE_H / 2 + 4}>
              {node.label.length > 18 ? node.label.slice(0, 17) + "…" : node.label}
            </text>
          </g>
        ))}
      </svg>
      {selectedNode && !compact && (
        <div className="ck-tr-hovercard" role="dialog" aria-label="Node details">
          <header>
            <span className="ck-tr-kind">{selectedNode.kind}</span>
            <span className="ck-tr-status" data-status={selectedNode.status}>{selectedNode.status}</span>
            <button type="button" className="ck-btn ck-btn--tiny" onClick={() => setSelected(null)}>
              Close
            </button>
          </header>
          <strong>{selectedNode.label}</strong>
          <pre>{JSON.stringify(selectedNode.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
