import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkerRequest, checkerResponse, finding } from "./finding";

const examples = join(import.meta.dirname, "../../../../contracts/examples");
const load = (name: string) =>
  JSON.parse(readFileSync(join(examples, name), "utf8")) as unknown;

test("scenario A finding parses and carries a question", () => {
  const f = finding.parse(load("finding-scenario-a.json"));
  assert.equal(f.status, "live");
  assert.ok(f.question);
  assert.equal(f.reproduced.filter((r) => r.matches === false).length, 2);
});

test("superseding finding names the card it replaces", () => {
  const f = finding.parse(load("finding-scenario-a-superseding.json"));
  assert.equal(f.supersedes, "fnd-a-r2-001");
  assert.notEqual(f.requirements_revision, "1787062320.000100");
});

test("clean control is a valid finding with discrepancy none", () => {
  const f = finding.parse(load("finding-rc1-clean.json"));
  assert.equal(f.discrepancy, "none");
  assert.ok(f.reproduced.every((r) => r.matches === true));
});

test("checker request and response examples agree with the schemas", () => {
  const req = checkerRequest.parse(load("checker-rc-request.json"));
  const res = checkerResponse.parse(load("checker-rc-response.json"));
  assert.equal(req.checker, res.checker);
  assert.deepEqual(res.inputs, req.inputs);
  assert.equal(res.error, null);
  const byName = Object.fromEntries(res.checks.map((c) => [c.name, c.pass]));
  assert.equal(byName["printed_2.435_matches_750uF_diagram"], true);
  assert.equal(byName["printed_2.435_matches_680uF_text"], false);
  assert.equal(byName["820uF_change_reaches_threshold_by_timer"], false);
});

test("route checker examples agree with the schemas and carry both RC2 masses", () => {
  const req = checkerRequest.parse(load("checker-route-request.json"));
  const res = checkerResponse.parse(load("checker-route-response.json"));
  assert.equal(req.checker, "route");
  assert.deepEqual(res.inputs, req.inputs);
  assert.equal(res.error, null);
  const byName = Object.fromEntries(res.checks.map((c) => [c.name, c.pass]));
  assert.equal(byName["mass_318kg_feasible"], false);
  assert.equal(byName["mass_310kg_feasible"], false);
});

test("scenario B finding flips feasibility between input versions and asks Juno", () => {
  const f = finding.parse(load("finding-scenario-b.json"));
  assert.equal(f.status, "live");
  assert.equal(f.requirements_revision, "1786472100.000800");
  assert.equal(f.question?.to, "Juno Marsh");
  assert.ok(f.sources.some((s) => s.kind === "document" && s.revision === "v2-1"));
  assert.ok(f.sources.some((s) => s.kind === "document" && s.revision === "v2-0"));
});

test("scenario B stale card keeps its id and run id and points at its successor", () => {
  const stale = finding.parse(load("finding-scenario-b-stale.json"));
  const live = finding.parse(load("finding-scenario-b.json"));
  assert.equal(stale.status, "stale");
  assert.equal(stale.finding_id, live.finding_id);
  assert.equal(stale.checker_run.run_id, live.checker_run.run_id);
  assert.ok(stale.why_it_matters.includes("fnd-b-35-002"));
});

test("scenario B superseding card binds to the 35 percent message", () => {
  const f = finding.parse(load("finding-scenario-b-superseding.json"));
  assert.equal(f.supersedes, "fnd-b-40-001");
  assert.equal(f.requirements_revision, "1786474920.000900");
  assert.ok(f.sources.some((s) => s.id === "1786474920.000900"));
});

test("RC2 card computes both masses and asks Milo without choosing", () => {
  const f = finding.parse(load("finding-rc2-conflict.json"));
  assert.equal(f.question?.to, "Milo Trent");
  const labels = f.reproduced.map((r) => r.label);
  assert.ok(labels.some((l) => l.includes("318 kg")));
  assert.ok(labels.some((l) => l.includes("310 kg")));
  assert.ok(f.sources.some((s) => s.id === "1785427200.001000"));
});

test("a finding without sources is rejected", () => {
  const bad = { ...(load("finding-rc1-clean.json") as object), sources: [] };
  assert.throws(() => finding.parse(bad));
});
