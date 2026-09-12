import { createChannel } from "@copilotkit/channels";
import { makeChannelAgent } from "./agent";
import { required } from "./env";
import { reviewerWelcome } from "./finding-card";
import {
  publishResult,
  readEvidence,
  readThread,
  runCheck,
  searchWorkspace,
  type ReviewState,
  type StateThread,
  updateReviewState,
} from "./reviewer-tools";
import { controlAck } from "./control";
import { decideMessage } from "./gate";
import { renderWorkTrail } from "./work-trail";
// agent-core also exports a readEvidence — the evidence LOG reader. The channel
// tool of the same name reads documents. Renamed here so the two never blur.
import { readEvidence as readEvidenceLog } from "agent-core";
import { record } from "./evidence";

export const channel = createChannel({
  // Must equal the Channel Code in Intelligence, character for character.
  name: required("CHANNEL_CODE"),
  identifyUser: "platform",
  agent: makeChannelAgent,
  tools: [readThread, searchWorkspace, readEvidence, runCheck, publishResult],
  components: [],
  context: [
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
  ],
});

// An @-mention is always a review request, and asking directly lifts a mute:
// the person who silenced it can still get an answer by asking for one.
channel.onMention(async ({ thread }) => {
  const state = (await thread.state()) as ReviewState | undefined;
  if (state?.muted) {
    await updateReviewState(thread as unknown as StateThread, (s) => {
      s.muted = false;
    });
  }
  await thread.runAgent();
});

// Every other message in an invited channel passes through the cheap gate
// first. The model only runs on review moments; it can still decide NO_FINDING.
channel.onMessage(async ({ thread, message }) => {
  const state = (await thread.state()) as ReviewState | undefined;
  const action = decideMessage({
    text: message.text,
    hasFiles: (message.contentParts?.length ?? 0) > 0,
    isHuman: message.actor.kind === "human",
    muted: Boolean(state?.muted),
  });

  // A switch rather than an if-chain ending in runAgent, deliberately. The
  // chain meant any action kind nobody had handled fell through to running the
  // model — fail-open in the one place that decides whether the reviewer
  // speaks at all. Here an unhandled kind is a compile error.
  switch (action.kind) {
    case "control": {
      if (action.control === "explain") {
        // readEvidence reads the whole log and reports how many lines it could
        // not parse; the trail is per-thread, so filter here.
        const { events } = readEvidenceLog();
        await thread.post(
          renderWorkTrail(events.filter((e) => e.thread === thread.conversationKey)),
        );
        return;
      }
      // Through updateReviewState, not a write of the `state` read at the top of
      // this handler: that copy is as old as this message, and writing it back
      // whole would overwrite any card or run recorded since.
      await updateReviewState(thread as unknown as StateThread, (s) => {
        s.muted = action.control === "mute";
      });
      await thread.post(controlAck(action.control));
      return;
    }
    case "muted":
    case "gate_closed":
      record({ kind: "silence", thread: thread.conversationKey, reason: "gate_closed" });
      return;
    case "review":
      await thread.runAgent();
      return;
    default: {
      const unhandled: never = action;
      void unhandled;
    }
  }
});

channel.onWelcome(async ({ thread, platform }) => {
  await thread.post(reviewerWelcome(platform));
});
