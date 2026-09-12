/**
 * Loads a fixture Slack script from `fixtures/slack/<name>.json` and splits
 * it at a cutoff so evaluator-only messages are held back from the reviewer.
 *
 * The transcript shape mirrors what channels-intelligence serves from
 * `/transcript`, so `thread.getMessages()` inside a tool handler returns the
 * fixture messages verbatim during replay.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const fixtureMessage = z.object({
  ts: z.string().regex(/^\d+\.\d{6}$/),
  channel: z.string().min(1),
  channel_name: z.string().min(1),
  user: z.string().min(1),
  user_name: z.string().min(1),
  thread_ts: z.string().nullable(),
  text: z.string(),
  files: z.array(z.string()).default([]),
  role: z.enum(["seed", "trigger", "change", "evaluator_only"]),
  /**
   * Slack `message_changed`: this entry is an edit of the message with that
   * ts. The transcript keeps the original's logicalMessageId and gives the
   * edit its own revisionId, the way Intelligence reports an edited message.
   */
  edit_of: z.string().regex(/^\d+\.\d{6}$/).optional(),
});
export type FixtureMessage = z.infer<typeof fixtureMessage>;

const fixtureFile = z
  .union([
    z.array(fixtureMessage),
    z.object({ messages: z.array(fixtureMessage) }).transform((f) => f.messages),
  ])
  .superRefine((messages, ctx) => {
    const known = new Set(messages.map((m) => m.ts));
    for (const m of messages) {
      if (m.edit_of && !known.has(m.edit_of)) {
        ctx.addIssue({ code: "custom", message: `edit_of ${m.edit_of} names a ts that is not in the fixture (message ${m.ts})` });
      }
      if (m.edit_of && compareTs(m.edit_of, m.ts) >= 0) {
        ctx.addIssue({ code: "custom", message: `edit_of ${m.edit_of} must be earlier than the edit's own ts ${m.ts}` });
      }
    }
  });

export const FIXTURES_DIR = join(import.meta.dirname, "../../../../fixtures");

/** Numeric order on Slack ts strings ("seconds.sequence"). */
export function compareTs(a: string, b: string): number {
  const [as, aq] = a.split(".");
  const [bs, bq] = b.split(".");
  const sec = Number(as) - Number(bs);
  if (sec !== 0) return sec;
  return Number(aq) - Number(bq);
}

export function loadFixture(name: string, dir = FIXTURES_DIR): FixtureMessage[] {
  const raw = readFileSync(join(dir, "slack", `${name}.json`), "utf8");
  return fixtureFile
    .parse(JSON.parse(raw))
    .slice()
    .sort((a, b) => compareTs(a.ts, b.ts));
}

export interface Split {
  /** What the reviewer may read: ts <= cutoff and not evaluator-only. */
  visible: FixtureMessage[];
  /** Everything after the cutoff, plus evaluator-only messages. */
  heldBack: FixtureMessage[];
  cutoff: string;
}

/**
 * Split at `cutoff` (default: the trigger message's ts). Messages after the
 * cutoff and evaluator-only messages are held back for the evaluator.
 */
export function splitAtCutoff(messages: FixtureMessage[], cutoff?: string): Split {
  const trigger = messages.find((m) => m.role === "trigger");
  const at = cutoff ?? trigger?.ts;
  if (!at) throw new Error("fixture has no trigger message and no cutoff was given");
  const visible: FixtureMessage[] = [];
  const heldBack: FixtureMessage[] = [];
  for (const m of messages) {
    if (m.role !== "evaluator_only" && compareTs(m.ts, at) <= 0) visible.push(m);
    else heldBack.push(m);
  }
  return { visible, heldBack, cutoff: at };
}

/** Deterministic `pid_v1_` + 43 url-safe chars, derived from the ts. */
export function providerMessageId(ts: string): string {
  const digest = createHash("sha256").update(ts).digest("base64url");
  return `pid_v1_${digest.slice(0, 43)}`;
}

export function tsToIso(ts: string): string {
  const [sec, seq] = ts.split(".");
  const millis = Number(sec) * 1000 + Math.floor(Number(seq ?? "0") / 1000);
  return new Date(millis).toISOString();
}

/**
 * The channels-intelligence transcript payload for a set of messages.
 *
 * An edit (`edit_of`) is emitted as a revision of the original: same
 * logicalMessageId, new revisionId, new occurredAt. Both entries stay in the
 * transcript in ts order, which is how a thread reads after `message_changed`:
 * the original is still there and the edit is the latest revision of it.
 * Chained edits (an edit of an edit) resolve to the root message.
 */
export function toTranscript(messages: FixtureMessage[], triggerTs?: string) {
  const trigger = triggerTs ?? messages.find((m) => m.role === "trigger")?.ts;
  const byTs = new Map(messages.map((m) => [m.ts, m]));
  const rootOf = (m: FixtureMessage): string => {
    let cur = m;
    const seen = new Set<string>();
    while (cur.edit_of && !seen.has(cur.ts)) {
      seen.add(cur.ts);
      const parent = byTs.get(cur.edit_of);
      if (!parent) return cur.edit_of;
      cur = parent;
    }
    return cur.ts;
  };
  return {
    messages: messages.map((m) => ({
      logicalMessageId: providerMessageId(rootOf(m)),
      revisionId: providerMessageId(m.ts),
      occurredAt: tsToIso(m.ts),
      role: "participant" as const,
      actor: {
        id: m.user,
        kind: "human" as const,
        displayName: m.user_name,
        handle: m.user_name.toLowerCase().replace(/\s+/g, "."),
      },
      text: m.text,
      messageRef: { id: `pref_v1_transcript_message_${m.ts.replace(".", "_")}` },
      deleted: false,
      currentTrigger: m.ts === trigger,
      files: m.files.map((path) => ({
        providerFileId: `F${m.ts.replace(".", "")}`,
        name: path.split("/").pop() ?? path,
        mimeType: null,
        byteSize: null,
        availability: "provider_only" as const,
      })),
    })),
    truncation: { messageLimit: false, byteLimit: false, omittedMessageCount: 0 },
  };
}
