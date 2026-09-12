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

export function evidenceLogPath(): string {
  return process.env.EVIDENCE_LOG
    ? resolve(process.env.EVIDENCE_LOG)
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
