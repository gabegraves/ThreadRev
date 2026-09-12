/**
 * The seam between Rev and ThreadRev.
 *
 * The overlay knows nothing about the reviewer beyond this file. It polls one
 * endpoint for findings shaped like the `Finding` contract in
 * packages/agent-core/src/contracts/finding.ts, plus an optional `state` the
 * reviewer can push so Rev's aperture tracks what the agent is actually doing
 * (reading the thread, searching the workspace, running a checker).
 *
 * When the endpoint is not serving, the panel says so and shows the sample set
 * labelled as sample. It never passes invented findings off as real output.
 */

import { cleanFeed, type CleanFeed, type CleanFinding } from "../logic.js";

export type Reproduced = CleanFinding["reproduced"][number];
export type Source = CleanFinding["sources"][number];
export type PetFinding = CleanFinding;
export type Feed = CleanFeed;

export type Connection =
  | { kind: "connected"; feed: Feed }
  | { kind: "offline"; reason: string };

/** Where apps/web serves. The menu opens its pages; the poll hits its API. */
export const WEB_ORIGIN = "http://localhost:3000";

/**
 * The review console the menu opens: the deployed build, on its evidence graph.
 *
 * A fixed deployment rather than WEB_ORIGIN, because the local origin only
 * answers while someone is running `npm run dev:web`. The console should open
 * from anyone's desktop, and it always has a graph to show.
 */
export const REVIEW_CONSOLE_URL = "https://threadrev-web.vercel.app/graph";

export const PET_ENDPOINT = `${WEB_ORIGIN}/api/pet/findings`;

const POLL_MS = 3000;
/** Shorter than the poll, so a stalled request cannot outlive its own interval. */
const REQUEST_TIMEOUT_MS = 2500;

/**
 * Sample content, used only when the reviewer is unreachable. Drawn from the
 * Scenario A cross-channel case so the shape is honest even though the run is
 * not live.
 */
const SAMPLE_RAW: unknown[] = [
  {
    finding_id: "fnd-sample-cross",
    status: "live",
    discrepancy:
      "Section 3 states 680 uF and the section 2 diagram states 750 uF, but neither is the current bus: a 140 uF snubber bank puts it at 820 uF.",
    why_it_matters:
      "At 820 uF the relay closes at 2.5 s with the bus at 99.85 percent, short of the 99.9 percent criterion. The review cannot be signed against r2's stated basis.",
    resolution:
      "Dara confirms whether the 820 uF bus is what r2 should describe, and updates the diagram, section 3 and section 4.",
    requirements_revision: "r2",
    sources: [
      { kind: "document", id: "precharge-review-r2.docx", revision: "r2", locator: "line 8", sha256: "bef5a5dc" },
      { kind: "message", id: "1785946800.000501", locator: "#ks4-purchasing" },
      { kind: "message", id: "1787062320.000100", locator: "#ks4-electrical" },
    ],
    reproduced: [
      { label: "t_99.9 at 680 uF (text)", printed: 2.435, computed: 2.2077, unit: "s", matches: false },
      { label: "t_99.9 at 750 uF (diagram)", printed: 2.435, computed: 2.435, unit: "s", matches: true },
      { label: "t_99.9 at 820 uF (purchasing)", printed: 2.435, computed: 2.6622, unit: "s", matches: false },
      { label: "charge fraction at relay close", computed: 0.99848, unit: "" },
    ],
    inferred: [
      "That the snubber bank is on the precharged bus is read from Dara's purchasing message, not from a schematic.",
    ],
    question: {
      to: "Dara Voss",
      ask: "Is the bus 820 uF with the snubber bank from PO-2261, or 680 uF as r2 states?",
    },
  },
  {
    finding_id: "fnd-sample-stale",
    status: "stale",
    discrepancy: "Section 4 prints 6.91 s for the 2 mF example; recomputed 6.4933 s.",
    why_it_matters: "The worked example does not reproduce, so the method cannot be checked against it.",
    resolution: "Superseded: r2 line 11 was corrected after this card was published.",
    supersedes_reason: "A later revision changed the capacitance this card was computed against.",
    requirements_revision: "r1",
    sources: [{ kind: "document", id: "precharge-review-r2.docx", revision: "r1", locator: "line 22" }],
    reproduced: [{ label: "t_99.9 at 2 mF example", printed: 6.91, computed: 6.4933, unit: "s", matches: false }],
  },
];

/**
 * The sample goes through the same validator as a live response, so it cannot
 * drift from the shape the panel actually renders.
 */
export const SAMPLE: PetFinding[] = cleanFeed({ findings: SAMPLE_RAW }).findings;

/** Poll the reviewer. Returns a stop function. */
export function watchFindings(onUpdate: (state: Connection) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    try {
      // Without a deadline a half-open socket parks the await forever and the
            // poll chain stops: Rev freezes on its last state and never recovers.
      const res = await fetch(PET_ENDPOINT, {
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Coerced, never trusted: see cleanFeed. A malformed payload degrades to
      // fewer findings, never to a blank panel.
      const feed = cleanFeed(await res.json());
      if (!stopped) onUpdate({ kind: "connected", feed });
    } catch (err) {
      // Not an error state: the reviewer simply is not running yet.
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
