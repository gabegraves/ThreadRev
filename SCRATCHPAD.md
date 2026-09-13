# ThreadRev project scratchpad

## 2026-09-12 — Convex for hosted evidence storage

Decision: use Convex for the hosted version of ThreadRev's persistent evidence and review state. The user accepted this direction and requested that it be recorded here. This records the architecture decision; Convex has not been provisioned or implemented by this task.

### Scope

- Persist permitted Slack messages and edits with workspace/channel/thread identifiers, source timestamps, and permalinks. Deduplicate incoming events and preserve evidence history.
- Track document revisions, file hashes, extracted evidence, and source locators.
- Persist checker runs with their inputs, outputs, run IDs, and the requirement revision used.
- Persist findings, supersession status, and Slack card references so duplicate prevention and stale-card updates survive agent restarts.
- Retrieve relevant historical evidence across authorized threads and channels. Start with indexed lookups and full-text search; add semantic search only when representative cases demonstrate a need. Enforce workspace and channel access boundaries on retrieval.

### Keep the existing execution path

Keep CopilotKit Channels and its BuiltInAgent loop for the hackathon, with the existing local Python checkers. Convex supplies persistence and retrieval; adopting its agent framework or replacing the Slack harness is not part of this decision. The model investigates; trusted checker outputs and application validation determine what a finding may claim.

Exa is not used (decided 1:33 PM). The reviewer's truth is inside the workspace, and a web result cannot be bound to a revision or hashed. `EXA_API_KEY` is blank; the inherited capability stays in `agent-core` for its tests only. Do not add external search to the reviewer.

### Correctness boundaries

- In one Convex mutation, compare the run's requirement revision with the stored current revision before accepting its finding. Reject superseded runs; preserve their evidence and history.
- This only protects against revisions already ingested. Convex alone does not fix missing Slack history or the managed transport's per-delivery history snapshot. New change events must update durable revision state independently of an in-progress review.
- Slack publication is an external effect, outside the database transaction. Persist delivery state, handle retries without duplicate findings, and reconcile cards when a newer revision arrives. Do not claim atomic database-plus-Slack publication or that unseen changes can be detected.
- Hosted Convex is another processor of team evidence. This remains the hosted deployment path, not a claim of fully local/private operation. Never introduce an automatic cloud fallback for private mode.

### First implementation milestone

Retrieve a correction from an older Slack thread, use the corrected inputs in a trusted check, and retain the evidence, run, and finding after restarting the agent. Verify that a subsequently ingested revision makes the previous finding stale and prevents an older run from being accepted as current.

The motivating historical cases are repeated historical research, existing hardware being proposed for repurchase, ignored simulation-input corrections, conflicting artifact revisions, purchasing-state confusion, and document arithmetic inconsistencies. Internal evidence retrieval is the priority; a framework change alone does not solve these cases.

### References

- [Convex transactions and serializability](https://docs.convex.dev/database/advanced/occ)
- [Convex full-text search](https://docs.convex.dev/search/text-search)
- [Engineering failure patterns and synthetic fixtures](research/synthetic-fixture-spec.md)
- [Prior harness comparison](research/harness-hermes-vs-channels.md)
- [Current runtime setup and verification](SETUP.md)
