/**
 * Evidence graph for the review console.
 *
 * Reads the live evidence log; when it is empty, falls back to the Scenario A
 * sample in contracts/examples so the console has something to render.
 * `events` are returned alongside the graph so the UI can draw a trace
 * timeline without a second request. `?thread=` filters both.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildEvidenceGraph, readEvidence } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_REL = "contracts/examples/evidence-log.jsonl";

/** Walk up from cwd to the workspace root (the directory holding the sample). */
function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, SAMPLE_REL))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export async function GET(request: Request) {
  const thread = new URL(request.url).searchParams.get("thread")?.trim() || undefined;
  const root = repoRoot();
  const livePath = process.env.EVIDENCE_LOG ? resolve(process.env.EVIDENCE_LOG) : resolve(root, "evidence", "log.jsonl");

  let { events, skipped } = readEvidence(livePath);
  let sample = false;
  if (events.length === 0) {
    ({ events, skipped } = readEvidence(resolve(root, SAMPLE_REL)));
    sample = true;
  }
  if (thread) events = events.filter((e) => e.thread === thread);

  const graph = buildEvidenceGraph(events, thread ? { thread } : {});
  return Response.json({ graph, sample, skipped, events });
}
