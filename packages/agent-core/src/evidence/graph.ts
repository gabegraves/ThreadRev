/**
 * Build the evidence graph from an event log.
 *
 * Pure and isomorphic: takes EvidenceEvent[] in, returns EvidenceGraph out.
 * Node identity follows the contract header in contracts/evidence.ts. The
 * revision node id is prefixed `rev:` so it does not collide with the message
 * node that shares the same ts.
 *
 * Edge direction follows the graphEdgeKind comments:
 *   read           message | document → run
 *   checked_with   message | document → run
 *   published_from run → finding
 *   bound_to       finding → revision
 *   supersedes     new finding → old finding
 *   refused_by     run → revision
 *   changes        message → revision
 */
import type { Finding } from "../contracts/finding";
import type { EvidenceEvent, EvidenceGraph, GraphEdge, GraphNode } from "../contracts/evidence";

const LABEL_MAX = 60;

export const revisionNodeId = (ts: string): string => `rev:${ts}`;

function upsert(nodes: Map<string, GraphNode>, node: Omit<GraphNode, "status" | "data"> & Partial<GraphNode>): GraphNode {
  const existing = nodes.get(node.id);
  if (!existing) {
    const created: GraphNode = {
      id: node.id,
      kind: node.kind,
      label: node.label,
      status: node.status ?? "neutral",
      at: node.at,
      data: node.data ?? {},
    };
    nodes.set(node.id, created);
    return created;
  }
  // Later events refine the label and data; the first `at` wins; status is
  // managed explicitly by the caller so a placeholder does not clobber it.
  if (node.label) existing.label = node.label;
  if (node.data) existing.data = { ...existing.data, ...node.data };
  if (!existing.at && node.at) existing.at = node.at;
  return existing;
}

/** Create a node only if it does not exist; never rewrites label or data. */
function placeholder(nodes: Map<string, GraphNode>, node: Omit<GraphNode, "status" | "data"> & Partial<GraphNode>): GraphNode {
  return nodes.get(node.id) ?? upsert(nodes, node);
}

function addEdge(edges: Map<string, GraphEdge>, edge: GraphEdge): void {
  edges.set(`${edge.kind}|${edge.from}|${edge.to}`, edge);
}

const short = (s: string): string => (s.length > LABEL_MAX ? s.slice(0, LABEL_MAX) : s);

export function buildEvidenceGraph(events: EvidenceEvent[], opts: { thread?: string } = {}): EvidenceGraph {
  const scoped = opts.thread ? events.filter((e) => e.thread === opts.thread) : events;
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const findings = new Map<string, Finding>();
  const stale = new Set<string>();

  // Reads grouped by trigger_ts, so a check_run can link to everything the
  // same reviewer run read regardless of event order within the run.
  const readsByTrigger = new Map<string, Set<string>>();
  for (const e of scoped) {
    if ((e.kind === "message_read" || e.kind === "document_read") && e.trigger_ts) {
      const id = e.kind === "message_read" ? e.ts : e.sha256;
      const set = readsByTrigger.get(e.trigger_ts) ?? new Set<string>();
      set.add(id);
      readsByTrigger.set(e.trigger_ts, set);
    }
  }

  const revisionNode = (ts: string, at?: string): GraphNode =>
    upsert(nodes, { id: revisionNodeId(ts), kind: "revision", label: `rev ${ts}`, at, data: { ts } });

  for (const e of scoped) {
    switch (e.kind) {
      case "message_read": {
        // Where a message came from is the interesting part when it came from
        // somewhere else. Dropping channel and via here made a hit pulled out
        // of another channel indistinguishable from one in this thread, which
        // is precisely the provenance the console exists to show.
        const elsewhere = e.via === "workspace_search";
        upsert(nodes, {
          id: e.ts,
          kind: "message",
          label: elsewhere && e.channel
            ? `${e.from} in ${e.channel}: ${short(e.text)}`
            : `${e.from}: ${short(e.text)}`,
          at: e.at,
          data: {
            ts: e.ts,
            from: e.from,
            is_bot: e.is_bot,
            text: e.text,
            is_change: e.is_change,
            ...(e.channel ? { channel: e.channel } : {}),
            ...(e.via ? { via: e.via } : {}),
          },
        });
        if (e.is_change) {
          revisionNode(e.ts, e.at);
          addEdge(edges, { from: e.ts, to: revisionNodeId(e.ts), kind: "changes" });
        }
        break;
      }
      case "document_read": {
        upsert(nodes, {
          id: e.sha256,
          kind: "document",
          label: e.revision ? `${e.document} ${e.revision}` : e.document,
          at: e.at,
          data: {
            document: e.document,
            revision: e.revision,
            sha256: e.sha256,
            line_count: e.line_count,
            named_in_ts: e.named_in_ts,
          },
        });
        break;
      }
      case "check_run": {
        const run = upsert(nodes, {
          id: e.run_id,
          kind: "run",
          label: `${e.checker} ${e.run_id}`,
          at: e.at,
          data: {
            run_id: e.run_id,
            checker: e.checker,
            version: e.version,
            trigger_ts: e.trigger_ts,
            inputs: e.inputs,
            outputs: e.outputs,
            checks: e.checks,
            error: e.error,
            evidence_refs: e.evidence_refs,
          },
        });
        if (e.trigger_ts) {
          for (const id of readsByTrigger.get(e.trigger_ts) ?? []) {
            if (nodes.has(id)) addEdge(edges, { from: id, to: run.id, kind: "read" });
          }
        }
        for (const ref of e.evidence_refs) {
          placeholder(nodes, {
            id: ref.id,
            kind: ref.kind,
            label: ref.kind === "document" ? ref.id.slice(0, 12) : ref.id,
            data: ref.kind === "document" ? { sha256: ref.id } : { ts: ref.id },
          });
          addEdge(edges, { from: ref.id, to: run.id, kind: "checked_with" });
        }
        break;
      }
      case "finding_published": {
        const f = e.finding;
        const isStale = stale.has(f.finding_id) || f.status === "stale";
        const node = upsert(nodes, {
          id: f.finding_id,
          kind: "finding",
          label: short(f.discrepancy),
          at: e.at,
          data: { finding: f, message_ref: e.message_ref },
        });
        node.status = isStale ? "stale" : "live";
        findings.set(f.finding_id, isStale ? { ...f, status: "stale" } : f);

        const run = placeholder(nodes, {
          id: f.checker_run.run_id,
          kind: "run",
          label: `${f.checker_run.checker} ${f.checker_run.run_id}`,
          data: { run_id: f.checker_run.run_id, checker: f.checker_run.checker, version: f.checker_run.version },
        });
        addEdge(edges, { from: run.id, to: node.id, kind: "published_from" });

        revisionNode(f.requirements_revision);
        addEdge(edges, { from: node.id, to: revisionNodeId(f.requirements_revision), kind: "bound_to" });

        if (f.supersedes) {
          placeholder(nodes, { id: f.supersedes, kind: "finding", label: f.supersedes, data: {} });
          addEdge(edges, { from: node.id, to: f.supersedes, kind: "supersedes" });
        }
        break;
      }
      case "finding_superseded": {
        stale.add(e.finding_id);
        const old = placeholder(nodes, { id: e.finding_id, kind: "finding", label: e.finding_id, data: {} });
        old.status = "stale";
        old.data = { ...old.data, superseded_by: e.superseded_by, cause_ts: e.cause_ts };
        const prev = findings.get(e.finding_id);
        if (prev) findings.set(e.finding_id, { ...prev, status: "stale" });
        placeholder(nodes, { id: e.superseded_by, kind: "finding", label: e.superseded_by, data: {} });
        addEdge(edges, { from: e.superseded_by, to: e.finding_id, kind: "supersedes" });
        break;
      }
      case "publish_refused": {
        const run = placeholder(nodes, { id: e.run_id, kind: "run", label: e.run_id, at: e.at, data: {} });
        run.status = "refused";
        run.data = {
          ...run.data,
          refused: { reason: e.reason, bound_revision: e.bound_revision, current_revision: e.current_revision },
        };
        revisionNode(e.current_revision, e.at);
        addEdge(edges, { from: run.id, to: revisionNodeId(e.current_revision), kind: "refused_by" });
        break;
      }
      case "silence":
        // Applied after the loop so the trigger message exists regardless of order.
        break;
      case "followup_filed": {
        // Not a node of its own: a follow-up is something that happened to a
        // finding, and the console reads it off that finding.
        const node = nodes.get(e.finding_id);
        if (node) {
          node.data = {
            ...node.data,
            followup: { filed: e.filed, tool: e.tool, detail: e.detail, at: e.at },
          };
        }
        break;
      }
      case "workspace_search":
        // Hits are message_read events with via: "workspace_search"; nothing extra to draw.
        break;
      case "edit_proposed":
      case "edit_decided":
      case "edit_applied":
        // Shown on the evidence timeline; not part of the finding graph.
        break;
      default: {
        // Exhaustiveness: the graph is what the console draws from, so a new
        // event kind that falls through here is invisible everywhere downstream
        // without an error anywhere. Fail the compile instead.
        const unhandled: never = e;
        void unhandled;
      }
    }
  }

  for (const e of scoped) {
    if (e.kind !== "silence" || !e.trigger_ts) continue;
    const msg = nodes.get(e.trigger_ts);
    if (!msg || msg.kind !== "message") continue;
    const silences = (msg.data.silences as { at: string; reason: string }[] | undefined) ?? [];
    silences.push({ at: e.at, reason: e.reason });
    msg.data = { ...msg.data, silences, silence_count: silences.length };
  }

  return {
    thread: opts.thread ?? scoped[0]?.thread ?? "",
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    findings: [...findings.values()],
    generated_at: new Date().toISOString(),
  };
}

/**
 * Edge kinds whose stored direction runs against the dependency direction.
 * `bound_to` is stored finding → revision but the revision is upstream of the
 * finding; `refused_by` is stored run → revision but the revision caused it.
 */
const REVERSED: ReadonlySet<GraphEdge["kind"]> = new Set(["bound_to", "refused_by"]);

function dependencyEnds(edge: GraphEdge): { upstream: string; downstream: string } {
  return REVERSED.has(edge.kind)
    ? { upstream: edge.to, downstream: edge.from }
    : { upstream: edge.from, downstream: edge.to };
}

/**
 * Everything that depends on `nodeId`, following edges in the direction of
 * dependency: message → revision → findings bound to it → findings they
 * supersede; document → runs → findings. The start node is included so a
 * hover highlight covers the hovered node as well.
 */
export function downstreamOf(graph: EvidenceGraph, nodeId: string): { nodes: Set<string>; edges: GraphEdge[] } {
  const out = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const { upstream } = dependencyEnds(edge);
    const list = out.get(upstream) ?? [];
    list.push(edge);
    out.set(upstream, list);
  }
  const nodes = new Set<string>();
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<GraphEdge>();
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (nodes.has(id)) continue;
    nodes.add(id);
    for (const edge of out.get(id) ?? []) {
      if (!seenEdges.has(edge)) {
        seenEdges.add(edge);
        edges.push(edge);
      }
      queue.push(dependencyEnds(edge).downstream);
    }
  }
  return { nodes, edges };
}
