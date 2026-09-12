import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { finding, type CheckerResponse } from "agent-core";
import { recallProposal, recallRun } from "../reviewer-tools";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
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


it("scenario A: proposes the section 4 edit, approval writes a new file, the source is untouched", { timeout: 20_000 }, async () => {
  const outDir = mkdtempSync(join(tmpdir(), "threadrev-edit-"));
  process.env.EDIT_OUTPUT_DIR = outDir;
  try {
    const result = await replay("scenario-a");
    assert.equal(result.failure, undefined);
    // The finding card and the proposal are two separate posts; only the card parses as a finding.
    assert.equal(result.postedCards.length, 1);
    const creates = result.payloads.filter((p) => p.kind === "slack.message.create");
    const proposalPayload = creates.find((p) => JSON.stringify(p).includes("Proposed edit"));
    assert.ok(proposalPayload, `no proposal card among ${creates.length} creates`);
    const proposalText = JSON.stringify(proposalPayload);
    assert.match(proposalText, /Proposed edit: needs approval/);
    assert.match(proposalText, /t = 6\.91 s/);
    assert.match(proposalText, /t = 6\.493 s/);
    assert.match(proposalText, /Approve and write the file/);
    assert.match(proposalText, /Nothing has been written/);

    const toolResult = result.agentMessages.find((m) => m.role === "tool" && String(m.content).includes("proposal_id"));
    assert.ok(toolResult, "propose_edit returned no proposal_id");
    const { proposal_id, output } = JSON.parse(String(toolResult.content)) as { proposal_id: string; output: string };
    assert.equal(output, "precharge-review-r2-proposed.docx");
    const proposal = recallProposal(proposal_id);
    assert.ok(proposal, "proposal not remembered");
    assert.equal(proposal.view.status, "pending");
    assert.equal(existsSync(join(outDir, output)), false, "nothing may be written before approval");

    const sourcePath = join(import.meta.dirname, "../../../../fixtures/documents/precharge-review-r2.docx");
    const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
    const sourceBefore = sha(sourcePath);

    await proposal.decide(true, "Juno Marsh");
    assert.equal(proposal.view.status, "applied", proposal.view.error);
    assert.equal(sha(sourcePath), sourceBefore, "source file must not change");
    const written = join(outDir, output);
    assert.ok(existsSync(written));
    assert.equal(proposal.view.result_sha256, sha(written));
    assert.notEqual(proposal.view.result_sha256, sourceBefore);
    const text = JSON.parse(execFileSync("python3", [join(import.meta.dirname, "../../../../extractors/docx_text.py"), written], { encoding: "utf8" })) as { paragraphs: string[] };
    assert.ok(text.paragraphs.some((p) => p.includes("t = 6.493 s")), text.paragraphs.join("\n"));
    assert.ok(!text.paragraphs.some((p) => p.includes("6.91")), "old printed value still present");
    // Every other line is byte-identical in meaning: same paragraph count.
    const before = JSON.parse(execFileSync("python3", [join(import.meta.dirname, "../../../../extractors/docx_text.py"), sourcePath], { encoding: "utf8" })) as { paragraphs: string[] };
    assert.equal(text.paragraphs.length, before.paragraphs.length);
    // Deciding twice is a no-op.
    await proposal.decide(false, "someone else");
    assert.equal(proposal.view.status, "applied");
  } finally {
    delete process.env.EDIT_OUTPUT_DIR;
    rmSync(outDir, { recursive: true, force: true });
  }
});

it("propose_edit refuses a replacement value the checker did not produce", { timeout: 20_000 }, async () => {
  const messages = loadFixture("scenario-a");
  const base = scriptFor("scenario-a", messages);
  const steps = base.steps.slice(0, 4);
  steps.push((ctx) => ({
    name: "propose_edit",
    args: {
      run_id: ctx.checker!.run_id,
      document: "precharge-review-r2.docx",
      // 6.5 would be accepted: it is the one-decimal rounding of the checker's 6.4933. 7.0 is nobody's number.
      edits: [{ locator: "section 4", find: "t = 6.91 s", replace: "t = 7.0 s" }],
    },
  }));
  steps.push(() => undefined);
  const result = await runReplay({ messages, steps });
  assert.equal(result.failure, undefined);
  const creates = result.payloads.filter((p) => p.kind === "slack.message.create");
  assert.ok(!creates.some((p) => JSON.stringify(p).includes("Proposed edit")), "no proposal card may be posted for a refused edit");
  const refusal = result.agentMessages.find((m) => m.role === "tool" && String(m.content).includes('"proposed":false'));
  assert.ok(refusal, "expected a refusal from propose_edit");
  assert.match(String(refusal.content), /7\.0.*not a value from run/);
});
