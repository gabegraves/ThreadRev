"use client";

/**
 * vis-network "map" of the evidence graph, ported from graphify's export.py
 * (_html_script: forceAtlas2Based physics, stabilise then physics off, dot
 * nodes sized by degree, hover lights the connected nodes, click selects) and
 * the soham-research explorer's selection model (selected node + everything
 * it touches stays lit, the rest dims to 25%).
 *
 * Fill hue encodes node KIND (the --fg-* category tokens), the ring encodes
 * status (live / stale / refused), radius encodes degree, the invalidation
 * edge kinds (supersedes / refused_by / changes) are dashed. vis draws on a
 * canvas, so token colours are read from getComputedStyle at mount and again
 * when the theme flips — both themes stay in Civic's palette.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { EvidenceGraph, GraphEdge, GraphNode } from "agent-core/shared";
import { DataSet, Network, type Options } from "vis-network/standalone";
import { EmptyState } from "@/civic-ui/components/Tile";
import { useTheme } from "@/civic/lib/grid/use-theme";

const KIND_TOKEN: Record<GraphNode["kind"], string> = {
  message: "--fg-electric-indigo",
  document: "--fg-amber-pulse",
  run: "--fg-cyan-burst",
  finding: "--fg-neon-coral",
  revision: "--fg-emerald-glow",
};

const STATUS_TOKEN: Record<GraphNode["status"], string> = {
  live: "--color-success",
  stale: "--color-warning",
  refused: "--color-danger",
  neutral: "--hairline-strong",
};

const DASHED = new Set<GraphEdge["kind"]>(["supersedes", "refused_by", "changes"]);
const ALWAYS_LABELLED = new Set<GraphNode["kind"]>(["finding", "document", "revision"]);
const DIM = 0.25;

type Palette = Record<string, string>;
const TOKENS = [
  ...Object.values(KIND_TOKEN),
  ...Object.values(STATUS_TOKEN),
  "--subtle",
  "--faint",
  "--foreground",
  "--surface",
  "--accent",
];

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const out: Palette = {};
  for (const t of TOKENS) out[t] = cs.getPropertyValue(t).trim() || "#888888";
  // canvas ctx.font cannot resolve var(--font-sans); hand vis the resolved stack.
  out.font = cs.fontFamily || "sans-serif";
  return out;
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

type VisNode = {
  id: string;
  label: string;
  title: string;
  size: number;
  borderWidth: number;
  opacity: number;
  color: { background: string; border: string; highlight: { background: string; border: string }; hover: { background: string; border: string } };
  font: { size: number; color: string; strokeWidth: number; strokeColor: string; face: string };
};
type VisEdge = {
  id: string;
  from: string;
  to: string;
  title: string;
  dashes: boolean;
  width: number;
  color: { color: string; highlight: string; hover: string; opacity: number };
  arrows: { to: { enabled: boolean; scaleFactor: number } };
};

const edgeId = (e: GraphEdge) => `${e.kind}|${e.from}|${e.to}`;

function buildNodes(graph: EvidenceGraph, pal: Palette, labels: Record<string, string> | undefined): VisNode[] {
  const degree = new Map<string, number>();
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const maxDeg = Math.max(1, ...degree.values());
  return graph.nodes.map((n) => {
    const deg = degree.get(n.id) ?? 0;
    const label = labels?.[n.id] ?? n.label;
    const fill = pal[KIND_TOKEN[n.kind]];
    const ring = pal[STATUS_TOKEN[n.status]];
    return {
      id: n.id,
      label: clip(label, 28),
      title: `${n.kind} · ${n.status} · ${label}`,
      // graphify: 10 + 30 * (deg / maxDeg); scaled down for a denser canvas.
      size: 7 + 14 * (deg / maxDeg),
      borderWidth: n.status === "neutral" ? 1 : 2.5,
      opacity: 1,
      color: {
        background: fill,
        border: ring,
        highlight: { background: fill, border: pal["--accent"] },
        hover: { background: fill, border: ring },
      },
      font: {
        // Low-degree message / run nodes stay unlabelled (graphify hides them
        // below 15% of max degree); the hover tooltip carries the label.
        size: ALWAYS_LABELLED.has(n.kind) ? 11 : 0,
        color: n.kind === "finding" ? pal["--foreground"] : pal["--subtle"],
        strokeWidth: 3,
        strokeColor: pal["--surface"],
        face: pal.font,
      },
    };
  });
}

function buildEdges(graph: EvidenceGraph, pal: Palette): VisEdge[] {
  return graph.edges.map((e) => ({
    id: edgeId(e),
    from: e.from,
    to: e.to,
    title: `${e.kind}: ${e.from} → ${e.to}`,
    dashes: DASHED.has(e.kind),
    width: e.kind === "published_from" || e.kind === "refused_by" ? 1.6 : 1,
    color: { color: pal["--subtle"], highlight: pal["--foreground"], hover: pal["--foreground"], opacity: 0.55 },
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
  }));
}

/* graphify's network options, verbatim bar the sizing. */
const OPTIONS: Options = {
  physics: {
    enabled: true,
    solver: "forceAtlas2Based",
    forceAtlas2Based: {
      gravitationalConstant: -60,
      centralGravity: 0.005,
      springLength: 120,
      springConstant: 0.08,
      damping: 0.4,
      avoidOverlap: 0.8,
    },
    stabilization: { iterations: 200, fit: true },
  },
  interaction: {
    hover: true,
    tooltipDelay: 100,
    hideEdgesOnDrag: true,
    navigationButtons: false,
    keyboard: false,
  },
  nodes: { shape: "dot", borderWidth: 1.5, borderWidthSelected: 3 },
  edges: { smooth: { enabled: true, type: "continuous", roundness: 0.2 }, selectionWidth: 3 },
};

type Props = {
  graph: EvidenceGraph;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Display-only label overrides (local edits), keyed by node id. */
  labels?: Record<string, string>;
  /** Node ids that carry a local note — drawn with a small dot marker. */
  noted?: Set<string>;
};

export function EvidenceGraphNetwork(props: Props) {
  // The live scenario starts with an empty graph; the canvas (and its
  // mount-time network) only exists once there is something to draw.
  if (props.graph.nodes.length === 0) {
    return (
      <div className="h-full rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <EmptyState message="No events in this log yet." />
      </div>
    );
  }
  return <NetworkCanvas {...props} />;
}

function NetworkCanvas({ graph, selected, onSelect, labels, noted }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<Network | null>(null);
  const nodesRef = useRef(new DataSet<VisNode>([]));
  const edgesRef = useRef(new DataSet<VisEdge>([]));
  const { theme } = useTheme();
  const [pal, setPal] = useState<Palette | null>(null);

  // Latest props for the network's event handlers (bound once).
  const live = useRef({ graph, selected, onSelect, noted, hover: null as string | null, fromClick: false });
  live.current.graph = graph;
  live.current.selected = selected;
  live.current.onSelect = onSelect;
  live.current.noted = noted;

  // Live polling hands over a new graph object every 5 s; key the network on
  // the graph's shape so physics only reruns when a node or edge changes.
  const shapeKey = useMemo(
    () => graph.nodes.map((n) => `${n.id}|${n.status}`).join("\n") + "\n" + graph.edges.map(edgeId).join("\n"),
    [graph],
  );

  // Token colours: read at mount and whenever the theme flips.
  useEffect(() => {
    if (wrapRef.current) setPal(readPalette(wrapRef.current));
  }, [theme]);

  // Lit set = hovered node + its connections while hovering another node;
  // otherwise the selection + its connections; otherwise everything.
  const applyHighlight = () => {
    const net = netRef.current;
    if (!net) return;
    const { selected: sel, hover } = live.current;
    const focus = hover && hover !== sel ? hover : sel;
    const keep = focus ? new Set<string>([focus, ...(net.getConnectedNodes(focus) as string[])]) : null;
    nodesRef.current.update(nodesRef.current.get().map((n) => ({ id: n.id, opacity: keep && !keep.has(n.id) ? DIM : 1 })));
    edgesRef.current.update(
      edgesRef.current.get().map((e) => ({
        id: e.id,
        color: { ...e.color, opacity: !keep ? 0.55 : e.from === focus || e.to === focus ? 1 : DIM * 0.4 },
      })),
    );
  };

  // (Re)build the network when the shape or palette changes.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !pal) return;
    nodesRef.current.clear();
    edgesRef.current.clear();
    nodesRef.current.add(buildNodes(live.current.graph, pal, labels));
    edgesRef.current.add(buildEdges(live.current.graph, pal));

    const net = new Network(el, { nodes: nodesRef.current, edges: edgesRef.current }, OPTIONS);
    netRef.current = net;
    net.once("stabilizationIterationsDone", () => net.setOptions({ physics: { enabled: false } }));

    net.on("hoverNode", (p: { node: string }) => {
      live.current.hover = p.node;
      applyHighlight();
    });
    net.on("blurNode", () => {
      live.current.hover = null;
      applyHighlight();
    });
    net.on("click", (p: { nodes: string[] }) => {
      const id = p.nodes[0] ?? null;
      live.current.fromClick = true;
      live.current.onSelect(id === live.current.selected ? null : id);
    });
    // Note markers: a small warning dot at the top-right of every noted node.
    net.on("afterDrawing", (ctx: CanvasRenderingContext2D) => {
      const ids = live.current.noted;
      if (!ids || ids.size === 0) return;
      const pos = net.getPositions([...ids]);
      ctx.save();
      for (const id of ids) {
        const p = pos[id];
        const n = nodesRef.current.get(id);
        if (!p || !n) continue;
        const r = n.size;
        ctx.beginPath();
        ctx.arc(p.x + r * 0.75, p.y - r * 0.75, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = pal["--color-warning"];
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = pal["--surface"];
        ctx.stroke();
      }
      ctx.restore();
    });

    // vis only listens to window resize; fullscreen and pane changes come
    // through the container, so mirror its size explicitly.
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        net.setSize(`${width}px`, `${height}px`);
        net.redraw();
      }
    });
    ro.observe(el);

    if (live.current.selected) net.selectNodes([live.current.selected]);
    applyHighlight();
    return () => {
      ro.disconnect();
      net.destroy();
      netRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, pal]);

  // Selection from the panel / neighbour links: select + glide to it. A
  // canvas click already has the node under the pointer, so no glide.
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    if (selected && nodesRef.current.get(selected)) {
      net.selectNodes([selected]);
      if (!live.current.fromClick) net.focus(selected, { scale: Math.max(net.getScale(), 1), animation: { duration: 250, easingFunction: "easeInOutQuad" } });
    } else {
      net.unselectAll();
    }
    live.current.fromClick = false;
    applyHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Label overrides are display-only: patch the dataset, never rebuild.
  useEffect(() => {
    if (!netRef.current) return;
    nodesRef.current.update(
      graph.nodes.map((n) => {
        const label = labels?.[n.id] ?? n.label;
        return { id: n.id, label: clip(label, 28), title: `${n.kind} · ${n.status} · ${label}` };
      }),
    );
  }, [labels, graph]);

  // Note dots live in afterDrawing; nudge a repaint when the set changes.
  useEffect(() => {
    netRef.current?.redraw();
  }, [noted]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <div ref={wrapRef} role="img" aria-label="Evidence graph map" className="h-full w-full" style={{ fontFamily: "var(--font-sans)" }} />
      <button
        type="button"
        onClick={() => netRef.current?.fit({ animation: { duration: 250, easingFunction: "easeInOutQuad" } })}
        className="absolute right-3 top-3 rounded-[var(--radius-md)] border border-hairline bg-surface px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint hover:text-foreground"
      >
        fit
      </button>
    </div>
  );
}

/** Kind swatches (fill hue) + status rings, matching the canvas's exact paints. */
export function MapLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
      {(Object.keys(KIND_TOKEN) as GraphNode["kind"][]).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: `var(${KIND_TOKEN[kind]})` }} aria-hidden />
          {kind}
        </li>
      ))}
      <li aria-hidden className="h-3 w-px bg-hairline" />
      {(["live", "stale", "refused"] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-[2px] bg-surface" style={{ borderColor: `var(${STATUS_TOKEN[s]})` }} aria-hidden />
          {s}
        </li>
      ))}
      <li aria-hidden className="h-3 w-px bg-hairline" />
      <li className="flex items-center gap-1.5">
        <span className="h-px w-5 border-t border-dashed border-subtle" aria-hidden />
        supersedes · refused · changes
      </li>
    </ul>
  );
}
