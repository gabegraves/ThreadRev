/**
 * Append-only evidence log on disk, one JSON event per line.
 *
 * Node-only. The channel tools append; the review console reads. The path
 * comes from EVIDENCE_LOG or defaults to <repo>/evidence/log.jsonl.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { evidenceEvent, type EvidenceEvent } from "../contracts/evidence";

/**
 * Repo root. `import.meta.dirname` is undefined under Next's bundlers, so fall
 * back to walking up from cwd to the directory that holds `contracts/`.
 */
export function repoRoot(): string {
  const here = (import.meta as { dirname?: string }).dirname;
  if (here) return resolve(here, "../../../..");
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, "contracts", "examples"))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

/**
 * The value of EVIDENCE_LOG that means "do not keep a log at all". Tests set it.
 *
 * It has to live here because this module is what turns EVIDENCE_LOG into a
 * path: apps/channel treated "off" as a sentinel and checked for it before
 * calling, while this module treated the same value as a filename and resolved
 * it to <repo>/off. Nothing wrote that file only because the channel's guard
 * happened to come first — any other caller, the console's evidence route
 * included, would have read and written a file called "off" without anyone
 * noticing. One variable, one meaning.
 */
export const EVIDENCE_LOG_OFF = "off";

export function isEvidenceLogDisabled(): boolean {
  return process.env.EVIDENCE_LOG === EVIDENCE_LOG_OFF;
}

export function evidenceLogPath(): string {
  const configured = process.env.EVIDENCE_LOG;
  return configured && configured !== EVIDENCE_LOG_OFF
    ? resolve(configured)
    : resolve(repoRoot(), "evidence", "log.jsonl");
}

let seq = 0;
export function newEventId(): string {
  seq += 1;
  return `ev-${Date.now().toString(36)}-${String(seq).padStart(4, "0")}`;
}

/** Validate and append one event. Returns the event as written. */
export function appendEvidence(event: EvidenceEvent, path = evidenceLogPath()): EvidenceEvent {
  const parsed = evidenceEvent.parse(event);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(parsed) + "\n", "utf8");
  return parsed;
}

/** Read every valid event. Malformed lines are skipped and counted. */
export function readEvidence(path = evidenceLogPath()): { events: EvidenceEvent[]; skipped: number } {
  if (!existsSync(path)) return { events: [], skipped: 0 };
  const events: EvidenceEvent[] = [];
  let skipped = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = evidenceEvent.safeParse(JSON.parse(line));
      if (r.success) events.push(r.data);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { events, skipped };
}
