/**
 * ThreadRev evidence log contract.
 *
 * Every reviewer action appends one event to an append-only JSONL log. The
 * review console builds the evidence graph from these events alone, so
 * anything the graph should show must be an event here with explicit refs.
 *
 * Node identity:
 *   message   → Slack ts               ("1787062320.000100")
 *   document  → sha256                 (64 hex)
 *   run       → checker run_id         ("rc-20260912T151200Z-7f3a")
 *   finding   → finding_id             ("fnd-...")
 *   revision  → the ts a card is bound to (same id space as message)
 *
 * Isomorphic: zod only.
 */
import { z } from "zod";
import { finding } from "./finding";

const ts = z.string().min(1);

const base = {
  /** Unique event id, monotonic within a process. */
  event_id: z.string().min(1),
  /** ISO time the event was recorded. */
  at: z.string().min(1),
  /** Conversation the event belongs to (thread ts or platform thread id). */
  thread: z.string().min(1),
  /** Message that started the reviewer run this event belongs to. */
  trigger_ts: ts.optional(),
};

/** A message the reviewer read. Emitted once per message per run. */
export const messageRead = z.object({
  ...base,
  kind: z.literal("message_read"),
  ts,
  from: z.string(),
  is_bot: z.boolean(),
  text: z.string().max(2000),
  /** True when latestRevision() classified this message as a change. */
  is_change: z.boolean(),
  /** Channel the message lives in, when it is outside the current thread. */
  channel: z.string().optional(),
  /** How the reviewer got it: the thread transcript or a workspace search. */
  via: z.enum(["thread", "workspace_search"]).optional(),
});

/** The reviewer searched the workspace index. Hits are recorded as message_read events. */
export const workspaceSearch = z.object({
  ...base,
  kind: z.literal("workspace_search"),
  query: z.record(z.string(), z.unknown()),
  cutoff: ts.optional(),
  total: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  /** ts of every hit returned to the reviewer. */
  hit_ts: z.array(ts),
});

/** A document the reviewer read through read_evidence. */
export const documentRead = z.object({
  ...base,
  kind: z.literal("document_read"),
  document: z.string().min(1),
  revision: z.string().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  line_count: z.number().int().nonnegative(),
  /** Message ts that named or attached the document, when known. */
  named_in_ts: ts.optional(),
});

/** A checker run. `inputs` and `checks` are copied from the response. */
export const checkRun = z.object({
  ...base,
  kind: z.literal("check_run"),
  run_id: z.string().min(1),
  checker: z.string().min(1),
  version: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
  outputs: z.record(z.string(), z.unknown()),
  checks: z.array(
    z.object({ name: z.string(), pass: z.boolean(), expected: z.unknown().optional(), actual: z.unknown().optional() }),
  ),
  error: z.string().nullable(),
  /** Document shas and message ts the inputs were extracted from. */
  evidence_refs: z.array(z.object({ kind: z.enum(["document", "message"]), id: z.string() })).default([]),
});

/** A card went live. */
export const findingPublished = z.object({
  ...base,
  kind: z.literal("finding_published"),
  finding,
  /** Slack message ref id of the posted card, when the surface returns one. */
  message_ref: z.string().optional(),
});

/** An earlier card was rewritten as stale because a newer card replaced it. */
export const findingSuperseded = z.object({
  ...base,
  kind: z.literal("finding_superseded"),
  finding_id: z.string().min(1),
  superseded_by: z.string().min(1),
  /** The change message that made it stale. */
  cause_ts: ts.optional(),
});

/** publish_result refused a card because the thread's revision moved. */
export const publishRefused = z.object({
  ...base,
  kind: z.literal("publish_refused"),
  run_id: z.string().min(1),
  bound_revision: ts,
  current_revision: ts,
  reason: z.string(),
});

/** The reviewer decided there was nothing to say (NO_FINDING). */
export const silence = z.object({
  ...base,
  kind: z.literal("silence"),
  reason: z.enum(["gate_closed", "no_finding"]),
});

/** One text replacement Rev proposes in a document: a printed result → the checker's value. */
export const proposedEdit = z.object({
  locator: z.string().min(1),
  find: z.string().min(1),
  replace: z.string().min(1),
  reason: z.string().optional(),
});

/** Rev proposed a document edit and asked a human to approve it. Nothing is written yet. */
export const editProposed = z.object({
  ...base,
  kind: z.literal("edit_proposed"),
  proposal_id: z.string().min(1),
  finding_id: z.string().optional(),
  run_id: z.string().min(1),
  document: z.string().min(1),
  /** sha256 of the source the edits were proposed against. */
  source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  edits: z.array(proposedEdit).min(1),
});

/** A human approved or rejected a proposal. Approval alone writes nothing; see edit_applied. */
export const editDecided = z.object({
  ...base,
  kind: z.literal("edit_decided"),
  proposal_id: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  by: z.string().optional(),
});

/** The approved edits were written to a NEW file. The source is untouched. */
export const editApplied = z.object({
  ...base,
  kind: z.literal("edit_applied"),
  proposal_id: z.string().min(1),
  document: z.string().min(1),
  source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  output: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  error: z.string().optional(),
});

export const evidenceEvent = z.discriminatedUnion("kind", [
  messageRead,
  documentRead,
  checkRun,
  findingPublished,
  findingSuperseded,
  publishRefused,
  silence,
  workspaceSearch,
  editProposed,
  editDecided,
  editApplied,
]);
export type ProposedEdit = z.infer<typeof proposedEdit>;
export type EvidenceEvent = z.infer<typeof evidenceEvent>;

/* ------------------------------------------------------------- graph */

export const graphNodeKind = z.enum(["message", "document", "run", "finding", "revision"]);
export const graphEdgeKind = z.enum([
  "read",          // run/finding ← message or document it read
  "checked_with",  // run ← document/message the inputs came from
  "published_from",// finding ← run
  "bound_to",      // finding → revision (message ts)
  "supersedes",    // new finding → old finding
  "refused_by",    // run → revision that refused it
  "changes",       // message → revision it created (a change message)
]);

export const graphNode = z.object({
  id: z.string().min(1),
  kind: graphNodeKind,
  label: z.string(),
  status: z.enum(["live", "stale", "refused", "neutral"]).default("neutral"),
  at: z.string().optional(),
  /** Whatever the console needs to render a hover card; kind-specific. */
  data: z.record(z.string(), z.unknown()).default({}),
});
export const graphEdge = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: graphEdgeKind,
});
export const evidenceGraph = z.object({
  thread: z.string(),
  nodes: z.array(graphNode),
  edges: z.array(graphEdge),
  /** Findings in publish order, latest last. */
  findings: z.array(finding),
  generated_at: z.string(),
});
export type EvidenceGraph = z.infer<typeof evidenceGraph>;
export type GraphNode = z.infer<typeof graphNode>;
export type GraphEdge = z.infer<typeof graphEdge>;
