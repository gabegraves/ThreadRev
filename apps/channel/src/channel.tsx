import { createChannel } from "@copilotkit/channels";
import { makeChannelAgent, runReviewer } from "./agent";
import { required } from "./env";
import { reviewerWelcome } from "./finding-card";
import { proposeEdit, publishResult, readEvidence, readThread, runCheck, searchWorkspace } from "./reviewer-tools";
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

// An @-mention is always a review request.
channel.onMention(async ({ thread }) => {
  await runReviewer(thread);
});

// Every other message in an invited channel passes through the cheap gate
// first. The model only runs on review moments; it can still decide NO_FINDING.
channel.onMessage(async ({ thread, message }) => {
  const moment = isReviewMoment({
    text: message.text,
    hasFiles: (message.contentParts?.length ?? 0) > 0,
    isBot: message.actor.kind !== "human",
  });
  if (!moment) {
    record({ kind: "silence", thread: thread.conversationKey, reason: "gate_closed" });
    return;
  }
  await runReviewer(thread);
});

channel.onWelcome(async ({ thread, platform }) => {
  await thread.post(reviewerWelcome(platform));
});
