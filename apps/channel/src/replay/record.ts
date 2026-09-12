/**
 * The run record: the seam between the replay harness and the eval lane.
 * Field names are frozen by record.test.tsx; see
 * research/handoff-eval-lane.md section 4.
 */
import { finding, type CheckerResponse, type Finding } from "agent-core";
import { latestRevision } from "../revision";
import { toTranscript } from "./fixture-loader";
import type { ReplayResult } from "./harness";

export type RunMode = "scripted" | "model";

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: unknown;
}

export interface RunRecord {
  case: string;
  run: number;
  mode: RunMode;
  model: string | null;
  trigger_ts: string;
  current_revision: string;
  tool_calls: ToolCallRecord[];
  checker_runs: CheckerResponse[];
  posted_cards: Finding[];
  replaced_cards: Finding[];
  failure: string | null;
}

/** The exact key order of a record. record.test.tsx asserts this. */
export const RECORD_FIELDS = [
  "case",
  "run",
  "mode",
  "model",
  "trigger_ts",
  "current_revision",
  "tool_calls",
  "checker_runs",
  "posted_cards",
  "replaced_cards",
  "failure",
] as const;

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

/** Pair every assistant tool call with its tool result, in call order. */
export function toolCallTrace(messages: ReplayResult["agentMessages"]): ToolCallRecord[] {
  const results = new Map<string, unknown>();
  for (const m of messages) {
    if (m.role === "tool") results.set(m.toolCallId, parseJson(m.content));
  }
  const trace: ToolCallRecord[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !m.toolCalls) continue;
    for (const call of m.toolCalls) {
      trace.push({
        name: call.function.name,
        args: parseJson(call.function.arguments),
        result: results.get(call.id) ?? null,
      });
    }
  }
  return trace;
}

export interface RecordInput {
  caseName: string;
  run: number;
  mode: RunMode;
  model: string | null;
  result: ReplayResult;
}

/**
 * Cards come from the thread state publish_result wrote, cross-checked
 * against the delivered Slack payloads: a card is `posted` only if a
 * `slack.message.create` carried its finding_id, and `replaced` only if a
 * `slack.message.replace` did. A finding in state that never reached Slack is
 * dropped, so the record describes what the thread saw.
 */
export function toRecord({ caseName, run, mode, model, result }: RecordInput): RunRecord {
  const trigger = result.state.visible.find((m) => m.role === "trigger");
  if (!trigger) throw new Error(`${caseName}: no trigger message in the visible fixture`);
  const byId = new Map<string, Finding>();
  for (const card of result.threadState?.cards ?? []) {
    const parsed = finding.parse(card.finding);
    byId.set(parsed.finding_id, parsed);
  }
  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const f = byId.get(id);
      return f ? [f] : [];
    });
  const failure = result.failure;
  return {
    case: caseName,
    run,
    mode,
    model,
    trigger_ts: trigger.ts,
    // The same rule the live publish_result applies, over the messages as
    // thread.getMessages() served them when the run ended. A change message
    // therefore reads as the transcript's ISO occurredAt; with no change the
    // fallback is the trigger's Slack ts. Cards bind to the same strings.
    current_revision: latestRevision(
      toTranscript(result.state.visible, trigger.ts).messages.map((m) => ({
        ts: m.occurredAt,
        text: m.text,
        isBot: false,
      })),
      trigger.ts,
    ),
    tool_calls: toolCallTrace(result.agentMessages),
    checker_runs: result.state.checkerRuns,
    posted_cards: pick(result.postedCards.map((c) => c.findingId)),
    replaced_cards: pick(result.replacedCards.map((c) => c.findingId)),
    failure:
      failure === undefined || failure === null
        ? null
        : failure instanceof Error
          ? failure.message
          : String(failure),
  };
}
