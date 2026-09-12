/**
 * Offline replay harness: a fixture Slack script replayed into real channel
 * handlers with a scripted agent standing in for the model.
 *
 * Follows delivery.test.tsx. The ManagedGateway captures every packet the
 * channel would send to Slack; the `/transcript` route serves the fixture's
 * visible messages so `read_thread` returns them verbatim.
 */
import assert from "node:assert/strict";
import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { from, type Observable } from "rxjs";
import {
  createChannel,
  defineChannelTool,
  Message,
  Header,
  Section,
  Markdown,
  Context,
} from "@copilotkit/channels";
import { startChannelsWithGatewayControl } from "@copilotkit/channels-intelligence";
import { z } from "zod";
import {
  checkerRequest,
  finding,
  type CheckerResponse,
  type Finding,
} from "agent-core";
import { readThread } from "../tools";
import { ManagedGateway, preparedDelivery } from "../testing/managed-gateway";
import {
  splitAtCutoff,
  toTranscript,
  type FixtureMessage,
} from "./fixture-loader";
import { runChecker } from "./run-checker";
import { guardPublish, markStale } from "./publish-guard";

export interface ToolCall {
  name: string;
  args: unknown;
}

/** Tool results the scripted reviewer has received so far, in order. */
export interface ScriptContext {
  results: unknown[];
  /** The last checker response, parsed, if any run_checker call completed. */
  checker?: CheckerResponse;
  /** Every checker response so far. */
  checkers: CheckerResponse[];
  /** Every publish_result return so far. */
  publishes: PublishOutcome[];
}

/** One step: returns the tool call to make, or undefined to finish the run. */
export type ScriptStep = (ctx: ScriptContext) => ToolCall | undefined;

export type PublishOutcome =
  | { published: true; finding_id: string; revision: string }
  | {
      published: false;
      reason: "stale_revision";
      finding_id: string;
      run_id: string;
      card_revision: string;
      current_revision: string;
      instruction: string;
    };

/** A finding the harness stored, live or stale, with its checker run. */
export interface FindingRecord {
  finding: Finding;
  checker: CheckerResponse | undefined;
}

/** Thread state the harness owns on behalf of the integration owner. */
export interface ReplayState {
  currentRequirementsRevision: string;
  visible: FixtureMessage[];
  records: FindingRecord[];
  checkerRuns: CheckerResponse[];
}

const checkerResponseIsh = z.object({ run_id: z.string(), checker: z.string() });

/** Real AG-UI events so the SDK tool loop and Slack renderer both run. */
class ScriptedReviewer extends AbstractAgent {
  private iteration = 0;
  constructor(private readonly steps: ScriptStep[]) {
    super();
  }
  override clone(): ScriptedReviewer {
    const clone = new ScriptedReviewer(this.steps);
    clone.threadId = this.threadId;
    clone.setMessages([...this.messages]);
    clone.setState(this.state);
    clone.iteration = this.iteration;
    return clone;
  }
  run(input: RunAgentInput): Observable<BaseEvent> {
    const results = input.messages
      .filter((m) => m.role === "tool")
      .map((m) => {
        try {
          return JSON.parse(String(m.content)) as unknown;
        } catch {
          return m.content;
        }
      });
    const checkers = results.flatMap((r) => {
      const parsed = checkerResponseIsh.safeParse(r);
      return parsed.success ? [r as CheckerResponse] : [];
    });
    const publishes = results.flatMap((r) =>
      typeof r === "object" && r !== null && "published" in r
        ? [r as PublishOutcome]
        : [],
    );
    const step = this.steps[this.iteration++];
    const call = step?.({
      results,
      checker: checkers.at(-1),
      checkers,
      publishes,
    });
    const events: BaseEvent[] = [
      { type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId },
    ];
    if (call) {
      const toolCallId = `tool_${this.iteration}`;
      events.push(
        { type: EventType.TOOL_CALL_START, toolCallId, toolCallName: call.name },
        { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(call.args) },
        { type: EventType.TOOL_CALL_END, toolCallId },
      );
    }
    events.push({
      type: EventType.RUN_FINISHED,
      threadId: input.threadId,
      runId: input.runId,
    });
    return from(events);
  }
}

export interface ReplayOptions {
  messages: FixtureMessage[];
  steps: ScriptStep[];
  /** Cutoff ts; defaults to the trigger message. */
  cutoff?: string;
  /**
   * RC3 hook: runs after each checker completes and before the agent can
   * publish. Return a message to inject it into the thread as the new
   * requirements revision.
   */
  afterChecker?: (
    response: CheckerResponse,
    state: ReplayState,
  ) => FixtureMessage | undefined;
}

export function createRunCheckerTool(state: ReplayState, options: ReplayOptions) {
  return defineChannelTool({
    name: "run_checker",
    description:
      "Run a trusted stdlib checker on explicit inputs. Every number a card shows must come from this result, never from your own arithmetic.",
    parameters: checkerRequest,
    async handler(args) {
      const response = await runChecker(args);
      state.checkerRuns.push(response);
      const injected = options.afterChecker?.(response, state);
      if (injected) {
        state.visible.push(injected);
        state.currentRequirementsRevision = injected.ts;
      }
      return response;
    },
  });
}

export function createPublishResultTool(state: ReplayState) {
  return defineChannelTool({
    name: "publish_result",
    description:
      "Publish a finding card bound to the requirements revision it was computed against. Refused when the thread has moved on; the refused card is kept as a stale record and you must rerun the checker against the current revision.",
    parameters: finding,
    async handler(card, { thread }): Promise<PublishOutcome> {
      const checker = state.checkerRuns.find(
        (run) => run.run_id === card.checker_run.run_id,
      );
      const decision = guardPublish(card, state.currentRequirementsRevision);
      if (!decision.ok) {
        state.records.push({ finding: markStale(card), checker });
        return {
          published: false,
          reason: decision.reason,
          finding_id: card.finding_id,
          run_id: card.checker_run.run_id,
          card_revision: decision.cardRevision,
          current_revision: decision.currentRevision,
          instruction:
            "The thread's requirements changed after this checker run started. The run is recorded as stale. Read the thread again, rerun the checker against the current revision, and publish a card bound to it.",
        };
      }
      const live: Finding = { ...card, status: "live" };
      state.records.push({ finding: live, checker });
      // TODO(integration owner): swap for <FindingCard> from ../components
      // once it lands. Until then the card is the finding JSON in a Markdown
      // block so the replay test can parse it back.
      await thread.post(
        <Message accent={live.discrepancy === "none" ? "#2E7D5B" : "#8A5C10"}>
          <Header>{live.discrepancy === "none" ? "No discrepancy" : "Finding"}</Header>
          <Section>
            <Markdown>{JSON.stringify(live)}</Markdown>
          </Section>
          <Context>{`checker ${live.checker_run.checker} run ${live.checker_run.run_id}`}</Context>
        </Message>,
      );
      return { published: true, finding_id: live.finding_id, revision: decision.revision };
    },
  });
}

export interface ReplayResult {
  gateway: ManagedGateway;
  payloads: Record<string, unknown>[];
  failure: unknown;
  agentMessages: AbstractAgent["messages"];
  state: ReplayState;
  heldBack: FixtureMessage[];
  /** Findings posted to the thread, parsed back out of the Slack payloads. */
  postedCards: Finding[];
}

export async function runReplay(options: ReplayOptions): Promise<ReplayResult> {
  const split = splitAtCutoff(options.messages, options.cutoff);
  const trigger = split.visible.find((m) => m.role === "trigger");
  assert.ok(trigger, "fixture must contain a trigger message at or before the cutoff");
  const state: ReplayState = {
    currentRequirementsRevision: split.cutoff,
    visible: [...split.visible],
    records: [],
    checkerRuns: [],
  };
  const gateway = new ManagedGateway();
  const channel = createChannel({
    name: "support",
    identifyUser: "platform",
    showToolStatus: true,
    agent: () => new ScriptedReviewer(options.steps),
    tools: [
      readThread,
      createRunCheckerTool(state, options),
      createPublishResultTool(state),
    ],
  });
  let failure: unknown;
  channel.onMessage(async ({ thread }) => {
    try {
      await thread.runAgent();
    } catch (error) {
      failure = error;
      throw error;
    }
  });
  let agentMessages: AbstractAgent["messages"] = [];
  const handle = await startChannelsWithGatewayControl([channel], {
    session: gateway,
    scope: { projectId: 1, channelName: "support" },
    runtimeInstanceId: "rti_replay",
    loadHistory: async () => [],
    appApiBaseUrl: "https://api.example",
    apiKey: "cpk-offline-test",
    appApiFetch: async (input) => {
      if (String(input).endsWith("/charge")) return Response.json({ charged: true });
      assert.ok(String(input).endsWith("/transcript"), `Unexpected request: ${input}`);
      return Response.json(toTranscript(state.visible, trigger.ts));
    },
    runCanonical: async (args) => {
      const result = await args.execute({}, { threadId: args.threadId, runId: args.runId });
      agentMessages = args.agent.messages;
      return result;
    },
  });
  try {
    await gateway.deliver(
      preparedDelivery("replay_fixture", "slack", { kind: "text", text: trigger.text }),
    );
    const payloads = gateway.packets.map(({ payload }) => payload as Record<string, unknown>);
    return {
      gateway,
      payloads,
      failure,
      agentMessages,
      state,
      heldBack: split.heldBack,
      postedCards: postedFindings(payloads),
    };
  } finally {
    await handle.stop();
  }
}

/** Walk every string in the Slack payloads and parse back any finding JSON. */
export function postedFindings(payloads: unknown[]): Finding[] {
  const found: Finding[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (!value.includes('"finding_id"')) return;
      const start = value.indexOf("{");
      const end = value.lastIndexOf("}");
      if (start < 0 || end <= start) return;
      const text = value
        .slice(start, end + 1)
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      try {
        found.push(finding.parse(JSON.parse(text)));
      } catch {
        // not a finding
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  for (const payload of payloads) {
    if ((payload as { kind?: string }).kind === "slack.message.create") visit(payload);
  }
  return found;
}
