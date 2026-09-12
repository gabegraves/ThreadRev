import { AbstractAgent } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { makeAgent, REVIEWER_PROMPT } from "agent-core";
import { Observable, type Subscription } from "rxjs";

type ChannelAgentFactory = (threadId: string) => AbstractAgent;

/** The reviewer's "nothing to say" reply. Suppressed before it reaches Slack. */
export const SILENCE = /^\s*NO_FINDING\b/;

/**
 * Buffers each text message until its END event and drops it when it is the
 * silence token, so a NO_FINDING turn posts nothing. Everything else passes
 * through in order.
 */
export function silenceFilter(next: (event: BaseEvent) => void) {
  let buffer: BaseEvent[] | undefined;
  let text = "";
  const flush = () => {
    if (!buffer) return;
    const held = buffer;
    buffer = undefined;
    for (const e of held) next(e);
  };
  const forward = (event: BaseEvent) => {
    if (event.type === EventType.TEXT_MESSAGE_START) {
      flush();
      buffer = [event];
      text = "";
      return;
    }
    if (buffer) {
      if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
        buffer.push(event);
        text += (event as { delta?: string }).delta ?? "";
        return;
      }
      if (event.type === EventType.TEXT_MESSAGE_END) {
        buffer.push(event);
        if (SILENCE.test(text)) buffer = undefined;
        else flush();
        return;
      }
      flush();
    }
    next(event);
  };
  forward.flush = flush;
  return forward;
}

/**
 * Channel-only facade that keeps AG-UI transcript/state on the outer agent while
 * delegating each low-level run to a fresh BuiltInAgent instance.
 *
 * Channels may re-enter the same turn after tool results as soon as the previous
 * observable completes. BuiltInAgent clears its private abort controller later,
 * in its async cleanup, so reusing one instance can trip its reentry guard. This
 * facade leaves AbstractAgent.runAgent untouched and swaps only run(input), which
 * gives every invocation a clean inner agent without changing the shared web and
 * mobile makeAgent factory.
 */
export class ChannelRunAgent extends AbstractAgent {
  private activeInner: AbstractAgent | undefined;

  constructor(
    private agentFactory: ChannelAgentFactory = makeAgent,
    threadId?: string,
  ) {
    super({ threadId });
  }

  override run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      let inner: AbstractAgent | undefined;
      let subscription: Subscription | undefined;

      const release = () => {
        if (this.activeInner === inner) {
          this.activeInner = undefined;
        }
      };

      try {
        inner = this.agentFactory(input.threadId);
        inner.threadId = input.threadId;
        this.activeInner = inner;
        const forward = silenceFilter((event) => subscriber.next(event));
        subscription = inner.run(input).subscribe({
          next: forward,
          error: (error) => {
            release();
            subscriber.error(error);
          },
          complete: () => {
            forward.flush();
            release();
            subscriber.complete();
          },
        });
      } catch (error) {
        release();
        subscriber.error(error);
      }

      return () => {
        subscription?.unsubscribe();
        inner?.abortRun();
        release();
      };
    });
  }

  override abortRun() {
    this.activeInner?.abortRun();
    super.abortRun();
  }

  override clone(): ChannelRunAgent {
    const cloned = super.clone() as ChannelRunAgent;
    cloned.agentFactory = this.agentFactory;
    cloned.activeInner = undefined;
    return cloned;
  }
}

export function makeChannelAgent(threadId: string) {
  return new ChannelRunAgent(
    (id) => makeAgent(id, { prompt: REVIEWER_PROMPT, workplace: false }),
    threadId,
  );
}
