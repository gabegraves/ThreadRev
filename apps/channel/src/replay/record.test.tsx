import { it } from "node:test";
import assert from "node:assert/strict";
import { checkerResponse, finding } from "agent-core";
import { ChannelRunAgent } from "../agent";
import { loadFixture } from "./fixture-loader";
import { runReplay, ScriptedReviewer } from "./harness";
import { RECORD_FIELDS, toRecord } from "./record";
import { scriptFor } from "./scripts";

it("scenario-a record carries exactly the section 4 fields", { timeout: 20_000 }, async () => {
  const messages = loadFixture("scenario-a");
  const script = scriptFor("scenario-a", messages);
  const result = await runReplay({ messages, steps: script.steps, afterChecker: script.afterChecker });
  const record = toRecord({ caseName: "scenario-a", run: 1, mode: "scripted", model: null, result });

  // The seam: these names, in this order, nothing else.
  assert.deepEqual(Object.keys(record), [...RECORD_FIELDS]);
  assert.deepEqual(
    [...RECORD_FIELDS],
    ["case", "run", "mode", "model", "trigger_ts", "current_revision", "tool_calls", "checker_runs", "posted_cards", "replaced_cards", "failure"],
  );

  assert.equal(record.case, "scenario-a");
  assert.equal(record.run, 1);
  assert.equal(record.mode, "scripted");
  assert.equal(record.model, null);
  assert.equal(record.trigger_ts, "1787166300.000600");
  assert.equal(record.current_revision, record.trigger_ts);
  assert.equal(record.failure, null);

  assert.deepEqual(
    record.tool_calls.map((c) => c.name),
    ["read_thread", "read_evidence", "run_check", "publish_result"],
  );
  for (const call of record.tool_calls) assert.deepEqual(Object.keys(call), ["name", "args", "result"]);

  assert.equal(record.checker_runs.length, 1);
  for (const run of record.checker_runs) checkerResponse.parse(run);
  assert.equal(record.posted_cards.length, 1);
  assert.equal(record.replaced_cards.length, 0);
  const card = finding.parse(record.posted_cards[0]);
  assert.equal(card.checker_run.run_id, record.checker_runs[0]!.run_id);
  assert.equal(card.status, "live");
  assert.equal(card.requirements_revision, record.current_revision);
  // JSON round trip keeps the same keys.
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(record))), [...RECORD_FIELDS]);
});

it("model-mode wiring: the live ChannelRunAgent wrapper drives the same harness and record", { timeout: 20_000 }, async () => {
  // No API key here: the inner agent is the scripted reviewer, but the outer
  // wrapper, silence filter, tools, transcript and record path are the ones
  // `--model` uses. Proves the agent-factory seam without a model call.
  const messages = loadFixture("rc1-clean");
  const script = scriptFor("rc1-clean", messages);
  const result = await runReplay({
    messages,
    agent: (threadId) => new ChannelRunAgent(() => new ScriptedReviewer(script.steps), threadId),
  });
  const record = toRecord({ caseName: "rc1-clean", run: 1, mode: "model", model: "fake-scripted", result });
  assert.equal(record.failure, null);
  assert.equal(record.mode, "model");
  assert.equal(record.model, "fake-scripted");
  assert.deepEqual(Object.keys(record), [...RECORD_FIELDS]);
  assert.deepEqual(
    record.tool_calls.map((c) => c.name),
    ["read_thread", "read_evidence", "run_check", "publish_result"],
  );
  assert.equal(record.posted_cards.length, 1);
  assert.equal(record.posted_cards[0]!.discrepancy, "none");
});
