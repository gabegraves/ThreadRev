import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readEvidence } from "./log";
import { buildEvidenceGraph, downstreamOf, revisionNodeId } from "./graph";
import { evidenceGraph, type EvidenceEvent } from "../contracts/evidence";

const SAMPLE = join(import.meta.dirname, "../../../../contracts/examples/evidence-log.jsonl");
const CHANGE_TS = "1787171400.000400";
const OLD = "fnd-a-r2-001";
const NEW = "fnd-a-820-002";

function countBy(graph: ReturnType<typeof buildEvidenceGraph>) {
  const c: Record<string, number> = {};
  for (const n of graph.nodes) c[n.kind] = (c[n.kind] ?? 0) + 1;
  return c;
}

test("sample log builds a graph with deduped nodes per kind", () => {
  const { events } = readEvidence(SAMPLE);
  const graph = buildEvidenceGraph(events);
  assert.ok(evidenceGraph.safeParse(graph).success);
  assert.equal(graph.thread, "1787062320.000100");
  // 4 distinct messages read across two runs (3 of them twice), 1 doc, 2 runs,
  // 2 findings, 3 revisions (two change messages plus the requirements_revision
  // of the second card, which the sample binds to a ts no message carries).
  assert.deepEqual(countBy(graph), { message: 4, document: 1, run: 2, finding: 2, revision: 2 });
  assert.equal(new Set(graph.nodes.map((n) => n.id)).size, graph.nodes.length);
});

test("supersede edge exists and the old finding is stale", () => {
  const { events } = readEvidence(SAMPLE);
  const graph = buildEvidenceGraph(events);
  assert.ok(graph.edges.some((e) => e.kind === "supersedes" && e.from === NEW && e.to === OLD));
  assert.equal(graph.nodes.find((n) => n.id === OLD)?.status, "stale");
  assert.equal(graph.nodes.find((n) => n.id === NEW)?.status, "live");
  assert.deepEqual(
    graph.findings.map((f) => [f.finding_id, f.status]),
    [
      [OLD, "stale"],
      [NEW, "live"],
    ],
  );
});

test("runs get read and checked_with edges, change messages get revisions, silence is counted", () => {
  const { events } = readEvidence(SAMPLE);
  const graph = buildEvidenceGraph(events);
  const run1 = "rc-20260912T151200Z-7f3a";
  const reads = graph.edges.filter((e) => e.kind === "read" && e.to === run1).map((e) => e.from).sort();
  assert.deepEqual(reads, [
    "1787062320.000100",
    "1787064000.000200",
    "1787166300.000300",
    "b63f3e53bb2651e37c05c8d341f9c331e34a6edf516d2b91994dda8128b66c18",
  ]);
  assert.ok(graph.edges.some((e) => e.kind === "checked_with" && e.from === "1787062320.000100" && e.to === run1));
  assert.ok(graph.edges.some((e) => e.kind === "changes" && e.from === CHANGE_TS && e.to === revisionNodeId(CHANGE_TS)));
  assert.ok(!graph.edges.some((e) => e.kind === "changes" && e.from === "1787064000.000200"));
  const silent = graph.nodes.find((n) => n.id === "1787064000.000200");
  assert.equal(silent?.data.silence_count, 1);
  const msg = graph.nodes.find((n) => n.id === "1787062320.000100");
  assert.equal(msg?.label, "Dara Voss: Precharge board r2 review doc is up. Dropped one film cap, b");
  assert.equal(graph.nodes.find((n) => n.kind === "document")?.label, "precharge-review-r2.docx r2");
});

test("downstreamOf the change message reaches the superseding finding and the stale one", () => {
  const { events } = readEvidence(SAMPLE);
  const graph = buildEvidenceGraph(events);
  const down = downstreamOf(graph, CHANGE_TS);
  assert.ok(down.nodes.has(NEW), "superseding finding");
  assert.ok(down.nodes.has(OLD), "stale finding");
  assert.ok(down.nodes.has("rc-20260912T153100Z-b21c"));
  assert.ok(!down.nodes.has("rc-20260912T151200Z-7f3a"), "first run does not depend on the later change");
  assert.ok(down.edges.some((e) => e.kind === "supersedes"));
  const fromDoc = downstreamOf(graph, "b63f3e53bb2651e37c05c8d341f9c331e34a6edf516d2b91994dda8128b66c18");
  assert.ok(fromDoc.nodes.has(OLD) && fromDoc.nodes.has(NEW));
});

test("thread option filters events", () => {
  const { events } = readEvidence(SAMPLE);
  assert.equal(buildEvidenceGraph(events, { thread: "nope" }).nodes.length, 0);
  assert.equal(buildEvidenceGraph(events, { thread: "1787062320.000100" }).nodes.length, buildEvidenceGraph(events).nodes.length);
});

test("publish_refused marks the run refused and links it to the current revision", () => {
  const base = { at: "2026-09-12T15:00:00.000Z", thread: "t1", trigger_ts: "100.1" };
  const events: EvidenceEvent[] = [
    { ...base, event_id: "e1", kind: "message_read", ts: "100.1", from: "A", is_bot: false, text: "doc r1 up", is_change: true },
    {
      ...base,
      event_id: "e2",
      kind: "check_run",
      run_id: "rc-x",
      checker: "rc",
      version: "1",
      inputs: {},
      outputs: {},
      checks: [{ name: "c", pass: true }],
      error: null,
      evidence_refs: [{ kind: "message", id: "100.1" }],
    },
    { ...base, event_id: "e3", kind: "message_read", ts: "100.2", from: "A", is_bot: false, text: "actually r2", is_change: true },
    {
      ...base,
      event_id: "e4",
      kind: "publish_refused",
      run_id: "rc-x",
      bound_revision: "100.1",
      current_revision: "100.2",
      reason: "revision moved",
    },
  ];
  const graph = buildEvidenceGraph(events);
  const run = graph.nodes.find((n) => n.id === "rc-x");
  assert.equal(run?.status, "refused");
  assert.equal(run?.label, "rc rc-x");
  assert.ok(graph.edges.some((e) => e.kind === "refused_by" && e.from === "rc-x" && e.to === revisionNodeId("100.2")));
  assert.ok(downstreamOf(graph, "100.2").nodes.has("rc-x"));
  assert.equal(graph.findings.length, 0);
});

test("a message found in another channel keeps its provenance", () => {
  const graph = buildEvidenceGraph([
    {
      event_id: "e1",
      at: "2026-09-12T16:00:01.000Z",
      thread: "t",
      kind: "message_read",
      ts: "1785946800.000501",
      from: "Dara Voss",
      is_bot: false,
      is_change: true,
      text: "With it the HV bus is 820 uF, not 680.",
      channel: "#ks4-purchasing",
      via: "workspace_search",
    },
    {
      event_id: "e2",
      at: "2026-09-12T16:00:02.000Z",
      thread: "t",
      kind: "message_read",
      ts: "1787062320.000100",
      from: "Dara Voss",
      is_bot: false,
      is_change: false,
      text: "Precharge board r2 review doc is up.",
    },
  ] as EvidenceEvent[]);

  const hit = graph.nodes.find((n) => n.id === "1785946800.000501")!;
  assert.equal(hit.data.channel, "#ks4-purchasing", "the console cannot show provenance it was never given");
  assert.equal(hit.data.via, "workspace_search");
  assert.match(hit.label, /in #ks4-purchasing/);

  // A message from this thread is unchanged: no channel, no via, plain label.
  const local = graph.nodes.find((n) => n.id === "1787062320.000100")!;
  assert.equal(local.data.channel, undefined);
  assert.doesNotMatch(local.label, / in #/);
});
