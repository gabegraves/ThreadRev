/**
 * One deep link per entity. Node ids in the evidence graph ARE the entity ids
 * (contracts/evidence.ts: message = ts, document = sha256, run = run_id,
 * finding = finding_id), so `graph(id)` needs no lookup table.
 */
export const hrefs = {
  thread: (ts: string) => `/thread?ts=${encodeURIComponent(ts)}`,
  document: (sha: string) => `/documents?id=${encodeURIComponent(sha)}`,
  run: (runId: string) => `/runs?id=${encodeURIComponent(runId)}`,
  finding: (findingId: string) => `/findings?id=${encodeURIComponent(findingId)}`,
  graph: (nodeId: string) => `/graph?node=${encodeURIComponent(nodeId)}`,
};

/** Civic's inline link register for mono ids. */
export const LINK_CLASS = "text-accent-text underline-offset-2 hover:underline";
