import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIOS } from "./demo/scenarios";
import { rehearsalSnapshots } from "./rehearsal";

test("rehearsal keeps the first card current before the correction, and stale after", () => {
  const events = SCENARIOS.find((scenario) => scenario.id === "scenario-a")!.events;
  const original = JSON.stringify(events);
  const { before, after } = rehearsalSnapshots(events);
  assert.equal(before.graph.findings.length, 1);
  assert.equal(before.graph.findings[0].status, "live");
  assert.equal(before.events.some((event) => event.kind === "message_read" && event.text.includes("820")), false);
  assert.equal(after.graph.findings.find((finding) => finding.finding_id === before.graph.findings[0].finding_id)?.status, "stale");
  assert.equal(after.graph.findings.filter((finding) => finding.status === "live").length, 1);
  assert.equal(JSON.stringify(events), original);
  assert.deepEqual(rehearsalSnapshots([]).before.events, []);
});
