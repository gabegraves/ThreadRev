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
export const searchWorkspace = (args: Record<string, unknown>): ToolCall => ({ name: "search_workspace", args });
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

/** Workspace hits as the scripted reviewer sees them (see WorkspaceHit in ../workspace). */
const workspaceHits = (ctx: ScriptContext) => {
  const r = ctx.results.find((x) => x && typeof x === "object" && "hits" in (x as object)) as
    | { hits: Array<{ ts: string; channel: string; from: string; text: string; is_change: boolean; values: Array<{ value: number; unit: string }> }> }
    | undefined;
  assert.ok(r, "no search_workspace result in context");
  return r.hits;
};
const rcTimes = (res: CheckerResponse) =>
  res.outputs.per_capacitance as Record<string, { t_threshold_s: number; fraction_at_timer: number }>;

/**
 * Scenario A, cross-channel: the thread is the r2 seed, Tam, and Juno's
 * trigger. Dara's 820 uF correction was posted two weeks earlier in
 * #ks4-purchasing. The r2 document ignores it. The reviewer must find it
 * with search_workspace, not from the thread.
 */
function scenarioACross(messages: FixtureMessage[]): Script {
  const t = trigger(messages);
  const seed = messages[0]!;
  return {
    steps: [
      () => readThread,
      () => searchWorkspace({ unit: "uF", quantity: "bus capacitance snubber" }),
      (ctx) => {
        const hits = workspaceHits(ctx);
        const correction = hits.find((h) => h.values.some((v) => v.value === 820 && v.unit === "uF"));
        assert.ok(correction, `search_workspace did not return the 820 uF correction: ${JSON.stringify(hits.map((h) => h.text))}`);
        assert.equal(correction.channel, "#ks4-purchasing");
        return readEvidence("precharge-review-r2.docx");
      },
      () =>
        rcCheck({
          R_ohm: 470,
          threshold: 0.999,
          timer_s: 2.5,
          capacitances: [
            { label: "680uF_text", C_F: 0.00068 },
            { label: "750uF_diagram", C_F: 0.00075 },
            { label: "820uF_purchasing", C_F: 0.00082 },
            { label: "2mF_example", C_F: 0.002 },
          ],
          printed: [
            { label: "printed_2.435", value_s: 2.435, against: ["680uF_text", "750uF_diagram", "820uF_purchasing"] },
            { label: "printed_6.91", value_s: 6.91, against: ["2mF_example"] },
          ],
        }),
      (ctx) => {
        const doc = ctx.evidence[0]!;
        const hits = workspaceHits(ctx);
        const correction = hits.find((h) => h.values.some((v) => v.value === 820 && v.unit === "uF"))!;
        const times = rcTimes(ctx.checker!);
        const t820 = times["820uF_purchasing"]!;
        return publish({
          run_id: ctx.checker!.run_id,
          requirements_revision: t.ts,
          discrepancy: `Section 3 states 680 uF, the section 2 diagram states 750 uF, and the printed 2.435 s reproduces only with 750 uF. Neither is the project's current bus: Dara's 2026-08-05 message in #ks4-purchasing added a 140 uF snubber bank, bus 820 uF, and r2 does not mention it. At 820 uF t_99.9 = ${t820.t_threshold_s} s, later than the 2.5 s relay timer. Section 4 prints 6.91 s; recomputed ${times["2mF_example"]!.t_threshold_s} s.`,
          why_it_matters: `If the snubber bank is on the bus, the relay closes at 2.5 s with the bus at ${(t820.fraction_at_timer * 100).toFixed(2)} percent, short of the 99.9 percent criterion. The review cannot be signed against r2's stated basis.`,
          sources: [
            docSource(doc, /Bus capacitance C = 750 uF/),
            docSource(doc, /t_99\.9 = -470 \* 750e-6/),
            { kind: "message", id: seed.ts, locator: "#ks4-electrical", quote: "Dropped one film cap, bus is now 680 uF." },
            { kind: "message", id: correction.ts, locator: correction.channel, quote: correction.text.slice(0, 300) },
          ],
          inferred: ["That the snubber bank is on the precharged bus is read from Dara's purchasing message, not from a schematic."],
          resolution: "Dara confirms whether the 820 uF bus with the snubber bank is what r2 should describe, and updates the diagram, section 3, and section 4. If 820 uF stands, the timer question goes to Tam.",
          question: { to: "Dara Voss", ask: "Is the bus 820 uF with the snubber bank from PO-2261, as your August 5 message in #ks4-purchasing says, or 680 uF as r2 states?" },
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
  "scenario-a-cross": scenarioACross,
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
