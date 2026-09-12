import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvidence, readEvidence } from "./log";
import { evidenceEvent } from "../contracts/evidence";

const SAMPLE = join(import.meta.dirname, "../../../../contracts/examples/evidence-log.jsonl");

test("the sample evidence log parses event by event", () => {
  const { events, skipped } = readEvidence(SAMPLE);
  assert.equal(skipped, 0);
  assert.ok(events.length >= 12);
  const kinds = new Set(events.map((e) => e.kind));
  for (const k of ["message_read", "document_read", "check_run", "finding_published", "finding_superseded", "silence"]) {
    assert.ok(kinds.has(k as never), `missing ${k}`);
  }
});

test("append validates and round-trips", () => {
  const path = join(mkdtempSync(join(tmpdir(), "ev-")), "log.jsonl");
  const { events } = readEvidence(SAMPLE);
  appendEvidence(events[0]!, path);
  appendEvidence(events[1]!, path);
  assert.equal(readEvidence(path).events.length, 2);
  assert.throws(() => appendEvidence({ kind: "silence" } as never, path));
  assert.ok(evidenceEvent.safeParse(events[0]!).success);
});
