/**
 * The seam between the pet and ThreadRev.
 *
 * The overlay deliberately knows nothing about the reviewer. It polls one
 * endpoint for a list of findings shaped like the `Finding` contract in
 * packages/agent-core/src/contracts/finding.ts. When that endpoint is not
 * running, the panel says so — it never invents findings and passes them off as
 * real. `SAMPLE` exists only for driving the UI during a dry run and is labelled
 * as sample in the panel whenever it is shown.
 *
 * To wire this to the real reviewer, serve the current findings from
 * `PET_ENDPOINT` as `{ findings: Finding[] }`. Nothing else here needs to change.
 */

/** Subset of the Finding contract the panel actually renders. */
export interface PetFinding {
  finding_id: string;
  status: "live" | "stale";
  discrepancy: string;
  why_it_matters: string;
  resolution: string;
  requirements_revision: string;
  sources: Array<{ kind: "document" | "message"; id: string; revision?: string }>;
}

export type Connection =
  | { kind: "connected"; findings: PetFinding[] }
  | { kind: "offline"; reason: string };

export const PET_ENDPOINT = "http://localhost:3000/api/pet/findings";

const POLL_MS = 4000;

export const SAMPLE: PetFinding[] = [
  {
    finding_id: "f-sample-1",
    status: "live",
    discrepancy: "BOM lists a 40 A fuse; the pack draws 52 A peak.",
    why_it_matters: "The fuse opens under normal race load and drops the array.",
    resolution: "Order the 60 A part already quoted in the 12 Aug thread.",
    requirements_revision: "r4",
    sources: [
      { kind: "document", id: "pack-bom.xlsx", revision: "r4" },
      { kind: "message", id: "1723480000.001" },
    ],
  },
  {
    finding_id: "f-sample-2",
    status: "stale",
    discrepancy: "Cell count in the sim input is 18s; the build is 20s.",
    why_it_matters: "Range estimates are low by roughly 11%.",
    resolution: "Superseded by the corrected sim input posted 14 Aug.",
    requirements_revision: "r3",
    sources: [{ kind: "document", id: "sim-inputs.json", revision: "r3" }],
  },
];

/**
 * Poll the endpoint and hand each result to `onUpdate`. Returns a stop function.
 * A failed fetch is an expected state, not an error: the reviewer simply is not
 * running yet.
 */
export function watchFindings(onUpdate: (state: Connection) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    try {
      const res = await fetch(PET_ENDPOINT, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { findings?: PetFinding[] };
      if (!stopped) onUpdate({ kind: "connected", findings: body.findings ?? [] });
    } catch (err) {
      if (!stopped) {
        onUpdate({ kind: "offline", reason: err instanceof Error ? err.message : "unreachable" });
      }
    }
    if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
  };

  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
