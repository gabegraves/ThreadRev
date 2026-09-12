"use client";

/**
 * Evidence graph canvas, ported 1:1 from the user's research explorer
 * (soham-research.vercel.app, `app.js` renderGraph): plain d3 v7
 * forceSimulation with the same forces and strengths, the same drag handler
 * (fx/fy pinned on drag, released on end), the same zoom/pan, symbol/size
 * tables, wrapLabel, arrow-marker defs, straight linkPath trimmed to the node
 * radius, the link hover tip, and the same selection classes (.selected,
 * .node.dim, .link.dim).
 *
 * Only the colours change: the explorer's raw hexes are swapped for Civic
 * tokens so dark and light both work. Node fill encodes kind, the shape ring
 * encodes status (live / stale / refused).
 */
import { useEffect, useMemo, useRef } from "react";
import type { EvidenceGraph, GraphEdge, GraphNode } from "agent-core/shared";
import * as d3 from "d3";
import { EmptyState } from "@/civic-ui/components/Tile";

type Kind = GraphNode["kind"];
type EdgeKind = GraphEdge["kind"];

const KIND_STYLE: Record<Kind, { color: string; symbol: d3.SymbolType; size: number }> = {
  message: { color: "var(--fg-electric-indigo)", symbol: d3.symbolCircle, size: 300 },
  document: { color: "var(--fg-amber-pulse)", symbol: d3.symbolSquare, size: 300 },
  run: { color: "var(--fg-cyan-burst)", symbol: d3.symbolTriangle, size: 340 },
  finding: { color: "var(--fg-neon-coral)", symbol: d3.symbolStar, size: 420 },
  revision: { color: "var(--fg-emerald-glow)", symbol: d3.symbolDiamond, size: 340 },
};

const LINK_STYLE: Record<EdgeKind, { color: string; dash: string | null }> = {
  read: { color: "var(--subtle)", dash: null },
  checked_with: { color: "var(--subtle)", dash: "5,4" },
  published_from: { color: "var(--foreground)", dash: null },
  bound_to: { color: "var(--subtle)", dash: "2,4" },
  supersedes: { color: "var(--color-warning)", dash: "9,5" },
  refused_by: { color: "var(--color-danger)", dash: "7,4" },
  changes: { color: "var(--color-warning)", dash: "12,4" },
};

const STATUS_STROKE: Record<GraphNode["status"], string> = {
  live: "var(--color-success)",
  stale: "var(--color-warning)",
  refused: "var(--color-danger)",
  neutral: "var(--surface)",
};

/** pe-style.css "graph elements", scoped under .pe-graph, tokens for hexes. */
const CSS = `
.pe-graph .node{cursor:pointer}
.pe-graph .node .shape{stroke-width:1.5px;transition:opacity .18s}
.pe-graph .node text{font-size:11px;fill:var(--subtle);pointer-events:none;paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round}
.pe-graph .node.is-claim text{fill:var(--foreground);font-size:12px;font-weight:600}
.pe-graph .node.selected .shape{stroke:var(--foreground);stroke-width:2.5px}
.pe-graph .node.dim{opacity:.13}
.pe-graph .link{fill:none;transition:opacity .18s}
.pe-graph .link.dim{opacity:.05}
.pe-graph .link-hit{stroke:transparent;stroke-width:12px;fill:none;cursor:pointer}
.pe-graph .linktip{position:absolute;pointer-events:none;z-index:20;max-width:320px;background:var(--elevated);border:1px solid var(--hairline);border-radius:var(--radius-md);padding:6px 8px;font-size:12px;line-height:1.45;color:var(--foreground)}
.pe-graph .linktip b{color:var(--foreground);font-weight:600}
`;

type N = d3.SimulationNodeDatum & { id: string; kind: Kind; label: string; status: GraphNode["status"] };
type L = d3.SimulationLinkDatum<N> & { id: string; type: EdgeKind };
type Model = { nodes: N[]; links: L[]; byId: Record<string, N> };

/* ---------------------------------------------------------------- ported helpers */

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** greedy word wrap into at most maxLines lines of ~maxChars, ellipsing leftovers */
function wrapLabel(s: string, maxChars: number, maxLines: number): string[] {
  const words = String(s ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let dropped = false;
  words.forEach((w) => {
    if (lines.length >= maxLines) {
      dropped = true;
      return;
    }
    const test = cur ? `${cur} ${w}` : w;
    if (test.length <= maxChars) {
      cur = test;
      return;
    }
    if (cur) {
      lines.push(cur);
      cur = w;
    } else {
      lines.push(truncate(w, maxChars));
      cur = "";
    }
  });
  if (cur) {
    if (lines.length < maxLines) lines.push(cur);
    else dropped = true;
  }
  if (dropped && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(1, maxChars - 2))}…`;
  }
  return lines.length ? lines : [""];
}

const nodeSize = (n: N) => KIND_STYLE[n.kind].size;
const nodeSymbol = (n: N) => KIND_STYLE[n.kind].symbol;
const nodeRadius = (n: N) => Math.sqrt(nodeSize(n) / Math.PI) + 3;
const markerId = (t: string) => `arrow-${t.replace(/[^a-z0-9_]/gi, "_")}`;

function ensureDefs(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, model: Model) {
  const defs = svg.append("defs");
  const ids = [...new Set(model.links.map((l) => l.type))];
  defs
    .selectAll("marker")
    .data(ids)
    .join("marker")
    .attr("id", (d) => markerId(d))
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-4L9,0L0,4")
    .attr("fill", (d) => LINK_STYLE[d].color);
}

function linkPath(d: L): string {
  const s = d.source as N;
  const t = d.target as N;
  if (s.x == null || t.x == null || s.y == null || t.y == null) return "M0,0L0,0";
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const rT = nodeRadius(t) + 6;
  const rS = nodeRadius(s) + 2;
  return `M${s.x + (dx / dist) * rS},${s.y + (dy / dist) * rS}L${t.x - (dx / dist) * rT},${t.y - (dy / dist) * rT}`;
}

function neighborsOf(model: Model, id: string): Set<string> {
  const out = new Set<string>([id]);
  model.links.forEach((l) => {
    const s = (l.source as N).id ?? (l.source as unknown as string);
    const t = (l.target as N).id ?? (l.target as unknown as string);
    if (s === id) out.add(t);
    else if (t === id) out.add(s);
  });
  return out;
}

/* ---------------------------------------------------------------- component */

type Props = {
  graph: EvidenceGraph;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Node ids that carry a local note — drawn with a small warning dot. */
  noted?: Set<string>;
};

export function EvidenceGraphNetwork({ graph, selected, onSelect, noted }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<{
    model: Model;
    nodeSel: d3.Selection<SVGGElement, N, SVGGElement, unknown>;
    linkSel: d3.Selection<SVGPathElement, L, SVGGElement, unknown>;
  } | null>(null);

  // Latest callback for the handlers bound once per build.
  const pick = useRef(onSelect);
  pick.current = onSelect;

  // Selection: the node and its neighbours stay lit, everything else dims.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const applyHighlight = () => {
    const view = viewRef.current;
    if (!view) return;
    const id = selectedRef.current;
    const keep = id && view.model.byId[id] ? neighborsOf(view.model, id) : null;
    view.nodeSel.classed("selected", (d) => d.id === id).classed("dim", (d) => !!keep && !keep.has(d.id));
    view.linkSel.classed("dim", (d) => {
      if (!keep) return false;
      return (d.source as N).id !== id && (d.target as N).id !== id;
    });
  };
  useEffect(applyHighlight, [selected]);

  // Live polling hands over a new graph object every 5 s; rebuild only when a
  // node or edge actually changes, so the simulation is not restarted.
  const shapeKey = useMemo(
    () => graph.nodes.map((n) => `${n.id}|${n.status}|${n.label}`).join("\n") + "\n" + graph.edges.map((e) => `${e.kind}|${e.from}|${e.to}`).join("\n"),
    [graph],
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    if (!wrap || !svgEl || graph.nodes.length === 0) return;

    const nodes: N[] = graph.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, status: n.status }));
    const byId: Record<string, N> = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const links: L[] = graph.edges
      .filter((e) => byId[e.from] && byId[e.to])
      .map((e) => ({ id: `${e.kind}|${e.from}|${e.to}`, type: e.kind, source: e.from, target: e.to }));
    const model: Model = { nodes, links, byId };

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const box = wrap.getBoundingClientRect();
    let W = Math.max(320, box.width);
    let H = Math.max(280, box.height);
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    ensureDefs(svg, model);

    const root = svg.append("g").attr("class", "root");
    const linkLayer = root.append("g").attr("class", "links");
    const hitLayer = root.append("g").attr("class", "link-hits");
    const nodeLayer = root.append("g").attr("class", "nodes");

    const linkSel = linkLayer
      .selectAll<SVGPathElement, L>("path")
      .data(model.links, (d) => d.id)
      .join("path")
      .attr("class", "link")
      .attr("stroke", (d) => LINK_STYLE[d.type].color)
      .attr("stroke-width", 1.4)
      .attr("stroke-opacity", 0.8)
      .attr("stroke-dasharray", (d) => LINK_STYLE[d.type].dash)
      .attr("marker-end", (d) => `url(#${markerId(d.type)})`);

    const hitSel = hitLayer
      .selectAll<SVGPathElement, L>("path")
      .data(model.links, (d) => d.id)
      .join("path")
      .attr("class", "link-hit")
      .on("mousemove", (event: MouseEvent, d) => showLinkTip(event, d))
      .on("mouseleave", () => tipRef.current?.classList.add("hidden"));

    const nodeSel = nodeLayer
      .selectAll<SVGGElement, N>("g")
      .data(model.nodes, (d) => d.id)
      .join("g")
      .attr("class", (d) => `node${d.kind === "finding" ? " is-claim" : ""}`)
      .on("click", (event: MouseEvent, d) => {
        event.stopPropagation();
        pick.current(d.id === selectedRef.current ? null : d.id);
      });

    nodeSel
      .append("path")
      .attr("class", "shape")
      .attr("d", (d) => d3.symbol().type(nodeSymbol(d)).size(nodeSize(d))())
      .attr("fill", (d) => KIND_STYLE[d.kind].color)
      .attr("stroke", (d) => STATUS_STROKE[d.status]);

    nodeSel.append("title").text((d) => `${d.kind} · ${d.status} · ${d.label}`);

    // A note marker rides at the top-right of the node's radius.
    nodeSel
      .filter((d) => !!noted?.has(d.id))
      .append("circle")
      .attr("class", "note-dot")
      .attr("r", 3.5)
      .attr("cx", (d) => nodeRadius(d) * 0.8)
      .attr("cy", (d) => -nodeRadius(d) * 0.8)
      .attr("fill", "var(--color-warning)")
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 1.2);

    nodeSel.each(function (d) {
      const lines = wrapLabel(d.label, 22, 2);
      const text = d3
        .select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", nodeRadius(d) + 12);
      lines.forEach((line, i) => {
        text.append("tspan").attr("x", 0).attr("dy", i === 0 ? 0 : 12).text(line);
      });
    });

    const sim = d3
      .forceSimulation(model.nodes)
      .force(
        "link",
        d3
          .forceLink<N, L>(model.links)
          .id((d) => d.id)
          .distance(130)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-520))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide<N>().radius((d) => nodeRadius(d) + 28))
      .force("x", d3.forceX(W / 2).strength(0.03))
      .force("y", d3.forceY(H / 2).strength(0.05));

    sim.on("tick", () => {
      linkSel.attr("d", linkPath);
      hitSel.attr("d", linkPath);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    nodeSel.call(
      d3
        .drag<SVGGElement, N>()
        // A click must not disturb the layout: nothing is pinned and the
        // simulation is not reheated until the pointer actually moves.
        .clickDistance(4)
        .on("drag", (event, d) => {
          if (d.fx == null) {
            if (!event.active) sim.alphaTarget(0.3).restart();
          }
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (d.fx == null) return;
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on("zoom", (event) => root.attr("transform", event.transform.toString()));
    svg.call(zoom);
    svg.on("click", () => pick.current(null));

    function showLinkTip(event: MouseEvent, d: L) {
      const tip = tipRef.current;
      if (!tip || !wrap) return;
      const wrapBox = wrap.getBoundingClientRect();
      const s = d.source as N;
      const t = d.target as N;
      // textContent, not innerHTML: node labels come from the event log.
      tip.replaceChildren();
      const kind = document.createElement("b");
      kind.textContent = d.type.replace(/_/g, " ");
      const pair = document.createElement("div");
      pair.textContent = `${truncate(s.label, 40)} → ${truncate(t.label, 40)}`;
      tip.append(kind, pair);
      tip.classList.remove("hidden");
      let x = event.clientX - wrapBox.left + 14;
      let y = event.clientY - wrapBox.top + 14;
      if (x + tip.offsetWidth > wrapBox.width - 8) x = wrapBox.width - tip.offsetWidth - 8;
      if (y + tip.offsetHeight > wrapBox.height - 8) y = y - tip.offsetHeight - 28;
      tip.style.left = `${Math.max(8, x)}px`;
      tip.style.top = `${Math.max(8, y)}px`;
    }

    viewRef.current = { model, nodeSel, linkSel };
    applyHighlight();

    // Fullscreen and pane changes resize the container, not the window.
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      if (r.width < 1 || r.height < 1) return;
      W = Math.max(320, r.width);
      H = Math.max(280, r.height);
      svg.attr("viewBox", `0 0 ${W} ${H}`);
      sim.force("center", d3.forceCenter(W / 2, H / 2));
      sim.force("x", d3.forceX(W / 2).strength(0.03));
      sim.force("y", d3.forceY(H / 2).strength(0.05));
      sim.alpha(0.2).restart();
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      sim.stop();
      svg.on(".zoom", null).on("click", null);
      svg.selectAll("*").remove();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, noted]);

  return (
    <div ref={wrapRef} className="pe-graph relative h-full w-full">
      <style>{CSS}</style>
      {graph.nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState message="No events in this log yet." />
        </div>
      ) : (
        <svg ref={svgRef} role="img" aria-label="Evidence graph" className="h-full w-full" style={{ fontFamily: "var(--font-sans)" }} />
      )}
      <div ref={tipRef} className="linktip hidden" />
    </div>
  );
}

/** The one legend: the five node kinds as the symbols the canvas draws, a
 *  28px strip under it (renderLegend's node-kind list, flattened). */
export function KindLegend() {
  return (
    <ul className="flex h-7 shrink-0 items-center gap-x-4 border-t border-hairline px-4 text-[11px] uppercase tracking-wide text-faint">
      {(Object.keys(KIND_STYLE) as Kind[]).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-8 -8 16 16" aria-hidden>
            <path d={d3.symbol().type(KIND_STYLE[kind].symbol).size(Math.min(KIND_STYLE[kind].size, 180))() ?? ""} fill={KIND_STYLE[kind].color} />
          </svg>
          {kind}
        </li>
      ))}
    </ul>
  );
}
