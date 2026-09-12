"use client";

/**
 * Force-directed "map" of the evidence graph, in the spirit of an Obsidian /
 * graphify graph view. Fill hue encodes node KIND (the --fg-* category tokens,
 * the only place the app uses categorical colour), the ring encodes status
 * (live / stale / refused), radius encodes degree. Edges are hairlines with a
 * small arrowhead; the edge kind is the hover tooltip.
 *
 * The simulation is deterministic: positions are seeded by node index and a
 * fixed number of spring + repulsion + centering ticks run inside useMemo, so
 * the same log always draws the same picture. No d3, no animation loop.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { downstreamOf, type EvidenceGraph, type GraphEdge, type GraphNode } from "agent-core/shared";
import { EmptyState } from "@/civic-ui/components/Tile";

const KIND_FILL: Record<GraphNode["kind"], string> = {
  message: "var(--fg-electric-indigo)",
  document: "var(--fg-amber-pulse)",
  run: "var(--fg-cyan-burst)",
  finding: "var(--fg-neon-coral)",
  revision: "var(--fg-emerald-glow)",
};

const STATUS_RING: Record<GraphNode["status"], string> = {
  live: "var(--color-success)",
  stale: "var(--color-warning)",
  refused: "var(--color-danger)",
  neutral: "var(--hairline-strong)",
};

const ALWAYS_LABELLED = new Set<GraphNode["kind"]>(["finding", "document", "revision"]);

const TICKS = 300;
const MIN_H = 480;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;

type Pt = { x: number; y: number };
type Sim = { pos: Map<string, Pt>; radius: Map<string, number>; bbox: { x0: number; y0: number; x1: number; y1: number } };

/* ----------------------------------------------------------------- sim */

function simulate(graph: EvidenceGraph): Sim {
  const ids = graph.nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const degree = new Array<number>(n).fill(0);
  const links: [number, number][] = [];
  for (const e of graph.edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined) continue;
    degree[a]++;
    degree[b]++;
    links.push([a, b]);
  }
  const r = degree.map((d) => Math.min(6 + 2.4 * Math.sqrt(d), 18));

  // Golden-angle spiral seed: unique, spread, and a pure function of index.
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963;
    const d = 18 * Math.sqrt(i + 1);
    xs[i] = Math.cos(a) * d;
    ys[i] = Math.sin(a) * d;
  }

  for (let t = 0; t < TICKS; t++) {
    const alpha = 1 - t / TICKS;
    // Repulsion, O(n²). Logs are tens of nodes, not thousands.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[j] - xs[i];
        let dy = ys[j] - ys[i];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = ((i * 7919) % 13) - 6;
          dy = ((j * 104729) % 11) - 5;
          d2 = dx * dx + dy * dy || 1;
        }
        const f = (3200 * alpha) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vx[i] -= fx;
        vy[i] -= fy;
        vx[j] += fx;
        vy[j] += fy;
      }
    }
    // Springs along edges.
    for (const [a, b] of links) {
      const dx = xs[b] - xs[a];
      const dy = ys[b] - ys[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = 90 + r[a] + r[b];
      const f = ((d - rest) / d) * 0.05 * alpha;
      vx[a] += dx * f;
      vy[a] += dy * f;
      vx[b] -= dx * f;
      vy[b] -= dy * f;
    }
    // Centering + damping.
    for (let i = 0; i < n; i++) {
      vx[i] -= xs[i] * 0.01 * alpha;
      vy[i] -= ys[i] * 0.01 * alpha;
      vx[i] *= 0.6;
      vy[i] *= 0.6;
      xs[i] += vx[i];
      ys[i] += vy[i];
    }
  }

  const pos = new Map<string, Pt>();
  const radius = new Map<string, number>();
  const bbox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  ids.forEach((id, i) => {
    pos.set(id, { x: xs[i], y: ys[i] });
    radius.set(id, r[i]);
    bbox.x0 = Math.min(bbox.x0, xs[i] - r[i]);
    bbox.y0 = Math.min(bbox.y0, ys[i] - r[i]);
    bbox.x1 = Math.max(bbox.x1, xs[i] + r[i]);
    bbox.y1 = Math.max(bbox.y1, ys[i] + r[i]);
  });
  return { pos, radius, bbox };
}

type View = { x: number; y: number; k: number };

function fitView(bbox: Sim["bbox"], w: number, h: number): View {
  const pad = 56;
  const bw = Math.max(bbox.x1 - bbox.x0, 1);
  const bh = Math.max(bbox.y1 - bbox.y0, 1);
  const k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 2.5);
  const cx = (bbox.x0 + bbox.x1) / 2;
  const cy = (bbox.y0 + bbox.y1) / 2;
  return { k, x: w / 2 - cx * k, y: h / 2 - cy * k };
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ----------------------------------------------------------- component */

type Props = {
  graph: EvidenceGraph;
  selected: string | null;
  onSelect: (id: string | null) => void;
};

export function EvidenceGraphMap(props: Props) {
  // The live scenario starts with an empty graph, so the canvas (and its
  // mount-time ref effects) only exists once there is something to draw.
  if (props.graph.nodes.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <EmptyState message="No events in this log yet." />
      </div>
    );
  }
  return <MapCanvas {...props} />;
}

function MapCanvas({ graph, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: MIN_H });
  const [view, setView] = useState<View>({ x: 400, y: MIN_H / 2, k: 1 });
  // 1 = settled; <1 contracts nodes toward the centroid for the mount settle.
  const [settle, setSettle] = useState(1);

  // Live polling hands over a new graph object every 5 s; key the sim on the
  // graph's shape so positions (and the fit below) only change when it does,
  // and a pan/zoom is not stomped on every poll.
  const shapeKey = useMemo(
    () => graph.nodes.map((n) => n.id).join("\n") + "\n" + graph.edges.map((e) => `${e.kind}|${e.from}|${e.to}`).join("\n"),
    [graph],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sim = useMemo(() => simulate(graph), [shapeKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sizeRef = useRef(size);
  sizeRef.current = size;
  const fit = () => setView(fitView(sim.bbox, sizeRef.current.w, sizeRef.current.h));

  useEffect(() => {
    setView(fitView(sim.bbox, size.w, size.h));
  }, [sim, size.w, size.h]);

  // Gentle 20-frame settle on mount, skipped under reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let raf = 0;
    setSettle(0.8);
    const step = () => {
      frame++;
      const t = frame / 20;
      setSettle(0.8 + 0.2 * (1 - (1 - t) * (1 - t)));
      if (frame < 20) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  // Wheel must be non-passive to stop the page scrolling; React's onWheel is passive.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      setView((v) => {
        const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * Math.exp(-ev.deltaY * 0.0015)));
        return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const onPointerDown = (ev: React.PointerEvent<SVGRectElement>) => {
    drag.current = { px: ev.clientX, py: ev.clientY, vx: view.x, vy: view.y };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const onPointerMove = (ev: React.PointerEvent<SVGRectElement>) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + ev.clientX - d.px, y: d.vy + ev.clientY - d.py }));
  };
  const onPointerUp = (ev: React.PointerEvent<SVGRectElement>) => {
    drag.current = null;
    ev.currentTarget.releasePointerCapture(ev.pointerId);
  };

  const lit = useMemo(() => {
    if (!hover) return null;
    const d = downstreamOf(graph, hover);
    return { nodes: d.nodes, edges: new Set(d.edges) };
  }, [hover, graph]);

  const toggle = (id: string) => onSelect(selected === id ? null : id);

  const cx = (sim.bbox.x0 + sim.bbox.x1) / 2;
  const cy = (sim.bbox.y0 + sim.bbox.y1) / 2;
  const at = (id: string): Pt => {
    const p = sim.pos.get(id) ?? { x: cx, y: cy };
    return { x: cx + (p.x - cx) * settle, y: cy + (p.y - cy) * settle };
  };
  const labelled = (n: GraphNode) => ALWAYS_LABELLED.has(n.kind) || hover === n.id || selected === n.id;

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]"
      style={{ minHeight: MIN_H, height: MIN_H }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        role="img"
        aria-label="Evidence graph map"
        className="block select-none text-foreground"
        style={{ fontFamily: "var(--font-sans)", touchAction: "none" }}
      >
        <defs>
          <marker id="gm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--subtle)" strokeWidth="1.5" />
          </marker>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="transparent"
          style={{ cursor: drag.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {graph.edges.map((e: GraphEdge) => {
            const a = at(e.from);
            const b = at(e.to);
            const rb = (sim.radius.get(e.to) ?? 6) + 4;
            const ra = sim.radius.get(e.from) ?? 6;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const on = lit ? lit.edges.has(e) : false;
            return (
              <line
                key={`${e.kind}|${e.from}|${e.to}`}
                x1={a.x + (dx / d) * ra}
                y1={a.y + (dy / d) * ra}
                x2={b.x - (dx / d) * rb}
                y2={b.y - (dy / d) * rb}
                stroke="var(--subtle)"
                strokeWidth={(on ? 1.6 : 0.8) / view.k}
                markerEnd="url(#gm-arrow)"
                opacity={lit ? (on ? 1 : 0.1) : 0.5}
                style={{ transition: "opacity 120ms linear" }}
              >
                <title>{`${e.kind}: ${e.from} → ${e.to}`}</title>
              </line>
            );
          })}

          {graph.nodes.map((node) => {
            const p = at(node.id);
            const r = sim.radius.get(node.id) ?? 6;
            const dim = lit !== null && !lit.nodes.has(node.id);
            const isSel = selected === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={dim ? 0.2 : 1}
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
                {isSel && <circle r={r + 5} fill="none" stroke="var(--foreground)" strokeWidth={1.5 / view.k} strokeDasharray={`${3 / view.k} ${3 / view.k}`} />}
                <circle
                  r={r}
                  fill={KIND_FILL[node.kind]}
                  stroke={STATUS_RING[node.status]}
                  strokeWidth={(node.status === "neutral" ? 1 : 2.5) / view.k}
                />
                {labelled(node) && (
                  <text
                    y={r + 12 / view.k}
                    textAnchor="middle"
                    fontSize={11 / view.k}
                    fontWeight={node.kind === "finding" ? 500 : 400}
                    className={node.kind === "finding" ? "text-foreground" : "text-subtle"}
                    style={{ fill: "currentColor", pointerEvents: "none", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 / view.k, strokeLinejoin: "round" }}
                  >
                    {clip(node.label, 28)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <button
        type="button"
        onClick={fit}
        className="absolute right-3 top-3 rounded-[var(--radius-md)] border border-hairline bg-surface px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint hover:text-foreground"
      >
        fit
      </button>
    </div>
  );
}

/** Kind swatches (fill hue) + status rings, matching the map's exact paints. */
export function MapLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
      {(Object.keys(KIND_FILL) as GraphNode["kind"][]).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: KIND_FILL[kind] }} aria-hidden />
          {kind}
        </li>
      ))}
      <li aria-hidden className="h-3 w-px bg-hairline" />
      {(["live", "stale", "refused"] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-[2px] bg-surface" style={{ borderColor: STATUS_RING[s] }} aria-hidden />
          {s}
        </li>
      ))}
    </ul>
  );
}
