import { test } from "node:test";
import assert from "node:assert/strict";
import { isReviewMoment } from "./review-moment";
import { latestRevision } from "./revision";
import { guardPublish } from "./replay/publish-guard";

test("attachments and review vocabulary open the gate", () => {
  assert.equal(isReviewMoment({ text: "r2 review doc is up", hasFiles: true }), true);
  assert.equal(isReviewMoment({ text: "@Rev can you check section 3 before I sign the review?" }), true);
  assert.equal(isReviewMoment({ text: "Correction: bus is 820 uF, not 680. Doc will be r3." }), true);
});

test("normal engineering chatter stays closed", () => {
  assert.equal(isReviewMoment({ text: "lunch at 12:30? I'll grab the 470 ohm resistors on the way" }), false);
  assert.equal(isReviewMoment({ text: "Relay timer is 2.5 s in firmware, matches." }), false);
  assert.equal(isReviewMoment({ text: "anything", isBot: true }), false);
});

test("latest revision is the newest human change message", () => {
  const msgs = [
    { ts: "1787062320.000100", text: "Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF." },
    { ts: "1787064000.000200", text: "Relay close timer in firmware is 2.5 s, matches the doc." },
    { ts: "1787166300.000300", text: "@Rev can you check section 3 of the r2 doc before I sign the review?" },
    { ts: "1787171400.000400", text: "Correction: adding a 140 uF snubber bank. Bus is 820 uF, not 680. Doc will be r3." },
    { ts: "1787171500.000500", text: "card posted", isBot: true },
  ];
  assert.equal(latestRevision(msgs.slice(0, 3), "1787166300.000300"), "1787166300.000300");
  assert.equal(latestRevision(msgs, "1787166300.000300"), "1787171400.000400");
});

test("publish guard refuses a card bound to a different revision", () => {
  const live = { status: "live" as const, requirements_revision: "1787062320.000100" };
  assert.equal(guardPublish(live, "1787171400.000400").ok, false);
  assert.equal(guardPublish(live, "1787062320.000100").ok, true);
});

import { EventType, type BaseEvent } from "@ag-ui/core";
import { silenceFilter } from "./agent";

function textRun(text: string): BaseEvent[] {
  return [
    { type: EventType.TEXT_MESSAGE_START, messageId: "m1", role: "assistant" } as BaseEvent,
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1", delta: text } as BaseEvent,
    { type: EventType.TEXT_MESSAGE_END, messageId: "m1" } as BaseEvent,
  ];
}

test("NO_FINDING text is dropped, other text passes through in order", () => {
  const seen: BaseEvent[] = [];
  const forward = silenceFilter((e) => seen.push(e));
  for (const e of textRun("NO_FINDING")) forward(e);
  forward.flush();
  assert.equal(seen.length, 0);
  for (const e of textRun("Discrepancy found.")) forward(e);
  forward.flush();
  assert.deepEqual(seen.map((e) => e.type), [
    EventType.TEXT_MESSAGE_START,
    EventType.TEXT_MESSAGE_CONTENT,
    EventType.TEXT_MESSAGE_END,
  ]);
});

import { tsNum } from "./revision";

test("tsNum orders Slack ts and ISO occurredAt on one scale", () => {
  assert.equal(tsNum("1787062320.000100") > 0, true);
  assert.equal(tsNum("2026-08-19T20:30:00.000Z") > tsNum("2026-08-18T14:12:00.000Z"), true);
  assert.equal(tsNum("seven fifty"), -1);
});
