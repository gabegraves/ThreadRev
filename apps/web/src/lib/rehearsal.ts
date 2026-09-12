import { buildEvidenceGraph, type EvidenceEvent } from "agent-core/shared";

/** Snapshot the first published finding before the later correction is read. */
export function rehearsalSnapshots(events: EvidenceEvent[]) {
  const first = events.findIndex((event) => event.kind === "finding_published");
  const before = events.slice(0, first + 1);
  return {
    before: { events: before, graph: buildEvidenceGraph(before) },
    after: { events, graph: buildEvidenceGraph(events) },
  };
}
