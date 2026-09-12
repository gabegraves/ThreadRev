import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { buildIndex, extractQuantities, loadWorkspaceExport, queryIndex } from "./workspace";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const index = buildIndex(loadWorkspaceExport(resolve(REPO_ROOT, "fixtures/workspace/kestrel-workspace.json")));
const TRIGGER = "1787166300.000600"; // Juno, 2026-08-19 14:05
const PURCHASING_CORRECTION = "1785946800.000501"; // Dara, #ks4-purchasing, 2026-08-05 11:20

test("quantities are extracted with normalized units and leading context", () => {
  const q = extractQuantities("Changed the precharge relay timer from 2.0 s to 2.5 s. Bus is 820 µF, not 680.");
  assert.deepEqual(q.map((x) => [x.value, x.unit]), [[2, "s"], [2.5, "s"], [820, "uF"]]);
  assert.equal(q[0]!.context, "precharge relay timer from");
  // "r2" and dates are not quantities.
  assert.deepEqual(extractQuantities("r2 doc posted 2026-08-18, PO-2261"), []);
});

test("the index spans every channel and knows the documents", () => {
  assert.deepEqual([...index.channels.values()].sort(), ["ks4-electrical", "ks4-firmware", "ks4-purchasing", "ks4-strategy-sim", "ks4-suspension"]);
  assert.ok(index.byDocument.has("precharge-review-r2.docx"));
  assert.ok(index.byDocument.has("ks4-sim-inputs-v2-1.xlsx"));
  assert.ok((index.byUnit.get("uF")?.length ?? 0) >= 6);
});

test("search by unit finds the correction in another channel, up to the cutoff, oldest first", () => {
  const r = queryIndex(index, { unit: "uF", before_ts: TRIGGER });
  const ts = r.hits.map((h) => h.ts);
  assert.ok(ts.includes(PURCHASING_CORRECTION), JSON.stringify(ts));
  assert.deepEqual(ts, [...ts].sort((a, b) => Number(a) - Number(b)));
  // Nothing after the trigger leaks in.
  assert.ok(ts.every((t) => Number(t) <= Number(TRIGGER)));
  assert.doesNotMatch(JSON.stringify(r.hits), /r3 will state 820|delivered/);
  const hit = r.hits.find((h) => h.ts === PURCHASING_CORRECTION)!;
  assert.equal(hit.channel, "#ks4-purchasing");
  assert.equal(hit.from, "Dara Voss");
  assert.equal(hit.is_change, true);
  assert.deepEqual(hit.values, [{ value: 140, unit: "uF" }, { value: 820, unit: "uF" }]);
  // The latest change to a uF value before the trigger is the r2 seed itself ("is now 680 uF").
  assert.equal(r.latest_change_ts, "1787062320.000100");
});

test("quantity words and changes_only narrow without ranking", () => {
  const r = queryIndex(index, { quantity: "bus capacitance", unit: "uF", before_ts: TRIGGER, changes_only: true });
  assert.ok(r.hits.some((h) => h.ts === PURCHASING_CORRECTION));
  assert.ok(r.hits.every((h) => h.is_change));
  assert.equal(r.truncated, false);
  const timer = queryIndex(index, { quantity: "relay timer", unit: "s", before_ts: TRIGGER });
  assert.ok(timer.hits.some((h) => /from 2\.0 s to 2\.5 s/.test(h.text)));
  assert.equal(timer.hits.find((h) => /from 2\.0 s to 2\.5 s/.test(h.text))!.channel, "#ks4-firmware");
});

test("search by document name and by author", () => {
  const doc = queryIndex(index, { document: "documents/precharge-review-r2.docx", before_ts: TRIGGER });
  assert.deepEqual(doc.hits.map((h) => h.ts), ["1787062320.000100"]);
  const rowan = queryIndex(index, { from: "Rowan Pike", keyword: "PO-2261", before_ts: TRIGGER });
  assert.equal(rowan.hits.length, 1);
  assert.equal(rowan.hits[0]!.channel, "#ks4-purchasing");
});
