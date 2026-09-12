/**
 * Offline replay: fixture Slack scripts into the real reviewer tools, the
 * real Python checker, and the posted card. Pass rules are from
 * research/synthetic-fixture-spec.md section 5.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { finding, type CheckerResponse } from "agent-core";
import { recallRun } from "../reviewer-tools";
import { loadFixture } from "./fixture-loader";
import { runReplay, type EvidenceResult, type ScriptContext, type ToolCall } from "./harness";

const examples = join(import.meta.dirname, "../../../../contracts/examples");
const example = (name: string) =>
  finding.parse(JSON.parse(readFileSync(join(examples, name), "utf8")));
const exampleRcInputs = () =>
  (JSON.parse(readFileSync(join(examples, "checker-rc-request.json"), "utf8")) as { inputs: unknown }).inputs;

const readThread: ToolCall = { name: "read_thread", args: {} };
const readEvidence = (document: string): ToolCall => ({ name: "read_evidence", args: { document } });
const rcCheck = (inputs: unknown): ToolCall => ({ name: "run_check", args: { checker: "rc", inputs } });
const routeCheck = (inputs: unknown): ToolCall => ({ name: "run_route_check", args: { inputs } });
const publish = (args: Record<string, unknown>): ToolCall => ({ name: "publish_result", args });

const docLine = (doc: EvidenceResult, pattern: RegExp) => {
  const line = doc.lines.find((l) => pattern.test(l.text));
  assert.ok(line, `document has no line matching ${pattern}`);
  return line;
};
const docSource = (doc: EvidenceResult, pattern: RegExp) => {
  const line = docLine(doc, pattern);
  return { kind: "document" as const, id: doc.document, revision: doc.revision, sha256: doc.sha256, locator: `line ${line.n}`, quote: line.text.slice(0, 300) };
};
const routeCases = (res: CheckerResponse) =>
  res.outputs.cases as Record<string, { energy_kWh: number; budget_kWh: number; feasible: boolean }>;

const ROUTE_V21 = { mass_kg: 318, Crr: 0.0048, CdA: 0.12, v_mps: 22, d_m: 220000, pack_kWh: 5.2, soc_start: 0.96 };

it("scenario A: real checker into a posted card that matches the contract example", { timeout: 20_000 }, async () => {
  const messages = loadFixture("scenario-a");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const seed = messages[0]!;
  const model = example("finding-scenario-a.json");
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => readEvidence("precharge-review-r2.docx"),
      () => rcCheck(exampleRcInputs()),
      (ctx) => {
        const doc = ctx.evidence[0]!;
        return publish({
          run_id: ctx.checker!.run_id,
          requirements_revision: trigger.ts,
          discrepancy: model.discrepancy,
          why_it_matters: model.why_it_matters,
          sources: [
            docSource(doc, /Bus capacitance C = 750 uF/),
            docSource(doc, /t_99\.9 = -470 \* 750e-6/),
            { kind: "message", id: seed.ts, quote: "Dropped one film cap, bus is now 680 uF." },
          ],
          inferred: [],
          resolution: model.resolution,
          question: model.question,
        });
      },
      () => undefined,
    ],
  });
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

it("RC1 clean control: discrepancy none, every value reproduces, no component change suggested", { timeout: 20_000 }, async () => {
  const messages = loadFixture("rc1-clean");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => readEvidence("precharge-review-r2-clean.docx"),
      () =>
        rcCheck({
          R_ohm: 470,
          threshold: 0.999,
          timer_s: 2.5,
          capacitances: [
            { label: "680uF_text", C_F: 0.00068 },
            { label: "680uF_diagram", C_F: 0.00068 },
            { label: "2mF_example", C_F: 0.002 },
          ],
          printed: [
            { label: "printed_2.208", value_s: 2.208, against: ["680uF_text", "680uF_diagram"] },
            { label: "printed_6.49", value_s: 6.49, against: ["2mF_example"] },
          ],
          // The document prints to two decimals; half a unit in the last place.
          tolerance_s: 0.005,
        }),
      (ctx) => {
        const doc = ctx.evidence[0]!;
        return publish({
          run_id: ctx.checker!.run_id,
          requirements_revision: trigger.ts,
          discrepancy: "none",
          why_it_matters: "All three printed results reproduce within 5 ms. Relay close at 2.5 s leaves 292 ms margin at 680 uF.",
          sources: [docSource(doc, /Bus capacitance C = 680 uF/), docSource(doc, /t_99\.9 = -470 \* 680e-6/), docSource(doc, /t = 6\.49 s/)],
          inferred: [],
          resolution: "No action. Review can be signed against r2.",
        });
      },
      () => undefined,
    ],
  });
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
  const messages = loadFixture("rc2-conflict");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const reweigh = messages.find((m) => /Re-weigh pending/.test(m.text))!;
  const useV21 = messages.find((m) => /Use v2-1/.test(m.text))!;
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => routeCheck({ ...ROUTE_V21, soc_end: 0.4, alternative_mass_kg: [310] }),
      (ctx) =>
        publish({
          run_id: ctx.checker!.run_id,
          requirements_revision: trigger.ts,
          discrepancy:
            "Request names the July 3 sheet (v2-0). v2-1 (July 24) supersedes it per Milo and Ines. v2-1 mass is unresolved: 318 kg on the sheet, possibly 310 kg after the ballast correction, re-weigh pending. At 22 m/s the segment is not feasible at end SoC 40 percent under either mass.",
          why_it_matters:
            "Feasibility at 22 m/s is not met at 318 kg or 310 kg against the 2.912 kWh budget. The 8 kg question does not change the conclusion but the run cannot be labeled final until the mass is settled.",
          sources: [
            { kind: "message", id: useV21.ts, quote: "Use v2-1 for anything after today." },
            { kind: "message", id: reweigh.ts, quote: "v2-1 mass may be 8 kg high, the ballast was on the scale. Re-weigh pending." },
          ],
          inferred: ["Array input assumed zero.", "Optional loop excluded and two 20 minute swaps taken from the request text."],
          resolution: "Milo posts the re-weigh result. The run is blocked on that confirmation.",
          question: { to: "Milo Trent", ask: "Is the v2-1 mass 318 kg or 310 kg? The re-weigh was pending on July 30 and nothing later resolves it." },
        }),
      () => undefined,
    ],
  });
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
  const routeFinding = (ctx: ScriptContext, revision: string, socEnd: number, supersedes?: string) => {
    const c = routeCases(ctx.checker!).mass_318kg!;
    return publish({
      run_id: ctx.checker!.run_id,
      requirements_revision: revision,
      discrepancy: `Under v2-1 the segment at 22 m/s is ${c.feasible ? "" : "not "}feasible at end SoC ${socEnd * 100} percent (${c.energy_kWh} kWh against ${c.budget_kWh} kWh).`,
      why_it_matters: "The request used v2-0; v2-1 supersedes it.",
      sources: [{ kind: "message", id: trigger.ts, quote: "I grabbed the params from the July 3 sheet." }],
      inferred: ["Array input assumed zero."],
      resolution: "Juno confirms v2-1.",
      supersedes,
    });
  };
  let injected = false;
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => routeCheck({ ...ROUTE_V21, soc_end: 0.4 }),
      (ctx) => routeFinding(ctx, trigger.ts, 0.4),
      // Refused: the refusal names the current revision; rerun against it.
      (ctx) => {
        const last = ctx.publishes.at(-1);
        assert.ok(last && last.published === false, JSON.stringify(last));
        assert.ok(last.current_revision, last.reason);
        return routeCheck({ ...ROUTE_V21, soc_end: 0.35 });
      },
      (ctx) => {
        const refusal = ctx.publishes.at(-1);
        assert.ok(refusal && refusal.published === false && refusal.current_revision);
        return routeFinding(ctx, refusal.current_revision, 0.35);
      },
      () => undefined,
    ],
    afterChecker: () => {
      if (injected) return undefined;
      injected = true;
      return change;
    },
  });
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
