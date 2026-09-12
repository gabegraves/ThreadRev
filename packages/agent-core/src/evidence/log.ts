/**
 * Append-only evidence log.
 *
 * RECONSTRUCTED. The original of this file was written alongside the evidence
 * contract but never committed: `.gitignore` carried an unanchored `evidence/`
 * rule, which matched this directory as well as the runtime log directory, so
 * `git add` skipped it and main stopped typechecking. The rule is anchored now
 * (`/evidence/`). If the original turns up, prefer it and delete this — the
 * exported surface is what `index.ts` already declares:
 *
 *   appendEvidence · readEvidence · evidenceLogPath · newEventId
 *
 * One JSONL file per repo, one event per line, never rewritten. Readers filter
 * by thread. Writes validate against the contract first, so a malformed event
 * fails here rather than corrupting the graph the console builds later.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { evidenceEvent, type EvidenceEvent } from "../contracts/evidence";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

/**
 * Where events land. `EVIDENCE_DIR` overrides the directory so a test or a
 * second process can keep its own log; the default sits at the repo root and
 * is gitignored.
 */
export function evidenceLogPath(): string {
  const dir = process.env.EVIDENCE_DIR ?? resolve(REPO_ROOT, "evidence");
  return resolve(dir, "events.jsonl");
}

let seq = 0;

/** Unique within a process and ordered, which is all the contract asks for. */
export function newEventId(): string {
  seq += 1;
  return `ev-${Date.now().toString(36)}-${seq.toString().padStart(4, "0")}`;
}

/**
 * Append one validated event. Throws on a contract violation so the caller
 * sees it; `apps/channel/src/evidence.ts` wraps this and swallows, because a
 * logging failure must never break a review.
 */
export function appendEvidence(event: EvidenceEvent): void {
  const parsed = evidenceEvent.parse(event);
  const path = evidenceLogPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(parsed)}\n`, "utf8");
}

/**
 * Every event, oldest first, optionally narrowed to one thread.
 *
 * A malformed line is skipped rather than thrown on: the log is append-only
 * and may be read while it is being written, so a torn final line is expected
 * and is not a reason to fail the whole read.
 */
export function readEvidence(thread?: string): EvidenceEvent[] {
  const path = evidenceLogPath();
  if (!existsSync(path)) return [];

  const out: EvidenceEvent[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let candidate: unknown;
    try {
      candidate = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = evidenceEvent.safeParse(candidate);
    if (!parsed.success) continue;
    if (thread && parsed.data.thread !== thread) continue;
    out.push(parsed.data);
  }
  return out;
}
