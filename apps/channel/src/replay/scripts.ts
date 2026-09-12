/**
 * Scripted reviewer steps per fixture. These are the tool calls a good
 * reviewer makes for each case; replay.test.tsx and the record emitter share
 * them so a run record and a passing test describe the same run.
 *
 * Every number on a card still comes from the checker: the scripts only pass
 * run_ids and prose to publish_result.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { finding, type CheckerResponse } from "agent-core";
import type { FixtureMessage } from "./fixture-loader";
import type { EvidenceResult, ReplayOptions, ScriptContext, ScriptStep, ToolCall } from "./harness";

const examples = join(import.meta.dirname, "../../../../contracts/examples");
const example = (name: string) =>
  finding.parse(JSON.parse(readFileSync(join(examples, name), "utf8")));
export const exampleRcInputs = () =>
  (JSON.parse(readFileSync(join(examples, "checker-rc-request.json"), "utf8")) as { inputs: unknown }).inputs;

export const readThread: ToolCall = { name: "read_thread", args: {} };
export const readEvidence = (document: string): ToolCall => ({ name: "read_evidence", args: { document } });
export const rcCheck = (inputs: unknown): ToolCall => ({ name: "run_check", args: { checker: "rc", inputs } });
export const routeCheck = (inputs: unknown): ToolCall => ({ name: "run_route_check", args: { inputs } });
export const publish = (args: Record<string, unknown>): ToolCall => ({ name: "publish_result", args });

export const docLine = (doc: EvidenceResult, pattern: RegExp) => {
  const line = doc.lines.find((l) => pattern.test(l.text));
  assert.ok(line, `document has no line matching ${pattern}`);
  return line;
};
export const docSource = (doc: EvidenceResult, pattern: RegExp) => {
  const line = docLine(doc, pattern);
  return {
    kind: "document" as const,
    id: doc.document,
    revision: doc.revision,
    sha256: doc.sha256,
    locator: `line ${line.n}`,
    quote: line.text.slice(0, 300),
  };
};
export const routeCases = (res: CheckerResponse) =>
  res.outputs.cases as Record<string, { energy_kWh: number; budget_kWh: number; feasible: boolean }>;

export const ROUTE_V20 = { mass_kg: 290, Crr: 0.004, CdA: 0.12, v_mps: 22, d_m: 220000, pack_kWh: 5.2, soc_start: 0.96 };
export const ROUTE_V21 = { mass_kg: 318, Crr: 0.0048, CdA: 0.12, v_mps: 22, d_m: 220000, pack_kWh: 5.2, soc_start: 0.96 };

export interface Script {
  steps: ScriptStep[];
  afterChecker?: ReplayOptions["afterChecker"];
}

const trigger = (messages: FixtureMessage[]) => {
  const t = messages.find((m) => m.role === "trigger");
  assert.ok(t, "fixture has no trigger message");
  return t;
};
const find = (messages: FixtureMessage[], pattern: RegExp) => {
  const m = messages.find((x) => pattern.test(x.text));
  assert.ok(m, `fixture has no message matching ${pattern}`);
  return m;
};

function scenarioA(messages: FixtureMessage[]): Script {
  const t = trigger(messages);
  const seed = messages[0]!;
  const model = example("finding-scenario-a.json");
  return {
    steps: [
      () => readThread,
      () => readEvidence("precharge-review-r2.docx"),
      () => rcCheck(exampleRcInputs()),
      (ctx) => {
        const doc = ctx.evidence[0]!;
        return publish({
          run_id: ctx.checker!.run_id,
          requirements_revision: t.ts,
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
  };
}

function rc1Clean(messages: FixtureMessage[]): Script {
  const t = trigger(messages);
  return {
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
          requirements_revision: t.ts,
          discrepancy: "none",
          why_it_matters: "All three printed results reproduce within 5 ms. Relay close at 2.5 s leaves 292 ms margin at 680 uF.",
          sources: [
            docSource(doc, /Bus capacitance C = 680 uF/),
            docSource(doc, /t_99\.9 = -470 \* 680e-6/),
            docSource(doc, /t = 6\.49 s/),
          ],
          inferred: [],
          resolution: "No action. Review can be signed against r2.",
        });
      },
      () => undefined,
    ],
  };
}

function rc2Conflict(messages: FixtureMessage[]): Script {
  const t = trigger(messages);
  const reweigh = find(messages, /Re-weigh pending/);
  const useV21 = find(messages, /Use v2-1/);
  return {
    steps: [
      () => readThread,
      () => routeCheck({ ...ROUTE_V21, soc_end: 0.4, alternative_mass_kg: [310] }),
      (ctx) =>
        publish({
          run_id: ctx.checker!.run_id,
          requirements_revision: t.ts,
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
  };
}

/** Scenario B: the request names v2-0, v2-1 supersedes it, the conclusion flips. */
function scenarioB(messages: FixtureMessage[]): Script {
  const t = trigger(messages);
  const useV21 = find(messages, /Use v2-1/);
  const ines = find(messages, /Confirmed, corner weights/);
  return {
    steps: [
      () => readThread,
      () => routeCheck({ ...ROUTE_V20, soc_end: 0.4 }),
      () => routeCheck({ ...ROUTE_V21, soc_end: 0.4 }),
      (ctx) => {
        const [v20, v21] = ctx.checkers as [CheckerResponse, CheckerResponse];
        const a = routeCases(v20).mass_290kg!;
        const b = routeCases(v21).mass_318kg!;
        return publish({
          run_id: v21.run_id,
          requirements_revision: t.ts,
          discrepancy: `Request uses the July 3 sheet (v2-0); v2-1 (July 24) supersedes it per Milo and Ines. Under v2-0 the segment at 22 m/s is ${a.feasible ? "" : "not "}feasible (${a.energy_kWh} kWh against ${a.budget_kWh} kWh); under v2-1 it is ${b.feasible ? "" : "not "}feasible (${b.energy_kWh} kWh). The conclusion flips.`,
          why_it_matters: "A feasibility answer posted from v2-0 would be wrong by 0.22 kWh, 4 percent of the pack.",
          sources: [
            { kind: "message", id: useV21.ts, quote: "Use v2-1 for anything after today." },
            { kind: "message", id: ines.ts, quote: "Confirmed, corner weights from Tuesday add up to 318 with driver." },
            { kind: "message", id: t.ts, quote: "I grabbed the params from the July 3 sheet." },
          ],
          inferred: ["Array input assumed zero.", "Optional loop excluded and two 20 minute swaps taken from the request text."],
          resolution: "Juno confirms v2-1, or Milo states v2-0 is intentionally used for a KS-3 comparison. The v2-1 result is blocked on that confirmation.",
          question: { to: "Juno Marsh", ask: "Should this run use v2-1 (318 kg, Crr 0.0048) as Milo's July 24 message requires?" },
        });
      },
      () => undefined,
    ],
  };
}

export function routeFinding(ctx: ScriptContext, triggerTs: string, revision: string, socEnd: number, supersedes?: string) {
  const c = routeCases(ctx.checker!).mass_318kg!;
  return publish({
    run_id: ctx.checker!.run_id,
    requirements_revision: revision,
    discrepancy: `Under v2-1 the segment at 22 m/s is ${c.feasible ? "" : "not "}feasible at end SoC ${socEnd * 100} percent (${c.energy_kWh} kWh against ${c.budget_kWh} kWh).`,
    why_it_matters: "The request used v2-0; v2-1 supersedes it.",
    sources: [{ kind: "message", id: triggerTs, quote: "I grabbed the params from the July 3 sheet." }],
    inferred: ["Array input assumed zero."],
    resolution: "Juno confirms v2-1.",
    supersedes,
  });
}

function rc3Midrun(messages: FixtureMessage[]): Script {
  const t = trigger(messages);
  const change = messages.find((m) => m.role === "change");
  assert.ok(change, "rc3 fixture has no change message");
  let injected = false;
  return {
    steps: [
      () => readThread,
      () => routeCheck({ ...ROUTE_V21, soc_end: 0.4 }),
      (ctx) => routeFinding(ctx, t.ts, t.ts, 0.4),
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
        return routeFinding(ctx, t.ts, refusal.current_revision, 0.35);
      },
      () => undefined,
    ],
    afterChecker: () => {
      if (injected) return undefined;
      injected = true;
      return change;
    },
  };
}

/** Read the thread and stay silent. The default for cases without a script. */
function silent(): Script {
  return { steps: [() => readThread, () => undefined] };
}

const SCRIPTS: Record<string, (messages: FixtureMessage[]) => Script> = {
  "scenario-a": scenarioA,
  "scenario-b": scenarioB,
  "rc1-clean": rc1Clean,
  "rc2-conflict": rc2Conflict,
  "rc3-midrun": rc3Midrun,
};

export const scriptedCases = Object.keys(SCRIPTS);

export function hasScript(caseName: string): boolean {
  return Object.hasOwn(SCRIPTS, caseName);
}

/** The script for a case; unknown cases read the thread and stay silent. */
export function scriptFor(caseName: string, messages: FixtureMessage[]): Script {
  const build = SCRIPTS[caseName] ?? silent;
  return build(messages);
}
