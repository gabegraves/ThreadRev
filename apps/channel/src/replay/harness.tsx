/**
 * Offline replay harness: a fixture Slack script replayed into the real
 * reviewer tools with a scripted agent standing in for the model.
 *
 * Follows delivery.test.tsx. The ManagedGateway captures every packet the
 * channel would send to Slack; the `/transcript` route serves the fixture's
 * visible messages so the real `read_thread` and `publish_result` see them.
 */
import assert from "node:assert/strict";
import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { from, type Observable } from "rxjs";
import { createChannel, defineChannelTool } from "@copilotkit/channels";
import { startChannelsWithGatewayControl } from "@copilotkit/channels-intelligence";
import { z } from "zod";
import { type CheckerResponse } from "agent-core";
import {
  proposeEdit,
  publishResult,
  readEvidence,
  readThread,
  rememberRun,
  runCheck,
  searchWorkspace,
} from "../reviewer-tools";
import { ManagedGateway, preparedDelivery } from "../testing/managed-gateway";
import { splitAtCutoff, toTranscript, type FixtureMessage } from "./fixture-loader";
import { runChecker } from "./run-checker";

export interface ToolCall {
  name: string;
  args: unknown;
}

/** Tool results the scripted reviewer has received so far, in order. */
export interface ScriptContext {
  results: unknown[];
  /** The last checker response, if any checker call completed. */
  checker?: CheckerResponse;
  checkers: CheckerResponse[];
  /** Every publish_result return so far. */
  publishes: PublishOutcome[];
  /** Every read_evidence return so far. */
  evidence: EvidenceResult[];
}

/** One step: returns the tool call to make, or undefined to finish the run. */
export type ScriptStep = (ctx: ScriptContext) => ToolCall | undefined;

export type PublishOutcome =
  | { published: true; finding_id: string; requirements_revision: string }
  | { published: false; reason: string; current_revision?: string };

export interface EvidenceResult {
  document: string;
  revision?: string;
  sha256: string;
  lines: Array<{ n: number; text: string }>;
}

/** Thread state the real publish_result keeps (see reviewer-tools.tsx). */
export interface ReviewThreadState {
  cards: Array<{ finding: { finding_id: string; status: string; requirements_revision: string; checker_run: { run_id: string } } }>;
  staleRuns: Array<{ run_id: string; bound: string; current: string }>;
}

/** Thread state the harness owns. */
export interface ReplayState {
  visible: FixtureMessage[];
  checkerRuns: CheckerResponse[];
}

const checkerResponseIsh = z.object({ run_id: z.string(), checker: z.string(), outputs: z.record(z.string(), z.unknown()) });
const publishIsh = z.object({ published: z.boolean() });
const evidenceIsh = z.object({ document: z.string(), sha256: z.string(), lines: z.array(z.object({ n: z.number(), text: z.string() })) });

/**
 * Real AG-UI events so the SDK tool loop and Slack renderer both run.
 *
 * Stateless per run, like a model: the step to take is the number of tool
 * results already in the input messages. That lets ChannelRunAgent hand each
 * run a fresh instance (the live wrapper's behaviour) without losing place.
 */
export class ScriptedReviewer extends AbstractAgent {
  constructor(private readonly steps: ScriptStep[]) {
    super();
  }
  override clone(): ScriptedReviewer {
    const clone = new ScriptedReviewer(this.steps);
    clone.threadId = this.threadId;
    clone.setMessages([...this.messages]);
    clone.setState(this.state);
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
    const pick = <T,>(schema: z.ZodType<T>) =>
      results.flatMap((r) => (schema.safeParse(r).success ? [r as T] : []));
    const checkers = pick(checkerResponseIsh) as unknown as CheckerResponse[];
    const iteration = results.length;
    const step = this.steps[iteration];
    const call = step?.({
      results,
      checker: checkers.at(-1),
      checkers,
      publishes: pick(publishIsh) as PublishOutcome[],
      evidence: pick(evidenceIsh) as EvidenceResult[],
    });
    const events: BaseEvent[] = [
      { type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId },
    ];
    if (call) {
      const toolCallId = `tool_${iteration + 1}`;
      events.push(
        { type: EventType.TOOL_CALL_START, toolCallId, toolCallName: call.name },
        { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(call.args) },
        { type: EventType.TOOL_CALL_END, toolCallId },
      );
    }
    events.push({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
    return from(events);
  }
}

export interface ReplayOptions {
  messages: FixtureMessage[];
  /** Scripted reviewer steps. Ignored when `agent` is given. */
  steps?: ScriptStep[];
  /**
   * Model mode: a factory for the real agent (makeChannelAgent from
   * ../agent, so the silence filter and per-run BuiltInAgent are identical to
   * the live channel). The channel then also carries the same context entries
   * channel.tsx passes.
   */
  agent?: (threadId: string) => AbstractAgent;
  /** Cutoff ts; defaults to the trigger message. */
  cutoff?: string;
  /**
   * RC3 hook: runs after each checker completes and before the agent can
   * publish. Return a fixture message to make it arrive in the thread now.
   */
  afterChecker?: (response: CheckerResponse, state: ReplayState) => FixtureMessage | undefined;
}

/**
 * The SDK fetches the transcript once per delivery and caches the promise on
 * the claimed delivery. A message that lands mid-run is invisible to
 * `thread.getMessages()` until that cache is dropped. This reaches into the
 * Thread's private deps to drop it; only the replay harness does this.
 */
function dropTranscriptCache(thread: unknown) {
  const deps = (thread as { deps?: { replyTarget?: { claimedDelivery?: { transcriptPromise?: unknown } } } }).deps;
  const claimed = deps?.replyTarget?.claimedDelivery;
  assert.ok(claimed && "transcriptPromise" in claimed, "SDK layout changed: cannot drop the transcript cache");
  claimed.transcriptPromise = undefined;
}

/**
 * Scenario B checker. The real `run_check` is rc-only, so route runs go
 * through this test-local tool and are remembered the same way, which is what
 * the real `publish_result` looks up by run_id.
 */
export function createRouteCheckTool(state: ReplayState, options: ReplayOptions) {
  return defineChannelTool({
    name: "run_route_check",
    description: "Run the trusted route energy checker (Scenario B).",
    parameters: z.object({ inputs: z.record(z.string(), z.unknown()) }),
    async handler({ inputs }, { thread }) {
      const response = await runChecker({ checker: "route", version: "1", inputs });
      rememberRun(response);
      state.checkerRuns.push(response);
      const injected = options.afterChecker?.(response, state);
      if (injected) {
        state.visible.push(injected);
        dropTranscriptCache(thread);
        // Harness self-check: the thread now serves the injected message.
        const seen = await thread.getMessages();
        assert.ok(seen.some((m) => m.text === injected.text), "injected message not visible after cache drop");
      }
      return response;
    },
  });
}

/** Wraps the real rc tool so the harness records the run too. */
function recordingRunCheck(state: ReplayState, options: ReplayOptions) {
  return defineChannelTool({
    name: runCheck.name,
    description: runCheck.description,
    parameters: runCheck.parameters,
    async handler(args, ctx) {
      const result = await runCheck.handler(args, ctx);
      if (checkerResponseIsh.safeParse(result).success) {
        const response = result as CheckerResponse;
        state.checkerRuns.push(response);
        const injected = options.afterChecker?.(response, state);
        if (injected) {
          state.visible.push(injected);
          dropTranscriptCache(ctx.thread);
        }
      }
      return result;
    },
  });
}

/** A finding card as parsed back from the delivered Block Kit text. */
export interface PostedCard {
  kind: "create" | "replace";
  text: string;
  headline: string;
  stale: boolean;
  revision: string;
  runId: string;
  findingId: string;
  supersedes?: string;
  checker: string;
  /** Per reproduced line: true "reproduces", false "does not reproduce", undefined when nothing was printed. */
  matches: Array<boolean | undefined>;
  question?: string;
}

/** The context entries channel.tsx gives the live reviewer. */
export const LIVE_CHANNEL_CONTEXT = [
  {
    description: "Surface",
    value:
      "This is a thread in an engineering team's Slack channel. Others are reading. You were not necessarily addressed; you are here because you read every message in channels you are invited to.",
  },
  {
    description: "Silence",
    value:
      "If this message is not a review moment, or you find nothing worth a card, reply with exactly NO_FINDING and nothing else. That reply is suppressed and nobody sees it.",
  },
];

export interface ReplayResult {
  gateway: ManagedGateway;
  payloads: Record<string, unknown>[];
  failure: unknown;
  agentMessages: AbstractAgent["messages"];
  state: ReplayState;
  heldBack: FixtureMessage[];
  /** Cards posted to the thread, in order, parsed from the Slack payloads. */
  postedCards: PostedCard[];
  /** Cards updated in place (a superseded card marked stale). */
  replacedCards: PostedCard[];
  /** The thread state publish_result left behind. */
  threadState: ReviewThreadState | undefined;
}

/** In-memory stand-in for Intelligence's durable KV, which `thread.state()` uses. */
function withOfflineKv<T>(baseUrl: string, body: () => Promise<T>): Promise<T> {
  const kv = new Map<string, unknown>();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(`${baseUrl}/api/channels/kv/`)) return realFetch(input, init);
    const op = url.slice(url.lastIndexOf("/") + 1);
    const { key, value } = JSON.parse(String(init?.body ?? "{}")) as { key: string; value?: unknown };
    if (op === "set") kv.set(key, value);
    if (op === "delete") kv.delete(key);
    const got = kv.get(key);
    if (op === "consume") kv.delete(key);
    return Response.json({ value: got === undefined ? null : got });
  }) as typeof fetch;
  return body().finally(() => {
    globalThis.fetch = realFetch;
  });
}

export async function runReplay(options: ReplayOptions): Promise<ReplayResult> {
  const split = splitAtCutoff(options.messages, options.cutoff);
  const trigger = split.visible.find((m) => m.role === "trigger");
  assert.ok(trigger, "fixture must contain a trigger message at or before the cutoff");
  const state: ReplayState = { visible: [...split.visible], checkerRuns: [] };
  const agentFactory = options.agent;
  // A real model turn takes seconds per tool call; the scripted reviewer is instant.
  const gateway = new ManagedGateway({ deliverTimeoutMs: agentFactory ? 300_000 : 1_000 });
  if (!agentFactory) assert.ok(options.steps, "runReplay needs either steps or an agent factory");
  const channel = createChannel({
    name: "support",
    identifyUser: "platform",
    showToolStatus: true,
    agent: agentFactory ?? (() => new ScriptedReviewer(options.steps ?? [])),
    // Mirrors channel.tsx. Kept here rather than imported because channel.tsx
    // requires CHANNEL_CODE at import time.
    context: agentFactory ? LIVE_CHANNEL_CONTEXT : [],
    tools: [
      readThread,
      searchWorkspace,
      readEvidence,
      recordingRunCheck(state, options),
      publishResult,
      proposeEdit,
      createRouteCheckTool(state, options),
    ],
  });
  let failure: unknown;
  let threadState: ReviewThreadState | undefined;
  channel.onMessage(async ({ thread }) => {
    try {
      await thread.runAgent();
      threadState = (await thread.state()) as ReviewThreadState | undefined;
    } catch (error) {
      failure = error;
      throw error;
    }
  });
  let agentMessages: AbstractAgent["messages"] = [];
  const appApiBaseUrl = "https://api.example";
  return withOfflineKv(appApiBaseUrl, async () => {
    const handle = await startChannelsWithGatewayControl([channel], {
      session: gateway,
      scope: { projectId: 1, channelName: "support" },
      runtimeInstanceId: "rti_replay",
      loadHistory: async () => [],
      appApiBaseUrl,
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
        postedCards: parseCards(payloads, "slack.message.create"),
        replacedCards: parseCards(payloads, "slack.message.replace"),
        threadState,
      };
    } finally {
      await handle.stop();
    }
  });
}

function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

/** Parse the finding cards out of delivered Block Kit payloads of one kind. */
export function parseCards(payloads: unknown[], kind: "slack.message.create" | "slack.message.replace"): PostedCard[] {
  const cards: PostedCard[] = [];
  for (const payload of payloads) {
    const p = payload as { kind?: string; blocks?: unknown };
    if (p.kind !== kind || !p.blocks) continue;
    const text = stringsIn(p.blocks).join("\n");
    const tail = /(\S+) v(\S+) · run (\S+) · (\S+)(?: · supersedes (\S+))?/.exec(text);
    if (!tail) continue;
    const revision = /Bound to revision\*?\s*\n?\s*(\S+)/.exec(text)?.[1];
    assert.ok(revision, `card without a bound revision: ${text}`);
    const headline = /Review check: [^\n]+|Superseded finding/.exec(text)?.[0] ?? "";
    const matches: Array<boolean | undefined> = [];
    for (const line of text.match(/^• .*$/gm) ?? []) {
      if (/does not reproduce\)/.test(line)) matches.push(false);
      else if (/, reproduces\)/.test(line)) matches.push(true);
      else if (/^• t_99\.9|^• fraction|^• energy|^• budget/.test(line)) matches.push(undefined);
    }
    cards.push({
      kind: kind === "slack.message.create" ? "create" : "replace",
      text,
      headline,
      stale: /Superseded finding/.test(text),
      revision,
      checker: tail[1]!,
      runId: tail[3]!,
      findingId: tail[4]!,
      supersedes: tail[5],
      matches,
      // The Slack renderer emits emphasis as _x_ or *x*; accept either.
      question: /[*_]Question for ([^*_\n]+)[*_]/.exec(text)?.[1],
    });
  }
  return cards;
}
