import { test } from "node:test";
import assert from "node:assert/strict";
import { isReviewMoment } from "./review-moment";
import { latestRevision } from "./revision";
import { guardPublish } from "./replay/publish-guard";

test("attachments and review vocabulary open the gate", () => {
  assert.equal(isReviewMoment({ text: "r2 review doc is up", hasFiles: true }), true);
  assert.equal(isReviewMoment({ text: "@reviewer can you check section 3 before I sign the review?" }), true);
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
    { ts: "1787166300.000300", text: "@reviewer can you check section 3 of the r2 doc before I sign the review?" },
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

import { mentionsQuantity, unitsFromInputs } from "./revision";

const RC_INPUTS = {
  R_ohm: 470,
  threshold: 0.999,
  timer_s: 2.5,
  capacitances: [
    { label: "680uF_text", C_F: 0.00068 },
    { label: "750uF_diagram", C_F: 0.00075 },
  ],
  tolerance_s: 0.0005,
};

test("run inputs name the units the run depends on", () => {
  const units = unitsFromInputs(RC_INPUTS);
  assert.equal(units.includes("ohm"), true);
  assert.equal(units.includes("s"), true);
  assert.equal(units.includes("F"), true, "C_F inside the capacitances array must be reached");
});

test("a restated quantity counts as a change even with no change vocabulary", () => {
  const units = unitsFromInputs(RC_INPUTS);
  // None of these contain a CHANGE_PATTERN token, and all of them move the run.
  assert.equal(mentionsQuantity("we're going with 820 uF", units), true);
  assert.equal(mentionsQuantity("let's do 820uF on the bus", units), true);
  assert.equal(mentionsQuantity("bumping the relay to 3 s", units), true);
  assert.equal(mentionsQuantity("swap in the 560 ohm part", units), true);
});

test("prose without a run-relevant quantity does not move the revision", () => {
  const units = unitsFromInputs(RC_INPUTS);
  assert.equal(mentionsQuantity("looks good to me, shipping it", units), false);
  assert.equal(mentionsQuantity("I'll be 5 mins", units), false);
  assert.equal(mentionsQuantity("section 3 is the one I meant", units), false);
});

import { supersedesReason } from "./reviewer-tools";
import type { Finding } from "agent-core";

const PRIOR = {
  finding_id: "fnd-a-r2-001",
  requirements_revision: "1787062320.000100",
} as Finding;

test("a superseding card says in words which conclusion it replaced", () => {
  const reason = supersedesReason(
    PRIOR,
    [
      { ts: "1787062320.000100", text: "bus is now 680 uF" },
      { ts: "1787171400.000400", text: "we're going with 820 uF", user: { name: "Dara Voss" } },
    ],
    "1787171400.000400",
  );
  assert.match(reason!, /Replaces fnd-a-r2-001/);
  assert.match(reason!, /1787062320\.000100/);
  assert.match(reason!, /Dara Voss changed that/);
  assert.match(reason!, /we're going with 820 uF/);
});

test("dependency prose is omitted rather than invented", () => {
  assert.equal(supersedesReason(undefined, [], "1787171400.000400"), undefined);
  // Cause message absent from the transcript: still truthful, just thinner.
  const reason = supersedesReason(PRIOR, [], "1787171400.000400");
  assert.match(reason!, /moved to revision 1787171400\.000400/);
  assert.doesNotMatch(reason!, /changed that/);
});

test("the quantity backstop closes a gap CHANGE_PATTERN leaves open", () => {
  const msgs = [
    { ts: "1787166300.000300", text: "can you check section 3 of the r2 doc?" },
    { ts: "1787171400.000400", text: "we're going with 820 uF" },
  ];
  const trigger = "1787166300.000300";

  // Regex alone sees no change here, so the card would publish as fresh.
  assert.equal(latestRevision(msgs, trigger), trigger);

  // With the run's own units, the restated capacitance moves the revision and
  // the guard refuses the stale publish.
  const current = latestRevision(msgs, trigger, unitsFromInputs(RC_INPUTS));
  assert.equal(current, "1787171400.000400");
  assert.equal(
    guardPublish({ status: "live", requirements_revision: trigger }, current).ok,
    false,
  );
});
