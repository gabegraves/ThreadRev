import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvidence, evidenceLogPath, isEvidenceLogDisabled, readEvidence } from "./log";
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

test("EVIDENCE_LOG=off disables the log rather than naming a file called off", () => {
  const saved = process.env.EVIDENCE_LOG;
  try {
    process.env.EVIDENCE_LOG = "off";
    assert.equal(isEvidenceLogDisabled(), true);
    // The bug this guards: "off" was resolved as a path, so a caller that did
    // not know about the sentinel read and wrote <repo>/off silently.
    assert.doesNotMatch(evidenceLogPath(), /[\/]off$/);
    assert.match(evidenceLogPath(), /log\.jsonl$/);

    process.env.EVIDENCE_LOG = "custom/place.jsonl";
    assert.equal(isEvidenceLogDisabled(), false);
    assert.match(evidenceLogPath(), /place\.jsonl$/);
  } finally {
    if (saved === undefined) delete process.env.EVIDENCE_LOG;
    else process.env.EVIDENCE_LOG = saved;
  }
});
