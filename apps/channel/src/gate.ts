/**
 * What the channel should do with an incoming message.
 *
 * This is the branching that decides whether a person is talking *to* the
 * reviewer, whether the thread is muted, and whether anything is worth a model
 * run — the reviewer's whole speak/stay-silent policy. It used to live inline
 * in channel.onMessage, where nothing could reach it: the replay harness
 * constructs its own channel and registers only the tools, so every one of
 * these branches ran untested while the suite looked green.
 *
 * Pure, so both the live channel and the tests decide the same way. The handler
 * keeps the effects; this keeps the judgement.
 */
import { parseControl, type Control } from "./control";
import { isReviewMoment } from "./review-moment";

export type MessageAction =
  /** A person addressed the reviewer: mute, resume, or show your work. */
  | { kind: "control"; control: Control }
  /** The thread is muted and this was not a control message. */
  | { kind: "muted" }
  /** The gate is closed: nothing here is worth a model run. */
  | { kind: "gate_closed" }
  /** Run the agent. */
  | { kind: "review" };

export interface IncomingMessage {
  text: string;
  hasFiles: boolean;
  isHuman: boolean;
  /** Whether a person has already told the reviewer to stand down here. */
  muted: boolean;
}

/**
 * Order matters, and each step earns its place.
 *
 * Control first: "stand down" has to work on the turn it is said, including
 * while the thread is already muted, because "resume" is how a mute is undone.
 * Mute second: a muted thread is silent even for a message that would
 * otherwise be a review moment. The gate last, since it is the cheap filter in
 * front of the model rather than a policy about who is talking.
 */
export function decideMessage(m: IncomingMessage): MessageAction {
  const control = parseControl(m.text, m.isHuman);
  if (control) return { kind: "control", control };
  if (m.muted) return { kind: "muted" };
  if (!isReviewMoment({ text: m.text, hasFiles: m.hasFiles, isBot: !m.isHuman })) {
    return { kind: "gate_closed" };
  }
  return { kind: "review" };
}
