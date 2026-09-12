/**
 * Offline replay: fixture Slack scripts into the real channel handlers, the
 * real Python checker, and the posted card. Pass rules are from
 * research/synthetic-fixture-spec.md section 5.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  finding,
  type CheckerRequest,
  type CheckerResponse,
  type Finding,
} from "agent-core";
import { loadFixture } from "./fixture-loader";
import { runReplay, type ScriptContext, type ToolCall } from "./harness";

const examples = join(import.meta.dirname, "../../../../contracts/examples");
const example = (name: string) =>
  finding.parse(JSON.parse(readFileSync(join(examples, name), "utf8")));
const exampleRcRequest = () =>
  JSON.parse(readFileSync(join(examples, "checker-rc-request.json"), "utf8")) as CheckerRequest;

const DOC_SHA = "0".repeat(64);
const CLEAN_SHA = "1".repeat(64);

const readThread: ToolCall = { name: "read_thread", args: {} };
const checkerCall = (req: CheckerRequest): ToolCall => ({ name: "run_checker", args: req });
const publishCall = (card: Finding): ToolCall => ({ name: "publish_result", args: card });

/** A per-capacitance output as the rc checker writes it. */
const rcOutput = (res: CheckerResponse, label: string) => {
  const per = (res.outputs.per_capacitance as Record<string, { t_threshold_s: number }>)[label];
  assert.ok(per, `checker output missing ${label}`);
  return per;
};
const checkPass = (res: CheckerResponse, name: string) => {
  const check = res.checks.find((c) => c.name === name);
  assert.ok(check, `checker has no check ${name}`);
  return check;
};

/** What a good reviewer builds from the Scenario A checker run. Numbers come from the checker only. */
function scenarioAFinding(res: CheckerResponse, revision: string): Finding {
  const model = example("finding-scenario-a.json");
  const printed = (label: string, cap: string) => {
    const check = checkPass(res, `${label}_matches_${cap}`);
    return {
      computed: rcOutput(res, cap).t_threshold_s,
      printed: Number(check.expected),
      matches: check.pass,
      tolerance: check.tolerance,
    };
  };
  return {
    ...model,
    requirements_revision: revision,
    reproduced: [
      { label: "t_99.9 at 680 uF", unit: "s", ...printed("printed_2.435", "680uF_text") },
      { label: "t_99.9 at 750 uF", unit: "s", ...printed("printed_2.435", "750uF_diagram") },
      { label: "t_99.9 at 2 mF", unit: "s", ...printed("printed_6.91", "2mF_example") },
    ],
    checker_run: { checker: res.checker, version: res.version, run_id: res.run_id },
  };
}

it("scenario A: real checker into a posted card that matches the contract example", { timeout: 15_000 }, async () => {
  const messages = loadFixture("scenario-a");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => checkerCall(exampleRcRequest()),
      (ctx) => publishCall(scenarioAFinding(ctx.checker!, trigger.ts)),
      () => undefined,
    ],
  });
  assert.equal(result.failure, undefined);
  // The reviewer saw the fixture, not the change message after the cutoff.
  const thread = JSON.stringify(result.agentMessages);
  assert.match(thread, /bus is now 680 uF/);
  assert.doesNotMatch(thread, /Bus is 820 uF/);
  assert.equal(result.heldBack.length, 1);
  assert.equal(result.heldBack[0]?.role, "change");

  const model = example("finding-scenario-a.json");
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  assert.equal(card.discrepancy, model.discrepancy);
  assert.deepEqual(
    card.reproduced.map((r) => r.matches),
    model.reproduced.map((r) => r.matches),
  );
  assert.equal(card.checker_run.checker, model.checker_run.checker);
  assert.equal(card.checker_run.run_id, result.state.checkerRuns[0]?.run_id);
  assert.match(card.checker_run.run_id, /^rc-\d{8}T\d{6}Z-[0-9a-f]{4}$/);
  assert.equal(card.status, "live");
  assert.equal(card.requirements_revision, trigger.ts);
  const terminal = result.payloads.at(-1);
  assert.equal(terminal?.kind, "channel.delivery.terminal");
  assert.equal(terminal?.status, "complete");
});

it("RC1 clean control: discrepancy none, every value reproduces, no component change suggested", { timeout: 15_000 }, async () => {
  const messages = loadFixture("rc1-clean");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const request: CheckerRequest = {
    checker: "rc",
    version: "1",
    inputs: {
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
        { label: "printed_6.49", value_s: 6.49, against: ["2mF_example"], tolerance_s: 0.005 },
      ],
      tolerance_s: 0.0005,
    },
  };
  const cleanFinding = (res: CheckerResponse): Finding => {
    const model = example("finding-rc1-clean.json");
    const pairs: Array<[string, string, string]> = [
      ["t_99.9 at 680 uF (text)", "printed_2.208", "680uF_text"],
      ["t_99.9 at 680 uF (diagram)", "printed_2.208", "680uF_diagram"],
      ["t_99.9 at 2 mF", "printed_6.49", "2mF_example"],
    ];
    return {
      ...model,
      requirements_revision: trigger.ts,
      sources: [{ ...model.sources[0]!, sha256: CLEAN_SHA }],
      reproduced: pairs.map(([label, printed, cap]) => {
        const check = checkPass(res, `${printed}_matches_${cap}`);
        return {
          label,
          unit: "s",
          computed: rcOutput(res, cap).t_threshold_s,
          printed: Number(check.expected),
          matches: check.pass,
          tolerance: check.tolerance,
        };
      }),
      checker_run: { checker: res.checker, version: res.version, run_id: res.run_id },
    };
  };
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => checkerCall(request),
      (ctx) => publishCall(cleanFinding(ctx.checker!)),
      () => undefined,
    ],
  });
  assert.equal(result.failure, undefined);
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  assert.equal(card.discrepancy, "none");
  assert.equal(card.reproduced.length, 3);
  assert.ok(card.reproduced.every((r) => r.matches === true), JSON.stringify(card.reproduced));
  assert.ok(card.checker_run.run_id);
  assert.equal(card.checker_run.run_id, result.state.checkerRuns[0]?.run_id);
  const text = JSON.stringify(card);
  assert.doesNotMatch(text, /470\s*ohm[^.]*\b(should|instead|replace|change|lower|raise)\b/i);
  assert.doesNotMatch(text, /\b(should|ought to|must) be\b/i);
});

it("RC2 conflicting evidence: both masses computed in one run, neither final, question names Milo", { timeout: 15_000 }, async () => {
  const messages = loadFixture("rc2-conflict");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const reweigh = messages.find((m) => /Re-weigh pending/.test(m.text))!;
  const useV21 = messages.find((m) => /Use v2-1/.test(m.text))!;
  const request: CheckerRequest = {
    checker: "route",
    version: "1",
    inputs: {
      mass_kg: 318,
      Crr: 0.0048,
      CdA: 0.12,
      v_mps: 22,
      d_m: 220000,
      pack_kWh: 5.2,
      soc_start: 0.96,
      soc_end: 0.4,
      alternative_mass_kg: [310],
    },
  };
  const conflictFinding = (res: CheckerResponse): Finding => {
    const cases = res.outputs.cases as Record<string, { energy_kWh: number; budget_kWh: number; feasible: boolean }>;
    const c318 = cases.mass_318kg!;
    const c310 = cases.mass_310kg!;
    return {
      finding_id: "fnd-rc2-001",
      status: "live",
      requirements_revision: trigger.ts,
      discrepancy:
        "Request names the July 3 sheet (v2-0). v2-1 (July 24) supersedes it per Milo and Ines. v2-1 mass is unresolved: 318 kg on the sheet, possibly 310 kg after the ballast correction, re-weigh pending. At 22 m/s the segment is not feasible at end SoC 40 percent under either mass.",
      why_it_matters:
        "Feasibility at 22 m/s is not met at 318 kg or 310 kg against the 2.912 kWh budget. The 8 kg question does not change the conclusion but the run cannot be labeled final until the mass is settled.",
      sources: [
        { kind: "message", id: useV21.ts, quote: "Use v2-1 for anything after today." },
        { kind: "message", id: reweigh.ts, quote: "v2-1 mass may be 8 kg high, the ballast was on the scale. Re-weigh pending." },
        { kind: "document", id: "ks4-sim-inputs-v2-1.xlsx", revision: "v2-1", sha256: DOC_SHA, locator: "params rows 2 to 5" },
      ],
      reproduced: [
        { label: "energy at 318 kg, 22 m/s", computed: c318.energy_kWh, unit: "kWh" },
        { label: "energy at 310 kg, 22 m/s", computed: c310.energy_kWh, unit: "kWh" },
        { label: "budget SoC 96 to 40 percent", computed: c318.budget_kWh, unit: "kWh" },
      ],
      inferred: [
        "Array input assumed zero.",
        "Optional loop excluded and two 20 minute swaps taken from the request text.",
      ],
      resolution:
        "Milo posts the re-weigh result. The run is blocked on that confirmation.",
      question: {
        to: "Milo Trent",
        ask: "Is the v2-1 mass 318 kg or 310 kg? The re-weigh was pending on July 30 and nothing later resolves it.",
      },
      checker_run: { checker: res.checker, version: res.version, run_id: res.run_id },
    };
  };
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => checkerCall(request),
      (ctx) => publishCall(conflictFinding(ctx.checker!)),
      () => undefined,
    ],
  });
  assert.equal(result.failure, undefined);
  // The re-weigh message is before the cutoff and visible; the 35 percent change is evaluator-only.
  const thread = JSON.stringify(result.agentMessages);
  assert.match(thread, /Re-weigh pending/);
  assert.doesNotMatch(thread, /end SoC 35%/);

  assert.equal(result.state.checkerRuns.length, 1, "both masses must come from one checker run");
  const run = result.state.checkerRuns[0]!;
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const card = result.postedCards[0]!;
  const by = Object.fromEntries(card.reproduced.map((r) => [r.label, r.computed]));
  assert.ok(Math.abs(by["energy at 318 kg, 22 m/s"]! - 3.0447) < 0.0005);
  assert.ok(Math.abs(by["energy at 310 kg, 22 m/s"]! - 3.0217) < 0.0005);
  assert.equal(card.checker_run.run_id, run.run_id);
  assert.ok(card.question, "reviewer must ask, not decide");
  assert.match(card.question!.to, /Milo/);
  const text = JSON.stringify(card);
  assert.doesNotMatch(text, /\b(318|310)\s*kg is (correct|final|authoritative|right)\b/i);
  assert.doesNotMatch(text, /\b(is|as|are)\s+final\b/i);
});

it("RC3 mid-run revision: refused 40 percent card kept stale with its run id, one live card at 35 percent", { timeout: 20_000 }, async () => {
  const messages = loadFixture("rc3-midrun");
  const trigger = messages.find((m) => m.role === "trigger")!;
  const change = messages.find((m) => m.role === "change")!;
  const routeRequest = (soc_end: number): CheckerRequest => ({
    checker: "route",
    version: "1",
    inputs: {
      mass_kg: 318, Crr: 0.0048, CdA: 0.12, v_mps: 22, d_m: 220000,
      pack_kWh: 5.2, soc_start: 0.96, soc_end,
    },
  });
  const routeFinding = (res: CheckerResponse, revision: string, socEnd: number, id: string): Finding => {
    const c = (res.outputs.cases as Record<string, { energy_kWh: number; budget_kWh: number; feasible: boolean }>).mass_318kg!;
    return {
      finding_id: id,
      status: "live",
      requirements_revision: revision,
      discrepancy: c.feasible
        ? `Under v2-1 the segment at 22 m/s is feasible at end SoC ${socEnd * 100} percent (${c.energy_kWh} kWh against ${c.budget_kWh} kWh).`
        : `Under v2-1 the segment at 22 m/s is not feasible at end SoC ${socEnd * 100} percent (${c.energy_kWh} kWh against ${c.budget_kWh} kWh).`,
      why_it_matters: "The request used v2-0; v2-1 supersedes it.",
      sources: [{ kind: "message", id: trigger.ts, quote: "I grabbed the params from the July 3 sheet." }],
      reproduced: [
        { label: "energy at 318 kg, 22 m/s", computed: c.energy_kWh, unit: "kWh" },
        { label: `budget SoC 96 to ${socEnd * 100} percent`, computed: c.budget_kWh, unit: "kWh" },
      ],
      inferred: ["Array input assumed zero."],
      resolution: "Juno confirms v2-1.",
      checker_run: { checker: res.checker, version: res.version, run_id: res.run_id },
    };
  };
  let injected = false;
  const result = await runReplay({
    messages,
    steps: [
      () => readThread,
      () => checkerCall(routeRequest(0.4)),
      (ctx: ScriptContext) => publishCall(routeFinding(ctx.checker!, trigger.ts, 0.4, "fnd-rc3-001")),
      // Refused. The SDK caches the transcript per delivery, so a second
      // read_thread would return the cutoff snapshot; the refusal carries the
      // current revision and the reviewer reruns at the new end SoC.
      (ctx) => {
        const last = ctx.publishes.at(-1);
        assert.ok(last && last.published === false, JSON.stringify(last));
        assert.equal(last.current_revision, change.ts);
        assert.equal(last.card_revision, trigger.ts);
        return checkerCall(routeRequest(0.35));
      },
      (ctx) => {
        const current = ctx.publishes.at(-1);
        assert.ok(current && current.published === false);
        return publishCall({
          ...routeFinding(ctx.checker!, current.current_revision, 0.35, "fnd-rc3-002"),
          supersedes: "fnd-rc3-001",
        });
      },
      () => undefined,
    ],
    afterChecker: (_res, state) => {
      if (injected) return undefined;
      injected = true;
      assert.equal(state.currentRequirementsRevision, trigger.ts);
      return change;
    },
  });
  assert.equal(result.failure, undefined);
  assert.equal(result.state.checkerRuns.length, 2);
  const [first, second] = result.state.checkerRuns as [CheckerResponse, CheckerResponse];
  assert.notEqual(first.run_id, second.run_id);

  // Exactly one live card, bound to the change message.
  assert.equal(result.postedCards.length, 1, JSON.stringify(result.payloads));
  const live = result.postedCards[0]!;
  assert.equal(live.status, "live");
  assert.equal(live.requirements_revision, change.ts);
  assert.equal(live.checker_run.run_id, second.run_id);
  assert.equal(live.supersedes, "fnd-rc3-001");
  assert.match(live.discrepancy, /is feasible at end SoC 35 percent/);
  const liveRecords = result.state.records.filter((r) => r.finding.status === "live");
  assert.equal(liveRecords.length, 1);

  // Exactly one stale record, original run id and its inputs and outputs preserved.
  const stale = result.state.records.filter((r) => r.finding.status === "stale");
  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.finding.finding_id, "fnd-rc3-001");
  assert.equal(stale[0]!.finding.checker_run.run_id, first.run_id);
  assert.equal(stale[0]!.finding.requirements_revision, trigger.ts);
  assert.deepEqual(stale[0]!.checker, first);
  assert.equal((stale[0]!.checker!.inputs as { soc_end: number }).soc_end, 0.4);
  assert.match(stale[0]!.finding.discrepancy, /not feasible at end SoC 40 percent/);

  // The injected change is now part of the thread state the harness owns.
  assert.equal(result.state.currentRequirementsRevision, change.ts);
  assert.ok(result.state.visible.some((m) => m.ts === change.ts));
});
