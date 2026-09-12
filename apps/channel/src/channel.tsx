import { createChannel } from "@copilotkit/channels";
import { makeChannelAgent } from "./agent";
import { required } from "./env";
import { reviewerWelcome } from "./finding-card";
import { proposeEdit, publishResult, readEvidence, readThread, runCheck, searchWorkspace, type ReviewState } from "./reviewer-tools";
import { controlAck, parseControl } from "./control";
import { isReviewMoment } from "./review-moment";
import { record } from "./evidence";

export const channel = createChannel({
  // Must equal the Channel Code in Intelligence, character for character.
  name: required("CHANNEL_CODE"),
  identifyUser: "platform",
  agent: makeChannelAgent,
  tools: [readThread, searchWorkspace, readEvidence, runCheck, publishResult, proposeEdit],
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
    state.muted = false;
    await thread.setState(state);
  }
  await thread.runAgent();
});

// Every other message in an invited channel passes through the cheap gate
// first. The model only runs on review moments; it can still decide NO_FINDING.
channel.onMessage(async ({ thread, message }) => {
  const human = message.actor.kind === "human";

  // A person telling the reviewer to stop outranks everything below, and has
  // to take effect on the turn it is said rather than after a model round trip.
  const control = parseControl(message.text, human);
  if (control) {
    const state = ((await thread.state()) as ReviewState | undefined) ?? { cards: [], staleRuns: [] };
    state.muted = control === "mute";
    await thread.setState(state);
    await thread.post(controlAck(control));
    return;
  }

  const state = (await thread.state()) as ReviewState | undefined;
  if (state?.muted) {
    record({ kind: "silence", thread: thread.conversationKey, reason: "gate_closed" });
    return;
  }

  const moment = isReviewMoment({
    text: message.text,
    hasFiles: (message.contentParts?.length ?? 0) > 0,
    isBot: !human,
  });
  if (!moment) {
    record({ kind: "silence", thread: thread.conversationKey, reason: "gate_closed" });
    return;
  }
  await thread.runAgent();
});

channel.onWelcome(async ({ thread, platform }) => {
  await thread.post(reviewerWelcome(platform));
});
