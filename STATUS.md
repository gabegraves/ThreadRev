# Status board

One line per lane. Update yours after every push. Read all four before you start. Times are EDT, 2026-09-12. Deadline 5:00 PM.

| Lane | Owner | Last pushed | Editing now | Blocked on |
|---|---|---|---|---|
| Backend / reviewer | Gabe | 12:25 `cbf5623` evidence graph and `/api/evidence`; `main` passes `npm run verify` (52 + 37 + 34 tests, 10 checker tests) | G1 record emitter `apps/channel/src/replay/record.ts` (see `research/handoff-eval-lane.md`) | none |
| Web console | fill in | 12:25 review console mounted on `apps/web/src/app/page.tsx`, CSS not written | fill in | none |
| Demo and submission | fill in | nothing yet, `submission/` does not exist | fill in | Slack lane: Path A (live Slack) or Path B (offline harness) decision by 3:00 PM |
| Slack environment and credentials | fill in | nothing yet; `OPENAI_API_KEY`, `CHANNEL_CODE`, `INTELLIGENCE_API_KEY` blank, no demo workspace confirmed | fill in | account holder for OpenAI billing and Slack workspace |
| Eval / red team | fill in (ML teammate) | nothing yet; handoff at `research/handoff-eval-lane.md` | fill in | backend lane: run records (G1) by 1:00 PM; Slack lane: `OPENAI_API_KEY` for model mode |

## Decisions and announcements

- 12:25 Contracts in `contracts/` and `packages/agent-core/src/contracts/` are frozen unless the backend lane announces a change here.
- 12:25 Eval lane opened. Seam is the run record in `research/handoff-eval-lane.md` section 4; field names freeze when G1 lands. `fixtures/adversarial/` and `evals/` move out of the backend lane.
- 3:00 PM checkpoint: if `npm run dev:slack` has not reached online, the demo lane records Path B and stops waiting.
