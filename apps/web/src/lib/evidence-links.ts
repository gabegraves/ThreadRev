/**
 * Where an evidence id lives in the console. Graph node ids are the raw
 * evidence ids (message ts, document sha256, checker run_id, finding_id), so
 * one lookup covers the trace timeline, the thread detail and the graph panel.
 */
import type { EvidenceGraph } from "agent-core/shared";

export function graphHref(nodeId: string): string {
  return `/graph?node=${encodeURIComponent(nodeId)}`;
}

/** Page for an id, or null when the graph has no such node (or it is a revision). */
export function hrefForId(graph: EvidenceGraph, id: string): string | null {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return null;
  const q = encodeURIComponent(id);
  switch (node.kind) {
    case "finding":
      return `/findings?id=${q}`;
    case "run":
      return `/runs?id=${q}`;
    case "document":
      return `/documents?id=${q}`;
    case "message":
      return `/findings?view=messages&ts=${q}`;
    default:
      return null;
  }
}
