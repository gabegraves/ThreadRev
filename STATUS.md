# Status board

One line per lane. Update yours after every push. Read all four before you start. Times are EDT, 2026-09-12. Deadline 5:00 PM.

| Lane | Owner | Last pushed | Editing now | Blocked on |
|---|---|---|---|---|
| Backend / reviewer | Gabe | 12:55 `78b70e5` evidence recording wired into reviewer tools, gate, and silence filter; bundler-safe repo root in `agent-core` so web routes build; `npm run verify` green | G1 record emitter `apps/channel/src/replay/record.ts` (see `research/handoff-eval-lane.md`) | none |
| Web console | Gabe (until a web owner is named) | 12:55 `78b70e5` console live: thread view, drawer (Issues, Diffs, Evidence graph, Chat), change-hover mini graph; `npm run build --workspace web` passes; preview on :3100 serves `/api/evidence` (sample) | nothing; CSS polish and light-theme check open for the web owner | none |
| Demo and submission | fill in | nothing yet, `submission/` does not exist | fill in | Slack lane: Path A (live Slack) or Path B (offline harness) decision by 3:00 PM |
| Slack environment and credentials | fill in | nothing yet; `OPENAI_API_KEY`, `CHANNEL_CODE`, `INTELLIGENCE_API_KEY` blank, no demo workspace confirmed | fill in | account holder for OpenAI billing and Slack workspace |
| Eval / red team | fill in (ML teammate) | nothing yet; human handoff `research/handoff-eval-lane.md`, agent brief `research/agent-briefs/w5-eval-mechanics.md` | fill in | backend lane: run records (G1) by 1:00 PM; Slack lane: `OPENAI_API_KEY` for model mode |

## Decisions and announcements

- 12:25 Contracts in `contracts/` and `packages/agent-core/src/contracts/` are frozen unless the backend lane announces a change here.
- 12:45 Eval lane split: human owns labels, pass rules, audit, verdict (`evals/labels.md`, `pass-rules.md`, `audit.md`); agent owns cases, grader, matrix (`research/agent-briefs/w5-eval-mechanics.md`). Backend G1 run-record emitter still owed by 1:00 PM; record shape is in the agent brief W5c.
- 3:00 PM checkpoint: if `npm run dev:slack` has not reached online, the demo lane records Path B and stops waiting.
