import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyFilter,
  arrivalReaction,
  arrivals,
  clampOrigin,
  DRAG_THRESHOLD_PX,
  cleanFeed,
  cleanFinding,
  ACTIVE_WINDOW_MS,
  feedFromEvidence,
  fitSweep,
  formatValue,
  isDrag,
  rectContains,
  shouldCapture,
  STARTLE_COOLDOWN_MS,
  unreadCount,
} from "./logic.js";

const rect = (l: number, t: number, r: number, b: number) => ({
  left: l,
  top: t,
  right: r,
  bottom: b,
});

const PET = rect(240, 420, 400, 610);
const PANEL = rect(20, 60, 380, 400);
const away = { x: 120, y: 500 }; // inside the window box, over neither element

test("rectContains includes the edges", () => {
  assert.equal(rectContains(PET, 240, 420), true);
  assert.equal(rectContains(PET, 400, 610), true);
  assert.equal(rectContains(PET, 239, 420), false);
});

test("the overlay captures the mouse over Rev", () => {
  assert.equal(shouldCapture([PET], 300, 500), true);
});

test("the overlay stays click-through over its own empty space", () => {
  // This is the one that matters: the window is far larger than Rev, and a
  // false here is what keeps the corner of the app underneath usable.
  assert.equal(shouldCapture([PET], away.x, away.y), false);
});

test("the panel only captures while it is published, i.e. while open", () => {
  // Closed: the renderer publishes Rev alone.
  assert.equal(shouldCapture([PET], 200, 200), false);
  // Open: it publishes the panel too.
  assert.equal(shouldCapture([PET, PANEL], 200, 200), true);
});

test("a drag keeps capturing after the cursor outruns the sprite", () => {
  assert.equal(shouldCapture([PET], -900, -900, true), true);
});

const WIN = { width: 412, height: 620 };
const WORK = { x: 0, y: 0, width: 1536, height: 816 };

test("clampOrigin leaves a grabbable sliver at each edge", () => {
  assert.deepEqual(clampOrigin(-5000, -5000, WIN, WORK), { x: -292, y: -500 });
  assert.deepEqual(clampOrigin(9000, 9000, WIN, WORK), { x: 1416, y: 696 });
});

test("clampOrigin leaves an on-screen position alone", () => {
  assert.deepEqual(clampOrigin(1100, 200, WIN, WORK), { x: 1100, y: 200 });
});

test("clampOrigin rescues a position saved on a display that is now gone", () => {
  // Saved while a second monitor sat to the left at x = -1920.
  const restored = clampOrigin(-1800, 300, WIN, WORK);
  assert.ok(restored.x + WIN.width >= WORK.x + 120, "at least a sliver is reachable");
});

test("formatValue keeps integers clean and small fractions intact", () => {
  assert.equal(formatValue(7), "7");
  assert.equal(formatValue(2.435), "2.4350");
  assert.equal(formatValue(2.6622), "2.6622");
  // The charge fraction: rounding this to 2dp would erase the finding.
  assert.equal(formatValue(0.99848), "0.99848");
});

const FINDINGS = [
  { finding_id: "a", status: "live" as const },
  { finding_id: "b", status: "stale" as const },
  { finding_id: "c", status: "live" as const },
];

test("applyFilter splits live from stale", () => {
  assert.deepEqual(applyFilter(FINDINGS, "live").map((f) => f.finding_id), ["a", "c"]);
  assert.deepEqual(applyFilter(FINDINGS, "stale").map((f) => f.finding_id), ["b"]);
  assert.equal(applyFilter(FINDINGS, "all").length, 3);
});

test("unreadCount ignores stale cards and anything already seen", () => {
  assert.equal(unreadCount(FINDINGS, new Set()), 2);
  assert.equal(unreadCount(FINDINGS, new Set(["a"])), 1);
  // A superseded card is not news; badging it would train the user to ignore
  // the badge.
  assert.equal(unreadCount(FINDINGS, new Set(["a", "c"])), 0);
});

/* ----------------------------------------------------------- feed input --- */

const GOOD = {
  finding_id: "f1",
  status: "live",
  discrepancy: "Section 3 says 680 uF.",
  why_it_matters: "The relay closes early.",
  resolution: "Confirm the bus.",
  requirements_revision: "r2",
  sources: [{ kind: "document", id: "doc.docx", revision: "r2" }],
  reproduced: [{ label: "t", printed: 2.435, computed: 2.2077, unit: "s", matches: false }],
};

test("cleanFeed accepts a well-formed response", () => {
  const feed = cleanFeed({ findings: [GOOD], phase: "checking", revision: "r2" });
  assert.equal(feed.findings.length, 1);
  assert.equal(feed.phase, "checking");
  assert.equal(feed.revision, "r2");
  assert.equal(feed.findings[0].reproduced[0].computed, 2.2077);
});

test("cleanFeed survives junk instead of a response", () => {
  // An error page, a half-written file, or an older reviewer all land here.
  for (const junk of [null, undefined, 42, "nope", [], { findings: "no" }]) {
    assert.deepEqual(cleanFeed(junk).findings, []);
  }
});

test("cleanFeed keeps the good findings and drops only the broken one", () => {
  // The point of coercing rather than throwing: nine good findings still show.
  const feed = cleanFeed({
    findings: [GOOD, { status: "live" }, null, { ...GOOD, finding_id: "f2" }],
  });
  assert.deepEqual(feed.findings.map((f) => f.finding_id), ["f1", "f2"]);
});

test("a finding missing reproduced or sources still renders", () => {
  // This is what used to throw inside the render loop and blank the panel.
  const f = cleanFinding({ finding_id: "x", discrepancy: "d" });
  assert.ok(f);
  assert.deepEqual(f.reproduced, []);
  assert.deepEqual(f.sources, []);
  assert.deepEqual(f.inferred, []);
  assert.equal(f.status, "live");
  assert.equal(f.requirements_revision, "—");
});

test("an unknown status is treated as live, never dropped", () => {
  // Silently hiding a finding is worse than showing it under the wrong tab.
  assert.equal(cleanFinding({ ...GOOD, status: "banana" })?.status, "live");
});

test("rows without a computed value are dropped", () => {
  // The table exists to put a recomputed number beside the printed one.
  const f = cleanFinding({
    ...GOOD,
    reproduced: [{ label: "a", printed: 1 }, { label: "b", computed: 2, unit: "s" }],
  });
  assert.deepEqual(f?.reproduced.map((r) => r.label), ["b"]);
});

test("non-finite numbers are rejected rather than formatted into nonsense", () => {
  const f = cleanFinding({
    ...GOOD,
    reproduced: [
      { label: "inf", computed: Infinity, unit: "s" },
      { label: "nan", computed: 0, printed: NaN, unit: "s" },
    ],
  });
  assert.deepEqual(f?.reproduced.map((r) => r.label), ["nan"]);
  assert.equal(f?.reproduced[0].printed, undefined);
});

test("oversized text is truncated instead of wedging the panel", () => {
  const f = cleanFinding({ ...GOOD, discrepancy: "x".repeat(50_000) });
  assert.ok(f);
  assert.ok(f.discrepancy.length <= 2000);
  assert.ok(f.discrepancy.endsWith("…"));
});

test("a flood of findings is capped", () => {
  const many = Array.from({ length: 5000 }, (_, i) => ({ ...GOOD, finding_id: `f${i}` }));
  assert.equal(cleanFeed({ findings: many }).findings.length, 100);
});

test("duplicate ids are collapsed so the badge cannot lie", () => {
  const feed = cleanFeed({ findings: [GOOD, { ...GOOD, discrepancy: "other" }] });
  assert.equal(feed.findings.length, 1);
});

test("an unknown phase is ignored rather than pinning a bogus state", () => {
  assert.equal(cleanFeed({ findings: [], phase: "hacking" }).phase, undefined);
});

/* ----------------------------------------------------------------- drag --- */

test("isDrag ignores the tremor of pressing the button", () => {
  // The whole reason the pet would not open: `moved` used to flip on the first
  // mousemove, and pressing a mouse button moves it a pixel or two.
  assert.equal(isDrag(100, 100, 100, 100), false);
  assert.equal(isDrag(100, 100, 102, 101), false);
  assert.equal(isDrag(100, 100, 103, 0 + 100), false);
});

test("isDrag fires once past the threshold, in any direction", () => {
  assert.equal(isDrag(100, 100, 105, 100), true);
  assert.equal(isDrag(100, 100, 100, 105), true);
  assert.equal(isDrag(100, 100, 95, 95), true);
  assert.equal(isDrag(100, 100, 100 - 5, 100), true);
});

test("isDrag is exclusive at exactly the threshold", () => {
  // Exactly DRAG_THRESHOLD_PX away is still a click; a hair beyond is a drag.
  assert.equal(isDrag(0, 0, DRAG_THRESHOLD_PX, 0), false);
  assert.equal(isDrag(0, 0, DRAG_THRESHOLD_PX + 0.01, 0), true);
  // Diagonals use real distance, not per-axis: a 3-4-5 triangle is 5 away.
  assert.equal(isDrag(0, 0, 3, 4), true);
  assert.equal(isDrag(0, 0, 2, 2), false);
});

/* ------------------------------------------------- field-level coercion --- */

test("a source without an id is dropped, not rendered blank", () => {
  const f = cleanFinding({
    ...GOOD,
    sources: [{ kind: "document" }, { kind: "message", id: "123.45" }, "nope", null],
  });
  assert.deepEqual(f?.sources.map((s) => s.id), ["123.45"]);
});

test("an unknown source kind falls back to document", () => {
  const f = cleanFinding({ ...GOOD, sources: [{ kind: "wat", id: "x" }] });
  assert.equal(f?.sources[0].kind, "document");
});

test("a question needs both a person and an ask", () => {
  assert.equal(cleanFinding({ ...GOOD, question: { to: "Dara" } })?.question, undefined);
  assert.equal(cleanFinding({ ...GOOD, question: { ask: "which bus?" } })?.question, undefined);
  assert.equal(cleanFinding({ ...GOOD, question: { to: " ", ask: "x" } })?.question, undefined);
  assert.deepEqual(cleanFinding({ ...GOOD, question: { to: "Dara", ask: "which?" } })?.question, {
    to: "Dara",
    ask: "which?",
  });
});

test("whitespace-only strings are treated as absent", () => {
  assert.equal(cleanFinding({ finding_id: "x", discrepancy: "   " }), null);
  assert.equal(cleanFinding({ ...GOOD, why_it_matters: "  \n " })?.why_it_matters, "");
});

test("inferred entries survive as strings and junk is dropped", () => {
  const f = cleanFinding({ ...GOOD, inferred: ["a real note", 7, null, "  "] });
  assert.deepEqual(f?.inferred, ["a real note"]);
});

test("a unit is optional and never becomes the string undefined", () => {
  const f = cleanFinding({ ...GOOD, reproduced: [{ label: "x", computed: 1.5 }] });
  assert.equal(f?.reproduced[0].unit, "");
});

test("matches is only carried when it is a real boolean", () => {
  const f = cleanFinding({
    ...GOOD,
    reproduced: [
      { label: "a", computed: 1, matches: "yes" },
      { label: "b", computed: 1, matches: false },
    ],
  });
  assert.equal(f?.reproduced[0].matches, undefined);
  assert.equal(f?.reproduced[1].matches, false);
});

/* --------------------------------------------------------------- radial --- */

const WIN_BOX = { width: 412, height: 620 };
const R = 132;
const PAD = 26;
const N = 5;

/** Every item centre for a chosen sweep, so a test can check them directly. */
function itemCentres(c: { x: number; y: number }, sweep: { from: number; step: number }) {
  return Array.from({ length: N }, (_, i) => {
    const a = ((sweep.from + sweep.step * i) * Math.PI) / 180;
    return { x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) };
  });
}

const inside = (p: { x: number; y: number }) =>
  p.x - PAD >= 0 && p.x + PAD <= WIN_BOX.width && p.y - PAD >= 0 && p.y + PAD <= WIN_BOX.height;

test("in open space the menu opens to a full semicircle", () => {
  const centre = { x: 206, y: 310 };
  const sweep = fitSweep(centre, R, N, WIN_BOX, PAD);
  assert.equal(sweep.step * (N - 1), 180);
  assert.ok(itemCentres(centre, sweep).every(inside));
});

test("in the corner it narrows instead of running off the edge", () => {
  // Where Rev actually sits by default.
  const centre = { x: 344, y: 542 };
  const sweep = fitSweep(centre, R, N, WIN_BOX, PAD);
  const span = sweep.step * (N - 1);
  assert.ok(span < 180, `expected a narrowed sweep, got ${span}`);
  assert.ok(span >= 90, `expected it to stay usable, got ${span}`);
  // The point of narrowing: everything still fits.
  assert.ok(itemCentres(centre, sweep).every(inside));
});

test("every item fits from anywhere the window allows", () => {
  // Sweeping the whole window catches a sweep choice that fits at one corner
  // and not another — the failure mode that made items disappear off-screen.
  for (let x = PAD; x <= WIN_BOX.width - PAD; x += 23) {
    for (let y = PAD; y <= WIN_BOX.height - PAD; y += 23) {
      const centre = { x, y };
      const sweep = fitSweep(centre, R, N, WIN_BOX, PAD);
      const centres = itemCentres(centre, sweep);
      // Near an edge no sweep can fit; the fallback is deliberately clipped
      // rather than absent, so only assert where a fit was actually possible.
      const anyFits = [180, 160, 140, 120, 110, 100, 90].some((span) =>
        itemCentres(centre, { from: -135 - span / 2, step: span / (N - 1) }).every(inside),
      );
      if (anyFits) {
        assert.ok(
          centres.every(inside),
          `items escaped the window at ${x},${y} with span ${sweep.step * (N - 1)}`,
        );
      }
    }
  }
});

test("the sweep is always one of the offered widths", () => {
  const sweep = fitSweep({ x: 344, y: 542 }, R, N, WIN_BOX, PAD);
  assert.ok([180, 160, 140, 120, 110, 100, 90].includes(sweep.step * (N - 1)));
});

test("a single item needs no sweep at all", () => {
  assert.equal(fitSweep({ x: 100, y: 100 }, R, 1, WIN_BOX, PAD).step, 0);
});

/* -------------------------------------------------------------- arrival --- */

const ids = (items: ReadonlyArray<{ finding_id: string }>) => items.map((f) => f.finding_id);

test("an arrival is a live finding Rev has not reacted to yet", () => {
  assert.deepEqual(ids(arrivals(FINDINGS, new Set())), ["a", "c"]);
  assert.deepEqual(ids(arrivals(FINDINGS, new Set(["a"]))), ["c"]);
});

test("a superseded card never arrives", () => {
  assert.deepEqual(ids(arrivals([{ finding_id: "b", status: "stale" as const }], new Set())), []);
});

test("a reviewer serving the same findings again is not news", () => {
  // The poll returns every finding every 3s, and a restarted reviewer serves
  // them all again. Only ids Rev has never reacted to count.
  assert.deepEqual(ids(arrivals(FINDINGS, new Set(["a", "c"]))), []);
});

const calm = { now: 100_000, lastStartleAt: null, engaged: false };

test("the first arrival startles", () => {
  assert.equal(arrivalReaction(calm), "startle");
});

test("a batch landing across polls startles once, then only nudges", () => {
  const last = 100_000;
  assert.equal(arrivalReaction({ ...calm, lastStartleAt: last, now: last + 3_000 }), "nudge");
  assert.equal(
    arrivalReaction({ ...calm, lastStartleAt: last, now: last + STARTLE_COOLDOWN_MS - 1 }),
    "nudge",
  );
  assert.equal(
    arrivalReaction({ ...calm, lastStartleAt: last, now: last + STARTLE_COOLDOWN_MS }),
    "startle",
  );
});

test("with the menu or the panel open Rev holds still and only nudges", () => {
  assert.equal(arrivalReaction({ ...calm, engaged: true }), "nudge");
});

test("a clock that ran backwards does not silence Rev", () => {
  // Without this, a clock stepped back an hour would suppress every startle
  // for that hour.
  assert.equal(arrivalReaction({ ...calm, lastStartleAt: 500_000, now: 100_000 }), "startle");
});

/* ------------------------------------------------------- evidence feed --- */

const NOW = Date.parse("2026-09-12T19:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

test("feedFromEvidence reads findings out of the graph", () => {
  const feed = feedFromEvidence({ graph: { findings: [GOOD] }, sample: false, events: [] }, NOW);
  assert.equal(feed.findings.length, 1);
  assert.equal(feed.findings[0].finding_id, "f1");
  assert.equal(feed.sample, false);
  assert.equal(feed.revision, "r2");
});

test("the web console's sample fallback stays marked as sample", () => {
  // Presenting the Scenario A example as live reviewer output would be the
  // status display lying.
  const feed = feedFromEvidence({ graph: { findings: [GOOD] }, sample: true, events: [] }, NOW);
  assert.equal(feed.sample, true);
});

test("recent reviewer activity becomes Rev's phase", () => {
  const phaseOf = (kind: string, msAgo: number) =>
    feedFromEvidence({ graph: { findings: [] }, sample: false, events: [{ kind, at: iso(msAgo) }] }, NOW).phase;
  assert.equal(phaseOf("check_run", 2000), "checking");
  assert.equal(phaseOf("workspace_search", 2000), "searching");
  assert.equal(phaseOf("message_read", 2000), "reading");
  assert.equal(phaseOf("document_read", 2000), "reading");
});

test("old activity does not keep Rev looking busy", () => {
  const feed = feedFromEvidence(
    { graph: { findings: [] }, sample: false, events: [{ kind: "check_run", at: iso(ACTIVE_WINDOW_MS + 1) }] },
    NOW,
  );
  assert.equal(feed.phase, undefined);
});

test("the newest event decides the phase, whatever order they arrive in", () => {
  const feed = feedFromEvidence(
    {
      graph: { findings: [] },
      sample: false,
      events: [
        { kind: "message_read", at: iso(1000) },
        { kind: "check_run", at: iso(9000) },
      ],
    },
    NOW,
  );
  assert.equal(feed.phase, "reading");
});

test("sample events never set a phase", () => {
  const feed = feedFromEvidence(
    { graph: { findings: [] }, sample: true, events: [{ kind: "check_run", at: iso(1000) }] },
    NOW,
  );
  assert.equal(feed.phase, undefined);
});

test("a malformed or hostile response degrades to nothing, never a throw", () => {
  for (const junk of [null, 7, "x", [], { graph: "no" }, { graph: { findings: "no" } }, { events: [{ at: "not a date", kind: 1 }] }]) {
    const feed = feedFromEvidence(junk, NOW);
    assert.deepEqual(feed.findings, []);
  }
});

test("a stale-only feed has no bound revision to show", () => {
  const feed = feedFromEvidence({ graph: { findings: [{ ...GOOD, status: "stale" }] }, sample: false, events: [] }, NOW);
  assert.equal(feed.revision, undefined);
});
