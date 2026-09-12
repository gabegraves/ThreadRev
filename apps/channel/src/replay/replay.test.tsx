import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { finding, type CheckerResponse } from "agent-core";
import { recallRun } from "../reviewer-tools";
import { loadFixture } from "./fixture-loader";
import { runReplay, type ReplayResult } from "./harness";
import { routeCases, scriptFor } from "./scripts";

const examples = join(import.meta.dirname, "../../../../contracts/examples");
const example = (name: string) =>
  finding.parse(JSON.parse(readFileSync(join(examples, name), "utf8")));

/** Replay one fixture with the scripted reviewer steps from scripts.ts. */
async function replay(caseName: string): Promise<ReplayResult> {
  const messages = loadFixture(caseName);
  const script = scriptFor(caseName, messages);
  return runReplay({ messages, steps: script.steps, afterChecker: script.afterChecker });
}

it("scenario A: real checker into a posted card that matches the contract example", { timeout: 20_000 }, async () => {
  const messages = loadFixture("scenario-a");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const model = example("finding-scenario-a.json");
  const result = await replay("scenario-a");
  assert.equal(result.failure, undefined);
  // The reviewer saw the fixture up to the cutoff, not the change message after it.
  const thread = JSON.stringify(result.agentMessages);
  assert.match(thread, /bus is now 680 uF/);
  assert.doesNotMatch(thread, /Bus is 820 uF/);
  assert.equal(result.heldBack.length, 1);
  assert.equal(result.heldBack[0]?.role, "change");
  // read_evidence returned the real document with its sha256.
  assert.match(thread, /sha256\\?":\\?"[0-9a-f]{64}/);

  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  const run = result.state.checkerRuns[0]!;
  assert.equal(card.headline, "Review check: needs a decision");
  assert.ok(card.text.includes(model.discrepancy));
  assert.equal(card.checker, model.checker_run.checker);
  assert.equal(card.runId, run.run_id);
  assert.match(card.runId, /^rc-\d{8}T\d{6}Z-[0-9a-f]{4}$/);
  assert.equal(card.revision, trigger.ts);
  assert.equal(card.stale, false);
  // The three printed values, in checker order: 680 text no, 750 diagram yes, 2 mF no.
  assert.deepEqual(card.matches.filter((m) => m !== undefined), model.reproduced.map((r) => r.matches));
  assert.equal(card.question, model.question!.to);
  assert.equal(result.threadState?.cards.length, 1);
  assert.equal(result.threadState?.cards[0]?.finding.checker_run.run_id, run.run_id);
  const terminal = result.payloads.at(-1);
  assert.equal(terminal?.kind, "channel.delivery.terminal");
  assert.equal(terminal?.status, "complete");
});

it("scenario A cross-channel: the 820 uF correction lives in #ks4-purchasing and is found by search_workspace, not the thread", { timeout: 20_000 }, async () => {
  const messages = loadFixture("scenario-a-cross");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const result = await replay("scenario-a-cross");
  assert.equal(result.failure, undefined);
  const thread = JSON.stringify(result.agentMessages);
  // The thread itself never says 820. The workspace search did, from another channel, before the cutoff.
  assert.doesNotMatch(JSON.stringify(messages), /820/);
  assert.match(thread, /#ks4-purchasing/);
  assert.match(thread, /HV bus is 820 uF, not 680/);
  // Post-trigger workspace messages did not leak into the search result.
  assert.doesNotMatch(thread, /r3 will state 820|snubber bank delivered/);
  const search = result.agentMessages.find((m) => m.role === "assistant" && m.toolCalls?.some((c) => c.function.name === "search_workspace"));
  assert.ok(search, "search_workspace was not called");

  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  const run = result.state.checkerRuns[0]!;
  assert.equal(card.headline, "Review check: needs a decision");
  assert.equal(card.runId, run.run_id);
  assert.equal(card.revision, trigger.ts);
  assert.match(card.text, /#ks4-purchasing/);
  assert.match(card.text, /2\.6622/);
  assert.equal(card.question, "Dara Voss");
  // Four printed comparisons in checker order: 680 no, 750 yes, 820 no, 2 mF no.
  assert.deepEqual(card.matches.filter((m) => m !== undefined), [false, true, false, false]);
  // The card cites the cross-channel message by ts.
  assert.match(card.text, /1785946800\.000501/);
});

it("RC1 clean control: discrepancy none, every value reproduces, no component change suggested", { timeout: 20_000 }, async () => {
  const result = await replay("rc1-clean");
  assert.equal(result.failure, undefined);
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  assert.equal(card.headline, "Review check: reproduces");
  assert.ok(card.text.includes("No discrepancy found."));
  const printedLines = card.matches.filter((m) => m !== undefined);
  assert.equal(printedLines.length, 3);
  assert.ok(printedLines.every((m) => m === true), card.text);
  assert.doesNotMatch(card.text, /does not reproduce/);
  assert.equal(card.runId, result.state.checkerRuns[0]!.run_id);
  assert.match(card.runId, /^rc-/);
  assert.doesNotMatch(card.text, /470\s*ohm[^.]*\b(should|instead|replace|change|lower|raise)\b/i);
  assert.doesNotMatch(card.text, /\b(should|ought to|must) be\b/i);
});

it("RC2 conflicting evidence: both masses computed in one run, neither final, question names Milo", { timeout: 20_000 }, async () => {
  const result = await replay("rc2-conflict");
  assert.equal(result.failure, undefined);
  const thread = JSON.stringify(result.agentMessages);
  assert.match(thread, /Re-weigh pending/);
  assert.doesNotMatch(thread, /end SoC 35%/);

  assert.equal(result.state.checkerRuns.length, 1, "both masses must come from one checker run");
  const run = result.state.checkerRuns[0]!;
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  assert.equal(card.runId, run.run_id);
  // Both masses computed in the run the card is bound to, neither feasible.
  const cases = routeCases(recallRun(card.runId)!);
  assert.ok(Math.abs(cases.mass_318kg!.energy_kWh - 3.0447) < 0.0005);
  assert.ok(Math.abs(cases.mass_310kg!.energy_kWh - 3.0217) < 0.0005);
  assert.equal(cases.mass_318kg!.feasible, false);
  assert.equal(cases.mass_310kg!.feasible, false);
  assert.equal(card.headline, "Review check: needs a decision");
  assert.match(card.question ?? "", /Milo/, card.text);
  assert.match(card.text, /318 kg/);
  assert.match(card.text, /310 kg/);
  assert.doesNotMatch(card.text, /\b(318|310)\s*kg is (correct|final|authoritative|right)\b/i);
  assert.doesNotMatch(card.text, /\b(is|as|are)\s+final\b/i);
});

it(
  "RC3 mid-run revision: refused 40 percent card kept stale with its run id, one live card at 35 percent",
  {
    timeout: 20_000,
    // Fails today: publish_result derives the current revision with
    // latestRevision() over thread.getMessages(), whose `ts` is the ISO
    // `occurredAt` from the managed transcript. revision.ts tsNum() returns -1
    // for ISO strings, so no change message can ever beat the fallback and the
    // 40 percent card is published. Remove this todo once revision.ts parses
    // ISO timestamps (Date.parse fallback in tsNum).
  },
  async () => {
  const messages = loadFixture("rc3-midrun");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const change = messages.find((m) => m.role === "change")!;
  const result = await replay("rc3-midrun");
  assert.equal(result.failure, undefined);
  assert.equal(result.state.checkerRuns.length, 2, JSON.stringify(result.agentMessages));
  const [first, second] = result.state.checkerRuns as [CheckerResponse, CheckerResponse];
  assert.notEqual(first.run_id, second.run_id);

  // Exactly one live card, bound to the change message, from the second run.
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const live = result.postedCards[0]!;
  assert.equal(live.stale, false);
  assert.equal(live.runId, second.run_id);
  assert.match(live.text, /is feasible at end SoC 35 percent/);
  const changeIso = new Date(Number(change.ts.split(".")[0]) * 1000).toISOString();
  assert.ok(
    live.revision === change.ts || live.revision === changeIso,
    `live card bound to ${live.revision}, change message is ${change.ts} (${changeIso})`,
  );
  assert.equal(result.replacedCards.length, 0, "nothing was superseded; the 40 percent card was never posted");
  assert.equal(result.threadState?.cards.length, 1);
  assert.equal(result.threadState?.cards[0]?.finding.status, "live");

  // Exactly one stale record, original run id preserved, its inputs and outputs still retrievable.
  assert.equal(result.threadState?.staleRuns.length, 1, JSON.stringify(result.threadState));
  const stale = result.threadState!.staleRuns[0]!;
  assert.equal(stale.run_id, first.run_id);
  assert.equal(stale.bound, trigger.ts);
  assert.equal(stale.current, live.revision);
  const preserved = recallRun(stale.run_id);
  assert.ok(preserved);
  assert.equal((preserved.inputs as { soc_end: number }).soc_end, 0.4);
  assert.equal(routeCases(preserved).mass_318kg!.feasible, false);
});

/**
 * Live/fixture divergence guard.
 *
 * The revision tracker once compared Slack ts strings with Number(), which
 * silently returned -1 for every message on a managed transcript because those
 * carry ISO occurredAt instead. Fixtures used numeric ts, so the whole suite
 * stayed green while revision detection was dead on the live path.
 *
 * These assert on the fields the reviewer actually reads off a transcript, so
 * the next shape difference fails here rather than in front of a judge.
 */
it("author identity survives the managed transcript", { timeout: 20_000 }, async () => {
  const messages = loadFixture("scenario-a");
  let seen: Array<{ ts?: string; from?: string; bot?: boolean; text?: string }> = [];
  await runReplay({
    messages,
    steps: [
      () => ({ name: "read_thread", args: {} }),
      (ctx) => {
        seen = ctx.results[0] as typeof seen;
        return undefined;
      },
    ],
  });

  assert.ok(Array.isArray(seen) && seen.length > 0, "read_thread returned no messages");
  const humans = seen.filter((m) => !m.bot);
  assert.ok(humans.length > 0, "no human messages came through");
  for (const m of humans) {
    assert.ok(m.ts, "every message must carry a ts the revision tracker can order");
    assert.notEqual(
      m.from,
      "unknown",
      `author fell back to "unknown" — the transcript's user shape is not the one read_thread reads`,
    );
    assert.ok(typeof m.text === "string", "message text must survive as a string");
  }
});

import { normalizeRecord, type RunRecord } from "./record";

it("two runs of the same fixture normalize to the same record", async () => {
  // run_id and finding_id embed a timestamp and a random suffix, so raw records
  // never match run to run. Normalized, they are golden-file comparable — which
  // is the only way six committed records can detect a regression.
  const a = normalizeRecord(JSON.parse(JSON.stringify({
    case: "rc1-clean",
    run: 1,
    checker_runs: [{ run_id: "rc-20260912T162159Z-3a95" }],
    posted_cards: [{ finding_id: "fnd-mtylf01b-d4lx", checker_run: { run_id: "rc-20260912T162159Z-3a95" } }],
  })) as RunRecord);
  const b = normalizeRecord(JSON.parse(JSON.stringify({
    case: "rc1-clean",
    run: 1,
    checker_runs: [{ run_id: "rc-20260912T171557Z-8f77" }],
    posted_cards: [{ finding_id: "fnd-mtyncek8-gfgm", checker_run: { run_id: "rc-20260912T171557Z-8f77" } }],
  })) as RunRecord);

  assert.deepEqual(a, b, "the same run should normalize to the same bytes");
  assert.equal((a as unknown as { checker_runs: { run_id: string }[] }).checker_runs[0]!.run_id, "run-1");
});

it("normalization keeps distinct ids distinct and repeated ids identical", () => {
  const out = normalizeRecord(JSON.parse(JSON.stringify({
    posted_cards: [
      { finding_id: "fnd-aaa-111", checker_run: { run_id: "rc-20260912T162159Z-3a95" } },
      { finding_id: "fnd-bbb-222", supersedes: "fnd-aaa-111", checker_run: { run_id: "rc-20260912T162159Z-3a95" } },
    ],
  })) as RunRecord) as unknown as {
    posted_cards: { finding_id: string; supersedes?: string; checker_run: { run_id: string } }[];
  };

  assert.notEqual(out.posted_cards[0]!.finding_id, out.posted_cards[1]!.finding_id);
  assert.equal(out.posted_cards[1]!.supersedes, out.posted_cards[0]!.finding_id,
    "a supersedes pointer must still resolve to the card it replaced");
  assert.equal(out.posted_cards[0]!.checker_run.run_id, out.posted_cards[1]!.checker_run.run_id,
    "the same run referenced twice must stay one id");
});
