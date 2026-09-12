/**
 * Findings feed for the desktop overlay (apps/pet).
 *
 * Same evidence source as /api/evidence, reduced to what the overlay renders:
 * `{ findings, revision, phase, sample }`. `revision` is the requirements
 * revision of the newest live finding so the overlay's tab shows what the
 * cards are bound to. `sample` is true when the live log is empty and the
 * Scenario A example is served instead; the overlay labels that case.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildEvidenceGraph, readEvidence } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_REL = "contracts/examples/evidence-log.jsonl";

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

  let { events } = readEvidence(livePath);
  let sample = false;
  if (events.length === 0) {
    ({ events } = readEvidence(resolve(root, SAMPLE_REL)));
    sample = true;
  }
  if (thread) events = events.filter((e) => e.thread === thread);

  const graph = buildEvidenceGraph(events, thread ? { thread } : {});
  // Newest first so the overlay's first card is the one that needs a decision.
  const findings = [...graph.findings].reverse();
  const live = findings.find((f) => f.status === "live");
  return Response.json(
    { findings, revision: live?.requirements_revision, phase: "idle", sample },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } },
  );
}
