import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "agent-core";
import { guardPublish, markStale } from "./publish-guard";

const examples = join(import.meta.dirname, "../../../../contracts/examples");
const scenarioA = () =>
  finding.parse(
    JSON.parse(readFileSync(join(examples, "finding-scenario-a.json"), "utf8")),
  );

describe("guardPublish", () => {
  it("allows a card bound to the current revision", () => {
    const card = scenarioA();
    const decision = guardPublish(card, card.requirements_revision);
    assert.deepEqual(decision, { ok: true, revision: card.requirements_revision });
  });

  it("refuses a card whose revision is behind the current one", () => {
    const card = scenarioA();
    const decision = guardPublish(card, "1787171400.000200");
    assert.deepEqual(decision, {
      ok: false,
      reason: "stale_revision",
      cardRevision: "1787062320.000100",
      currentRevision: "1787171400.000200",
    });
  });

  it("refuses on any mismatch, including a document revision label", () => {
    const card = { ...scenarioA(), requirements_revision: "r2" };
    assert.equal(guardPublish(card, "r3").ok, false);
    assert.equal(guardPublish(card, "r2").ok, true);
  });

  it("rejects an empty current revision instead of guessing", () => {
    assert.throws(() => guardPublish(scenarioA(), ""));
  });
});

describe("markStale", () => {
  it("preserves run_id, inputs and every other field, and does not mutate", () => {
    const card = scenarioA();
    const stale = markStale(card);
    assert.equal(stale.status, "stale");
    assert.equal(card.status, "live");
    assert.equal(stale.checker_run.run_id, card.checker_run.run_id);
    assert.deepEqual({ ...stale, status: "live" }, card);
    assert.ok(finding.parse(stale));
  });
});
