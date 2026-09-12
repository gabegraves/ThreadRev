import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyFilter,
  clampOrigin,
  formatValue,
  rectContains,
  shouldCapture,
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
  assert.equal(
    shouldCapture({ x: 300, y: 500, pet: PET, panel: PANEL, open: false, dragging: false }),
    true,
  );
});

test("the overlay stays click-through over its own empty space", () => {
  // This is the one that matters: the window is far larger than Rev, and a
  // false here is what keeps the corner of the app underneath usable.
  assert.equal(
    shouldCapture({ ...away, pet: PET, panel: PANEL, open: false, dragging: false }),
    false,
  );
});

test("the panel only captures while it is open", () => {
  const over = { x: 200, y: 200 };
  assert.equal(
    shouldCapture({ ...over, pet: PET, panel: PANEL, open: false, dragging: false }),
    false,
  );
  assert.equal(
    shouldCapture({ ...over, pet: PET, panel: PANEL, open: true, dragging: false }),
    true,
  );
});

test("a drag keeps capturing after the cursor outruns the sprite", () => {
  assert.equal(
    shouldCapture({ x: -900, y: -900, pet: PET, panel: PANEL, open: false, dragging: true }),
    true,
  );
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
