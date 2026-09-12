# Status board

One line per lane. Update yours after every push. Read all four before you start. Times are EDT, 2026-09-12. Deadline 5:00 PM.

| Lane | Owner | Last pushed | Editing now | Blocked on |
|---|---|---|---|---|
| Backend / reviewer | Gabe | 1:05 `search_workspace` tool plus workspace index (`apps/channel/src/workspace.ts`), workspace export fixture (39 msgs, 5 channels) with generator, `scenario-a-cross` fixture + script + replay test, record `evals/records/scripted/scenario-a-cross.1.json`; contract additions announced below; `npm run verify` green (56 + 44 + 34 tests, 10 checker tests) | G2 model mode (blocked), then fixes from eval results | `OPENAI_API_KEY` for G2 |
| Web console | Soham (28gugales-dev) | 1:40 `51d16d5` on branch `web-console`: Civic console in `apps/web` 1:1 with Civic's shell (rail, switcher, Demo/Live footer), base density (html zoom 0.8), analytics bento (verbatim port under `src/civic/`), findings as rows in Civic's AG Grid across all scenarios, workspace page for the exact-match index; 9 pages; `npx tsc --noEmit` in apps/web passes; preview :3110 | Overview port from Civic's city dashboard, QA pass, then PR to `main` | Gabe: review/merge `web-console` when ready |
| Demo and submission | fill in | nothing yet, `submission/` does not exist | fill in | Slack lane: Path A (live Slack) or Path B (offline harness) decision by 3:00 PM |
| Slack environment and credentials | fill in | nothing yet; `OPENAI_API_KEY`, `CHANNEL_CODE`, `INTELLIGENCE_API_KEY` blank, no demo workspace confirmed | fill in | account holder for OpenAI billing and Slack workspace |
| Eval / red team | fill in (ML teammate) | nothing yet; human handoff `research/handoff-eval-lane.md`, agent brief `research/agent-briefs/w5-eval-mechanics.md` | fill in | backend lane: run records (G1) by 1:00 PM; Slack lane: `OPENAI_API_KEY` for model mode |

## Decisions and announcements

- 12:25 Contracts in `contracts/` and `packages/agent-core/src/contracts/` are frozen unless the backend lane announces a change here.
- 12:45 Eval lane split: human owns labels, pass rules, audit, verdict (`evals/labels.md`, `pass-rules.md`, `audit.md`); agent owns cases, grader, matrix (`research/agent-briefs/w5-eval-mechanics.md`). Backend G1 run-record emitter still owed by 1:00 PM; record shape is in the agent brief W5c.
- 1:05 Run record seam frozen: the eleven section 4 field names in `research/handoff-eval-lane.md` are final; `apps/channel/src/replay/record.test.tsx` pins them. Backend lane committed `evals/records/scripted/*.json` per G1; the eval lane owns everything else under `evals/`.
- 1:05 `current_revision` in records is the string `latestRevision()` produced from the transcript: ISO `occurredAt` for a change message, Slack ts for the trigger fallback. Cards bind to the same string, so compare as strings.
- 1:20 If you pulled between `cbf5623` and `9e26775`, `npm run typecheck --workspace agent-core` failed with TS2307 on `./evidence/graph` and `./evidence/log`. Pull `9e26775` or later; nothing else to do.
- 3:00 PM checkpoint: if `npm run dev:slack` has not reached online, the demo lane records Path B and stops waiting.
- 1:05 Contract change (additive, backend lane): `message_read` events gain optional `channel` and `via: "thread" | "workspace_search"`; new event kind `workspace_search` (query, cutoff, total, returned, hit_ts). Old logs still parse. Graph builder ignores the new kind; hits appear as message nodes through their `message_read` events. Web lane: nothing required, but the console may show `channel` on message nodes found outside the thread.
- 1:05 Fifth reviewer tool `search_workspace` is live on the channel and in the replay harness. Scope decision: the agent must understand the whole workspace, not one thread. Implemented as exact-match search over a structured index (document, unit, quantity words, author, channel, cutoff at the trigger), not embeddings. README section "Why search by identifier, not RAG" is the team's answer to that question.
